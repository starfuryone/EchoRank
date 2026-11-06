// src/lib/answer-cache.ts
//
// One engine answer per question per day, shared across tenants and runs.
//
// WHY. A brand-independent question ("best CRM for small agencies") gets the
// same answer from an engine whoever asks it, so two tenants tracking it — or
// a tenant and yesterday's free check — paying for it twice buys nothing. The
// raw answer is stored ONCE; analysis (who is mentioned, in what position,
// which domains are cited) stays per brand, because that is where tenants
// differ.
//
// THE KEY IS EVERYTHING THAT SHAPES THE ANSWER, and nothing that identifies
// who asked:
//   normalized prompt text   case, accents, whitespace and trailing ?!. folded
//   engine + model           a different model is a different measurement
//   request profile          system prompt, tools, output cap: two surfaces
//                            asking differently do NOT share (the free check's
//                            required-web-search request is not the tracker's)
//   location                 what is actually sent to the engine ("" if none)
//   repetition               repetition 2 is a second sample, never a copy of 1
//   UTC day                  an answer is reused for the day it was asked
//
// BRAND-SPECIFIC PROMPTS ARE NEVER SHARED. A prompt naming the brand, an alias,
// its domain or a known competitor is asked fresh: the caller passes those
// terms and isBrandSpecific() decides before any lookup.
//
// NOTHING HERE RECORDS WHO ASKED. The stored value carries the answer, its
// sources and the model; no tenant id, no brand, no count of askers. The key
// is a hash. Callers do not surface hit/miss to users, so no tenant can learn
// that another tracks the same question.
//
// FAILS OPEN. Redis down or slow means the engine is asked, as before: the
// cache saves money, it is never the reason an answer is missing.

import "server-only";
import { createHash } from "node:crypto";
import { fold, findNameHits } from "@/lib/ai-monitor/analysis/deterministic";
import { registrableDomain } from "@/lib/registrable-domain";

const KEY_PREFIX = "echorank:answer-cache:v1";
/** An entry outlives its UTC day by this much, for the job that started at 23:59. */
const GRACE_SECONDS = 60 * 60;

/** Folded, single-spaced, without trailing punctuation: the question, not its typing. */
export function normalizePrompt(text: string): string {
  return fold(text.normalize("NFKC"))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s?!.。！？]+$/u, "");
}

export interface AnswerRequest {
  engine: string;
  model: string;
  /** Identifies how the question is put: system prompt, tools, cap. See the header. */
  profile: string;
  /** What is sent to the engine as a location; "" when nothing is. */
  location?: string;
  /** 1-based. */
  repetition?: number;
}

/** YYYY-MM-DD in UTC. */
export function utcDayOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The Redis key. Exported for tests; it embeds the day and a hash, nothing else. */
export function answerCacheKey(promptText: string, request: AnswerRequest, now: Date): string {
  const canonical = JSON.stringify([
    normalizePrompt(promptText),
    request.engine,
    request.model,
    request.profile,
    request.location ?? "",
    request.repetition ?? 1,
  ]);
  const digest = createHash("sha256").update(canonical).digest("hex").slice(0, 40);
  return `${KEY_PREFIX}:${utcDayOf(now)}:${digest}`;
}

/** A short, stable id for a request profile: hash of its parts. */
export function requestProfile(...parts: Array<string | number>): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
}

/**
 * Does the prompt name the brand, an alias, its domain or a competitor?
 * Whole-word, accent- and case-insensitive; a domain counts by its
 * registrable form ("www.acme.co.uk/x" and "acme.co.uk" are the same).
 */
export function isBrandSpecific(
  promptText: string,
  terms: { names: readonly string[]; domains?: readonly (string | null | undefined)[] },
): boolean {
  const folded = fold(promptText);
  const names = terms.names.map((n) => n.trim()).filter((n) => n.length >= 2);
  if (names.length > 0 && findNameHits(folded, names).length > 0) return true;

  for (const raw of terms.domains ?? []) {
    if (!raw) continue;
    const domain = registrableDomain(raw);
    if (!domain) continue;
    if (folded.includes(domain)) return true;
    // The domain's first label is how people write a brand that IS its domain.
    const label = domain.split(".")[0];
    if (label.length >= 4 && findNameHits(folded, [label]).length > 0) return true;
  }
  return false;
}

