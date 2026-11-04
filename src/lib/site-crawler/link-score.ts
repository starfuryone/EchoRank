// src/lib/site-crawler/link-score.ts
//
// Phase 4g Link Score: PageRank over the crawl's internal link graph, run in
// the aggregation job. Damping 0.85, 20 iterations, uniform teleport, dangling
// pages' rank spread evenly. Followed internal edges only (crawl_links with a
// resolved toPageId; rel=nofollow and external rows pass no rank).
//
// MEMORY: the edge list lives in two Int32Arrays (source / target index) read
// in keyset batches, the ranks in Float64Arrays — a 25,000-page crawl with 2.5
// million edges is ~20 MB, no per-row objects and no per-row queries. Scores
// are written back in batched UPDATE … FROM unnest().
//
// SCALE: 0–100, log-normalised: 100 × (ln r − ln min) / (ln max − ln min),
// so the long tail spreads out instead of everything sitting at 0.

import "server-only";
import { prisma } from "@/lib/prisma";

export const DAMPING = 0.85;
export const ITERATIONS = 20;
const EDGE_BATCH = 50_000;
const WRITE_BATCH = 1_000;

/** Pure: PageRank over n nodes and the edge list (src[i] → dst[i]). */
export function pageRank(n: number, src: Int32Array, dst: Int32Array, edges: number, damping = DAMPING, iterations = ITERATIONS): Float64Array {
  const out = new Int32Array(n);
  for (let i = 0; i < edges; i++) out[src[i]!]!++;
  let rank = new Float64Array(n).fill(1 / n);
  let next = new Float64Array(n);
  for (let it = 0; it < iterations; it++) {
    let dangling = 0;
    for (let v = 0; v < n; v++) if (out[v] === 0) dangling += rank[v]!;
    next.fill((1 - damping) / n + (damping * dangling) / n);
    for (let i = 0; i < edges; i++) {
      const s = src[i]!;
      next[dst[i]!]! += (damping * rank[s]!) / out[s]!;
    }
    [rank, next] = [next, rank];
  }
  return rank;
}

/** Pure: 0–100 on a log scale (all equal → 100). */
export function logScale(rank: Float64Array): Float32Array {
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of rank) {
    const l = Math.log(r);
    if (l < lo) lo = l;
    if (l > hi) hi = l;
  }
  const span = hi - lo;
  const out = new Float32Array(rank.length);
  for (let i = 0; i < rank.length; i++) out[i] = span > 0 ? (100 * (Math.log(rank[i]!) - lo)) / span : 100;
  return out;
}

/**
 * The bottom decile's EXCLUSIVE upper bound: a page is in it when its score is
 * strictly below this, so at most ~10 % of pages qualify however many tie.
 * Null for fewer than 10 pages, or when no page scores below it (no spread).
 */
export function bottomDecile(scores: ArrayLike<number>): number | null {
  if (scores.length < 10) return null;
  const sorted = Float64Array.from(scores).sort();
  const t = sorted[Math.ceil(sorted.length * 0.1)]!;
  return t > sorted[0]! ? t : null;
}

/** Compute and store crawl_pages.linkScore. Returns the scores' bottom-decile threshold. */
export async function computeLinkScores(jobId: string): Promise<{ pages: number; edges: number; p10: number | null }> {
  const pages = await prisma.crawlPage.findMany({ where: { crawlJobId: jobId }, orderBy: { id: "asc" }, select: { id: true } });
  const n = pages.length;
  if (n === 0) return { pages: 0, edges: 0, p10: null };
  const index = new Map(pages.map((p, i) => [p.id, i]));

  let src = new Int32Array(1 << 16);
  let dst = new Int32Array(1 << 16);
  let m = 0;
  let cursor: string | null = null;
  for (;;) {
    const batch: { id: string; fromPageId: string; toPageId: string | null }[] = await prisma.crawlLink.findMany({
      where: { crawlJobId: jobId, isExternal: false, nofollow: false, toPageId: { not: null }, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: "asc" },
      take: EDGE_BATCH,
      select: { id: true, fromPageId: true, toPageId: true },
    });
    if (batch.length === 0) break;
    if (m + batch.length > src.length) {
      const size = Math.max(src.length * 2, m + batch.length);
      const s2 = new Int32Array(size);
      s2.set(src.subarray(0, m));
      const d2 = new Int32Array(size);
      d2.set(dst.subarray(0, m));
      src = s2;
      dst = d2;
    }
    for (const e of batch) {
      const a = index.get(e.fromPageId);
      const b = e.toPageId ? index.get(e.toPageId) : undefined;
      if (a === undefined || b === undefined || a === b) continue;
      src[m] = a;
      dst[m] = b;
      m++;
    }
    cursor = batch[batch.length - 1]!.id;
  }

  // Rounded to 0.1 once, here: the stored value, the threshold and the rule all see the same numbers
  // (unrounded, float noise would split pages that tie).
  // Doubles, not Float32: a real column reads back as the shortest decimal (14.6), which a Float32
  // threshold (14.600000381…) would sit just above.
  const scores = Float64Array.from(logScale(pageRank(n, src, dst, m)), (v) => Math.round(v * 10) / 10);
  for (let i = 0; i < n; i += WRITE_BATCH) {
    const ids = pages.slice(i, i + WRITE_BATCH).map((p) => p.id);
    const vals = Array.from(scores.subarray(i, i + WRITE_BATCH));
    await prisma.$executeRaw`
      UPDATE "crawl_pages" c SET "linkScore" = v.s
      FROM (SELECT unnest(${ids}::text[]) AS id, unnest(${vals}::real[]) AS s) v
      WHERE c."id" = v.id AND c."crawlJobId" = ${jobId}`;
  }
  return { pages: n, edges: m, p10: bottomDecile(scores) };
}
