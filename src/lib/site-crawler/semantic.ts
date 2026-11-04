// src/lib/site-crawler/semantic.ts
//
// Phase 4g semantic duplicates and off-topic pages. Embeddings come from
// OpenAI text-embedding-3-small at 256 dimensions, on the TENANT's own key
// (tenant_ai_keys; there is no house key for this), over each page's visible
// text truncated to 6,000 chars. Stored as 256 little-endian Float32 values
// (1 KB) in crawl_pages.embedding — no pgvector.
//
// The comparison runs in the worker over typed arrays: every vector is
// normalised once, so cosine is a dot product; pairwise over N ≤ 5,000 pages
// is N²/2 × 256 multiply-adds, a few seconds. The site centroid is the mean
// of the normalised vectors; a page's off-topic distance is 1 − cos(page,
// centroid), and the top 5 % by distance are flagged (crawls of 20+ pages).

import "server-only";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 256;
/** Published price, USD per million input tokens (text-embedding-3-small). */
export const EMBEDDING_USD_PER_MTOK = 0.02;
export const EMBEDDING_TEXT_CHARS = 6_000;
/** Estimate per page: 6,000 chars of text is ~1,500 tokens. */
export const EMBEDDING_TOKENS_PER_PAGE = 1_500;
export const DUPLICATE_COSINE = 0.95;
export const OFF_TOPIC_SHARE = 0.05;
export const OFF_TOPIC_MIN_PAGES = 20;
const BATCH_TIMEOUT_MS = 60_000;

export class EmbeddingError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

/** Float32 vector ⇄ the 1 KB bytea. */
export function toBytes(v: Float32Array): Buffer {
  const b = Buffer.alloc(v.length * 4);
  for (let i = 0; i < v.length; i++) b.writeFloatLE(v[i]!, i * 4);
  return b;
}
export function fromBytes(b: Uint8Array): Float32Array | null {
  if (b.length !== EMBEDDING_DIMS * 4) return null;
  const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  const v = new Float32Array(EMBEDDING_DIMS);
  for (let i = 0; i < EMBEDDING_DIMS; i++) v[i] = buf.readFloatLE(i * 4);
  return v;
}

/** One embeddings call for a batch of texts. The key goes in a header; no error body is kept (it can echo the input). */
export async function embedBatch(key: string, texts: string[], f: typeof fetch = fetch): Promise<{ vectors: Float32Array[]; tokens: number }> {
  let res: Response;
  try {
    res = await f("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMS, input: texts.map((t) => t.slice(0, EMBEDDING_TEXT_CHARS)) }),
      signal: AbortSignal.timeout(BATCH_TIMEOUT_MS),
    });
  } catch {
    throw new EmbeddingError("network error", null);
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new EmbeddingError(`HTTP ${res.status}`, res.status);
  }
  const d = (await res.json().catch(() => null)) as { data?: { index: number; embedding: number[] }[]; usage?: { total_tokens?: number } } | null;
  const vectors: Float32Array[] = new Array(texts.length);
  for (const row of d?.data ?? []) if (row.embedding?.length === EMBEDDING_DIMS) vectors[row.index] = Float32Array.from(row.embedding);
  if (vectors.filter(Boolean).length !== texts.length) throw new EmbeddingError("incomplete response", res.status);
  return { vectors, tokens: Number(d?.usage?.total_tokens ?? 0) };
}

export const embeddingCostUsd = (tokens: number) => (tokens * EMBEDDING_USD_PER_MTOK) / 1_000_000;
export const embeddingEstimate = (pages: number) => ({ tokens: pages * EMBEDDING_TOKENS_PER_PAGE, usd: embeddingCostUsd(pages * EMBEDDING_TOKENS_PER_PAGE) });

export interface SemanticFinding {
  /** Most similar other page (index) and its cosine; -1 when none. */
  nearest: number;
  nearestScore: number;
  /** 1 − cos(page, site centroid). */
  distance: number;
  offTopic: boolean;
}

/** Pure: nearest neighbour and centroid distance for each of the N vectors (row-major, N × dims). */
export function analyse(vectors: Float32Array, n: number, dims = EMBEDDING_DIMS): SemanticFinding[] {
  const v = Float32Array.from(vectors);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < dims; k++) s += v[i * dims + k]! ** 2;
    const inv = s > 0 ? 1 / Math.sqrt(s) : 0;
    for (let k = 0; k < dims; k++) v[i * dims + k]! *= inv;
  }
  const best = new Float32Array(n).fill(-2);
  const who = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const oi = i * dims;
    for (let j = i + 1; j < n; j++) {
      const oj = j * dims;
      let dot = 0;
      for (let k = 0; k < dims; k++) dot += v[oi + k]! * v[oj + k]!;
      if (dot > best[i]!) {
        best[i] = dot;
        who[i] = j;
      }
      if (dot > best[j]!) {
        best[j] = dot;
        who[j] = i;
      }
    }
  }
  const centroid = new Float64Array(dims);
  for (let i = 0; i < n; i++) for (let k = 0; k < dims; k++) centroid[k]! += v[i * dims + k]!;
  let norm = 0;
  for (let k = 0; k < dims; k++) norm += centroid[k]! ** 2;
  norm = Math.sqrt(norm) || 1;
  const distance = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let dot = 0;
    for (let k = 0; k < dims; k++) dot += (v[i * dims + k]! * centroid[k]!) / norm;
    distance[i] = 1 - dot;
  }
  let cut = Infinity;
  if (n >= OFF_TOPIC_MIN_PAGES) {
    const sorted = Float64Array.from(distance).sort();
    // Strictly the top 5 %: the distance the (n − ⌈5 %⌉)-th page has; ties at it stay out.
    cut = sorted[n - Math.ceil(n * OFF_TOPIC_SHARE) - 1]!;
  }
  return Array.from({ length: n }, (_, i) => ({
    nearest: who[i]!,
    nearestScore: Math.round(best[i]! * 1000) / 1000,
    distance: Math.round(distance[i]! * 1000) / 1000,
    offTopic: distance[i]! > cut,
  }));
}