/** What is stored: the engine's answer, nothing about who asked. */
export interface SharedAnswer {
  answer: string;
  sources: { url: string }[];
  model: string;
}

/** The slice of a Redis client this module uses. */
export interface AnswerCacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", seconds: number, flag: "NX"): Promise<unknown>;
  incr?(key: string): Promise<number>;
  expire?(key: string, seconds: number): Promise<unknown>;
}

/** Daily totals of hits, misses and brand-specific skips: counts only, no tenant. */
export const STATS_PREFIX = `${KEY_PREFIX}:stats`;
const STATS_TTL_SECONDS = 40 * 24 * 60 * 60;

export function statsKey(day: string, outcome: "hit" | "miss" | "skip"): string {
  return `${STATS_PREFIX}:${day}:${outcome}`;
}

async function count(store: AnswerCacheStore | null, now: Date, outcome: "hit" | "miss" | "skip") {
  if (!store?.incr) return;
  try {
    const key = statsKey(utcDayOf(now), outcome);
    if ((await store.incr(key)) === 1) await store.expire?.(key, STATS_TTL_SECONDS);
  } catch {
    // Counting is best effort.
  }
}

async function defaultStore(): Promise<AnswerCacheStore> {
  const { getRedisConnection } = await import("@/infrastructure/redis/connection");
  return getRedisConnection() as unknown as AnswerCacheStore;
}

function secondsToLive(now: Date): number {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.ceil((end - now.getTime()) / 1000) + GRACE_SECONDS);
}

export interface SharedAnswerOptions {
  promptText: string;
  request: AnswerRequest;
  /** Set when the prompt names a brand: then the cache is skipped entirely. */
  brandSpecific: boolean;
  now?: Date;
  store?: AnswerCacheStore;
}

export interface SharedAnswerResult<T> {
  /** The fresh call's value; null on a hit. */
  value: T | null;
  /** On a hit, the stored answer; on a miss, what was stored (or null). */
  shared: SharedAnswer | null;
  hit: boolean;
}

/**
 * Read the day's shared answer, or ask and share it.
 *
 * `ask` runs the real (metered) call; `toShared` picks out what may be stored
 * — returning null keeps a result out of the cache (an empty or errored
 * answer is never shared). A hit makes no engine call, so nothing is metered.
 */
export async function withSharedAnswer<T>(
  options: SharedAnswerOptions,
  ask: () => Promise<T>,
  toShared: (value: T) => SharedAnswer | null,
): Promise<SharedAnswerResult<T>> {
  const now = options.now ?? new Date();
  let store: AnswerCacheStore | null = null;
  try {
    store = options.store ?? (await defaultStore());
  } catch {
    store = null; // Fail open: no cache, ask the engine.
  }

  if (options.brandSpecific) {
    await count(store, now, "skip");
    const value = await ask();
    return { value, shared: null, hit: false };
  }

  const key = answerCacheKey(options.promptText, options.request, now);
  try {
    const cached = store ? await store.get(key) : null;
    if (cached) {
      const parsed = JSON.parse(cached) as SharedAnswer;
      if (typeof parsed?.answer === "string" && parsed.answer.trim()) {
        await count(store, now, "hit");
        return { value: null, shared: parsed, hit: true };
      }
    }
  } catch {
    // Fail open: ask the engine.
  }

  await count(store, now, "miss");
  const value = await ask();
  const shared = toShared(value);
  if (shared && shared.answer.trim() && store) {
    try {
      // NX: the first answer of the day is the shared one, even if two
      // tenants asked at the same moment.
      await store.set(
        key,
        JSON.stringify({ answer: shared.answer, sources: shared.sources, model: shared.model }),
        "EX",
        secondsToLive(now),
        "NX",
      );
    } catch {
      // Not stored; the answer is still returned.
    }
  }
  return { value, shared, hit: false };
}
