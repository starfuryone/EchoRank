// src/lib/site-crawler/external-links.ts
//
// Phase 4g external links: the outbound links stored in crawl_links
// (isExternal), their status resolved ONCE PER URL PER CRAWL at aggregation
// (not per source page), and the reads behind the External tab and its CSV.
//
// Resolution goes through the same HEAD path and per-crawl Redis cache as
// the page-time checks (head-checks.ts), so a URL a page already checked is
// not asked again; the SSRF guard applies to every URL. At most
// EXTERNAL_RESOLVE_CAP distinct URLs per crawl, the most-linked first; the
// rest stay status null ("not checked"). Grouped reads are SQL; no URL set is
// held in memory beyond one page of results.

import "server-only";
import type Redis from "ioredis";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { PageSiteFacts } from "@/lib/crawl-rules";
import { EXTERNAL_RESOLVE_CAP, EXTERNAL_RESOLVE_CONCURRENCY, REDIS_KEY_TTL_SECONDS } from "./constants";
import { head, type HeadResult } from "./head-checks";
import { isFetchableUrl } from "./url";

/** Statuses that say nothing about the link: bot protection, HEAD refused. Not findings (as head-checks.ts). */
export const INCONCLUSIVE_STATUSES = [401, 403, 405, 429, 501] as const;
const UPDATE_CHUNK = 500;

export interface ExternalResolveResult {
  urls: number;
  checked: number;
  capped: boolean;
}

