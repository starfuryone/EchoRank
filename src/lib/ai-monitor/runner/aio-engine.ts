// src/lib/ai-monitor/runner/aio-engine.ts
//
// The Google AI Overviews engine for the scheduled tracker: the monitored
// question is searched on Google through DataForSEO's SERP API (Live mode, one
// synchronous call) and the AI Overview at the top of the results is the
// answer, its reference links the sources.
//
// COST IS DATAFORSEO'S, AND IT IS THE REAL ONE. Not tokens: the envelope's own
// `cost` field, recorded as a SeoApiCall row with feature "ai_tracking"
// (./tracking-calls.ts) and carried onto the AiProviderCall row so a
// checkup's total is complete (pricing.ts, TOKEN_FREE_PROVIDERS). List price,
// dataforseo.com/pricing/serp/google-organic-serp-api read 2026-11-06: $0.002
// per SERP of 10 results in Live mode, plus one base price ($0.002) for
// `load_async_ai_overview`, refunded when the SERP has no asynchronous
// overview. So $0.002 to $0.004 a check.
//
// LOAD_ASYNC_AI_OVERVIEW IS NOT OPTIONAL. Most overviews load after the page
// does; without the flag DataForSEO returns the overview's element with no
// content (fixtures/dataforseo/v3-serp-google-organic-task_get-advanced.json
// is exactly that: `asynchronous_ai_overview: true`, markdown null).
//
// NO OVERVIEW IS NOT "NOT MENTIONED". Google shows an AI Overview for some
// queries and not others. A SERP without one comes back as an empty answer
// with emptyReason NO_AI_OVERVIEW: the call is metered (it was billed), then
// ports.ts refuses to score it and the run is recorded FAILED with that reason
// — never scored as an answer in which the brand did not appear, which would
// be a finding we did not make.
//
// SHIPS OFF. The engine is runnable only with AI_ENGINE_GOOGLE_AI_OVERVIEWS=on
// (runner/providers.ts), so deploying this adapter does not start spending on
// every tenant whose tier lists the engine.

import "server-only";
import type { ApiResult } from "@/lib/dataforseo/client";
import { SERP } from "@/lib/dataforseo/endpoints";

// The switch (AI_ENGINE_GOOGLE_AI_OVERVIEWS=on) lives in runner/providers.ts,
// with the other pure gates the setup wizard reads.

/** DataForSEO location code for the search; 2840 is the United States. */
export const AIO_LOCATION_ENV = "AI_AIO_LOCATION_CODE";
export const AIO_LANGUAGE_ENV = "AI_AIO_LANGUAGE_CODE";
export const AIO_DEFAULT_LOCATION_CODE = 2840;
export const AIO_DEFAULT_LANGUAGE_CODE = "en";
/** What a check costs at list price, USD: the SERP, and the SERP plus the overview fee. */
export const AIO_LIST_COST_USD = { withoutOverview: 0.002, withOverview: 0.004 } as const;

/** Why a check has no answer when the SERP has no AI Overview. */
export const NO_AI_OVERVIEW = "Google showed no AI Overview for this prompt";

/** The DataForSEO task for one monitored question. */
export function aioTask(promptText: string, env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const location = Number(env[AIO_LOCATION_ENV]?.trim());
  return {
    keyword: promptText.slice(0, 700),
    location_code: Number.isInteger(location) && location > 0 ? location : AIO_DEFAULT_LOCATION_CODE,
    language_code: env[AIO_LANGUAGE_ENV]?.trim() || AIO_DEFAULT_LANGUAGE_CODE,
    device: "desktop",
    os: "windows",
    // One SERP: the overview sits at the top, and every further 10 results is
    // another base price.
    depth: 10,
    load_async_ai_overview: true,
  };
}

interface OverviewLink {
  url?: string | null;
}
interface OverviewElement {
  type?: string;
  text?: string | null;
  markdown?: string | null;
  links?: OverviewLink[] | null;
}
interface OverviewItem {
  type?: string;
  markdown?: string | null;
  items?: OverviewElement[] | null;
  references?: OverviewLink[] | null;
}
interface SerpResult {
  items?: OverviewItem[] | null;
}

export interface ParsedOverview {
  answer: string;
  sources: { url: string }[];
}

/**
 * The AI Overview in a SERP result, or null when there is none or it came back
 * empty. The item's own markdown when present, otherwise its elements'
 * markdown (or text) in order. Sources: the references, then any links inside
 * the elements, de-duplicated, http(s) only.
 */
export function parseAiOverview(result: unknown): ParsedOverview | null {
  const items = (result as SerpResult | null)?.items ?? [];
  const overview = items.find((item) => item?.type === "ai_overview");
  if (!overview) return null;

  const elements = overview.items ?? [];
  const answer = (
    overview.markdown?.trim() ||
    elements
      .map((el) => (el.markdown ?? el.text ?? "").trim())
      .filter(Boolean)
      .join("\n\n")
  ).trim();
  if (!answer) return null;

  const seen = new Set<string>();
  const sources: { url: string }[] = [];
  const links = [...(overview.references ?? []), ...elements.flatMap((el) => el.links ?? [])];
  for (const link of links) {
    const url = link?.url?.trim();
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    sources.push({ url });
  }
  return { answer, sources };
}

export interface AioAnswer extends ParsedOverview {
  /** What DataForSEO billed, from the envelope. */
  costUsd: number;
  /** Set, with an empty answer, when the SERP had no AI Overview. */
  emptyReason?: string;
}

/** A metered DataForSEO call bound to a tenant: postTrackingTask in production. */
export type SerpCall = (path: string, task: Record<string, unknown>) => Promise<ApiResult<unknown>>;

/**
 * The tenant-metered DataForSEO call, imported lazily (it pulls in Prisma).
 *
 * Recorded as feature "ai_tracking" (./tracking-calls.ts), not by its path:
 * through seoMeteredCallResult a serp/* call was filed as keyword_research,
 * drawing a search from the tenant's SEO allowance and spending its SEO data
 * budget for a check the scheduler made. The AI cap governs it instead.
 */
export function meteredSerpCall(tenantId: string): SerpCall {
  return async (path, task) => {
    const { postTrackingTask } = await import("./tracking-calls");
    return postTrackingTask<unknown>(tenantId, path, task);
  };
}

/**
 * Ask Google one monitored question and read its AI Overview.
 *
 * A SERP with no overview returns an empty answer and NO_AI_OVERVIEW rather
 * than throwing, so the caller meters what DataForSEO billed before refusing
 * to score it.
 */
export async function askAiOverview(
  promptText: string,
  call: SerpCall,
  env: NodeJS.ProcessEnv = process.env,
): Promise<AioAnswer> {
  const result = await call(SERP.organicLive, aioTask(promptText, env));
  const costUsd = result.billing.costUsd;
  const parsed = parseAiOverview(result.data);
  if (!parsed) return { answer: "", sources: [], costUsd, emptyReason: NO_AI_OVERVIEW };
  return { ...parsed, costUsd };
}