/** Resolve the crawl's distinct external URLs (most-linked first, capped) and store each status on its rows. */
export async function resolveExternalStatuses(
  jobId: string,
  redis: Pick<Redis, "hget" | "hset" | "expire">,
  cacheKey: string,
  headFn: (url: string) => Promise<HeadResult> = head,
): Promise<ExternalResolveResult> {
  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(DISTINCT "toUrl") AS n FROM "crawl_links" WHERE "crawlJobId" = ${jobId} AND "isExternal"`;
  const urls = (
    await prisma.$queryRaw<{ toUrl: string }[]>`
      SELECT "toUrl" FROM "crawl_links" WHERE "crawlJobId" = ${jobId} AND "isExternal"
      GROUP BY "toUrl" ORDER BY count(DISTINCT "fromPageId") DESC, "toUrl" LIMIT ${EXTERNAL_RESOLVE_CAP}`
  ).map((r) => r.toUrl);

  const statuses: (number | null)[] = new Array(urls.length).fill(null);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= urls.length) return;
      const url = urls[i]!;
      if (!isFetchableUrl(url)) continue;
      const hit = await redis.hget(cacheKey, url);
      if (hit !== null) {
        const s = hit.split("|")[0];
        statuses[i] = s ? Number(s) : null;
        continue;
      }
      const r = await headFn(url);
      await redis.hset(cacheKey, url, `${r.status ?? ""}|${r.bytes ?? ""}`);
      statuses[i] = r.status;
    }
  };
  await Promise.all(Array.from({ length: Math.min(EXTERNAL_RESOLVE_CONCURRENCY, urls.length) }, worker));
  if (urls.length) await redis.expire(cacheKey, REDIS_KEY_TTL_SECONDS);

  for (let i = 0; i < urls.length; i += UPDATE_CHUNK) {
    const u = urls.slice(i, i + UPDATE_CHUNK);
    const s = statuses.slice(i, i + UPDATE_CHUNK);
    await prisma.$executeRaw`
      UPDATE "crawl_links" l SET "status" = v.s
      FROM (SELECT unnest(${u}::text[]) AS u, unnest(${s}::int[]) AS s) v
      WHERE l."crawlJobId" = ${jobId} AND l."isExternal" AND l."toUrl" = v.u AND v.s IS NOT NULL`;
  }
  return { urls: Number(n), checked: statuses.filter((x) => x !== null).length, capped: Number(n) > urls.length };
}

const BROKEN_4XX = Prisma.sql`(l."status" BETWEEN 400 AND 499 AND l."status" NOT IN (401, 403, 405, 429))`;
const BROKEN_5XX = Prisma.sql`(l."status" >= 500 AND l."status" <> 501)`;

/** Per source page: its outbound links by resolved status, a broken sample and how many pages link to it. */
export async function externalFacts(jobId: string): Promise<Map<string, NonNullable<PageSiteFacts["external"]>>> {
  const rows = await prisma.$queryRaw<{ id: string; checked: bigint; c4: bigint; c5: bigint; sample: string | null }[]>`
    SELECT l."fromPageId" AS id,
      count(*) FILTER (WHERE l."status" IS NOT NULL) AS checked,
      count(*) FILTER (WHERE ${BROKEN_4XX}) AS c4,
      count(*) FILTER (WHERE ${BROKEN_5XX}) AS c5,
      COALESCE(min(l."toUrl") FILTER (WHERE ${BROKEN_4XX}), min(l."toUrl") FILTER (WHERE ${BROKEN_5XX})) AS sample
    FROM "crawl_links" l
    WHERE l."crawlJobId" = ${jobId} AND l."isExternal"
    GROUP BY l."fromPageId"`;
  const samples = [...new Set(rows.map((r) => r.sample).filter((s): s is string => s !== null))];
  const info = new Map<string, { found: number; status: number | null }>();
  for (let i = 0; i < samples.length; i += UPDATE_CHUNK) {
    const chunk = samples.slice(i, i + UPDATE_CHUNK);
    const got = await prisma.$queryRaw<{ toUrl: string; found: bigint; status: number | null }[]>`
      SELECT l."toUrl", count(DISTINCT l."fromPageId") AS found, max(l."status") AS status
      FROM "crawl_links" l
      WHERE l."crawlJobId" = ${jobId} AND l."isExternal" AND l."toUrl" = ANY(${chunk}::text[])
      GROUP BY l."toUrl"`;
    for (const g of got) info.set(g.toUrl, { found: Number(g.found), status: g.status });
  }
  return new Map(
    rows.map((r) => [
      r.id,
      {
        checked: Number(r.checked),
        clientErrors: Number(r.c4),
        serverErrors: Number(r.c5),
        sample: r.sample,
        sampleStatus: r.sample ? (info.get(r.sample)?.status ?? null) : null,
        foundOn: r.sample ? (info.get(r.sample)?.found ?? 0) : 0,
      },
    ]),
  );
}

// ─── External tab ────────────────────────────────────────────────────────────

export const EXTERNAL_STATUS_CLASSES = ["2xx", "3xx", "4xx", "5xx", "none"] as const;
export type ExternalStatusClass = (typeof EXTERNAL_STATUS_CLASSES)[number];

export interface ExternalFilter {
  statusClass: ExternalStatusClass | null;
  /** Exact hostname, lowercased. */
  host: string | null;
}

export interface ExternalRow {
  url: string;
  host: string;
  status: number | null;
  sources: number;
  firstAnchor: string | null;
}

const hostExpr = Prisma.sql`lower(split_part(split_part(l."toUrl", '://', 2), '/', 1))`;

function filterSql(f: ExternalFilter): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (f.host) parts.push(Prisma.sql`${hostExpr} = ${f.host}`);
  if (f.statusClass === "none") parts.push(Prisma.sql`l."status" IS NULL`);
  else if (f.statusClass) {
    const lo = Number(f.statusClass[0]) * 100;
    parts.push(Prisma.sql`l."status" BETWEEN ${lo} AND ${lo + 99}`);
  }
  return parts.length ? Prisma.sql`AND ${Prisma.join(parts, " AND ")}` : Prisma.empty;
}

/** One row per distinct external URL, most-linked first; `after` is the last URL of the previous page (keyset, CSV). */
export async function externalRows(jobId: string, f: ExternalFilter, opts: { offset?: number; after?: string | null; take: number }): Promise<ExternalRow[]> {
  const rows = await prisma.$queryRaw<{ url: string; host: string; status: number | null; sources: bigint; firstAnchor: string | null }[]>`
    SELECT l."toUrl" AS url, ${hostExpr} AS host, max(l."status") AS status, count(DISTINCT l."fromPageId") AS sources,
      (array_agg(l."anchor" ORDER BY l."id") FILTER (WHERE l."anchor" IS NOT NULL))[1] AS "firstAnchor"
    FROM "crawl_links" l
    WHERE l."crawlJobId" = ${jobId} AND l."isExternal" ${filterSql(f)}
      ${opts.after ? Prisma.sql`AND l."toUrl" > ${opts.after}` : Prisma.empty}
    GROUP BY l."toUrl"
    ORDER BY ${opts.after !== undefined ? Prisma.sql`l."toUrl"` : Prisma.sql`count(DISTINCT l."fromPageId") DESC, l."toUrl"`}
    ${opts.offset ? Prisma.sql`OFFSET ${opts.offset}` : Prisma.empty}
    LIMIT ${opts.take}`;
  return rows.map((r) => ({ ...r, sources: Number(r.sources) }));
}

export async function externalCount(jobId: string, f: ExternalFilter): Promise<number> {
  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(DISTINCT l."toUrl") AS n FROM "crawl_links" l WHERE l."crawlJobId" = ${jobId} AND l."isExternal" ${filterSql(f)}`;
  return Number(n);
}

/** The pages linking to one external URL (the row's expandable list). */
export async function externalSources(jobId: string, url: string, take: number): Promise<{ url: string; anchor: string | null }[]> {
  return prisma.$queryRaw<{ url: string; anchor: string | null }[]>`
    SELECT p."url", l."anchor" FROM "crawl_links" l JOIN "crawl_pages" p ON p."id" = l."fromPageId"
    WHERE l."crawlJobId" = ${jobId} AND l."isExternal" AND l."toUrl" = ${url}
    ORDER BY p."depth", p."url" LIMIT ${take}`;
}
