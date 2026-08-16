// src/lib/assistant/scan.ts
//
// The one way the public assistant learns anything about a website.
//
// IT CALLS THE SIDECAR. It does not fetch, parse or audit anything itself. The
// av-visibility service already owns the fetcher, the robots parser, the JSON-LD
// extractor and the scoring — a second implementation in the app would disagree
// with the paid product about the same site within a release or two, which is
// the argument the sidecar's own /grade endpoint is built on.
//
// CACHE FIRST, ALWAYS. A scan is a real HTTP fetch against somebody else's
// server and it is the only expensive thing an anonymous visitor can trigger, so
// the shared Redis entry is consulted before the limiter is touched and before
// the sidecar is called. Two visitors asking about the same domain on the same
// day buy one scan between them, and the second one does not spend an allowance
// for it.

import { guardCheckUrl } from "@/lib/bot-analytics/url-guard";
import { registrableDomain } from "@/lib/registrable-domain";
import { sidecarPost } from "@/lib/av-sidecar";
import { logger } from "@/infrastructure/observability/logger";
import { ONE_DAY, TurnCache, cacheKey, getOrCompute } from "./cache";
import { summarize, type HeuristicSummary, type SidecarAudit } from "./heuristics";

/**
 * Bump when the heuristic layer changes what a cached entry means.
 *
 * The cached value is the RAW sidecar audit, not the derived findings, so a
 * pure heuristics change does not strictly need a bump — but a change to what
 * we ask the sidecar for does, and one version knob is easier to reason about
 * than two. It is part of the key, so a bump is a clean cutover with no flush.
 */
export const AUDIT_VERSION = "v1";

/** The sidecar fetches a page; give it room without hanging the request. */
const SCAN_TIMEOUT_MS = 25_000;

export type ScanDenial = "invalid_domain" | "unreachable" | "refused";

export interface ScanOk {
  ok: true;
  domain: string;
  summary: HeuristicSummary;
  /** True when nothing was bought — no allowance should be consumed. */
  cached: boolean;
}

export interface ScanFailed {
  ok: false;
  reason: ScanDenial;
}

export type ScanResult = ScanOk | ScanFailed;

/**
 * The caller's answer to "may I spend for this scan?".
 *
 * A boolean would collapse "you are out of runs today" into "we could not reach
 * the site", and those are different messages to a visitor — one is a reason to
 * sign up, the other is a reason to try again.
 */
export interface SpendDecision {
  ok: boolean;
}

/**
 * Normalize a visitor-supplied domain, or reject it.
 *
 * The shared SSRF guard first: this is the one place a stranger's string becomes
 * a URL the sidecar will fetch. It refuses IP literals, private ranges, odd
 * ports, credentials in the URL and non-http schemes. Then the registrable
 * domain, so example.com and www.example.com share one cache entry rather than
 * buying the same answer twice.
 */
export function normalizeTarget(raw: string): { url: string; domain: string } | null {
  const guarded = guardCheckUrl(raw);
  if (!guarded.ok || !guarded.url) return null;
  const domain = registrableDomain(guarded.url);
  if (!domain || !domain.includes(".")) return null;
  return { url: guarded.url, domain };
}

/**
 * Scan a domain, or serve the shared cached answer.
 *
 * `spend` is called ONLY when a live sidecar call is about to happen; it returns
 * false to refuse (out of allowance, budget stop). Passing the decision in as a
 * callback is what keeps a cache hit free for the visitor — the alternative,
 * consuming first and refunding on a hit, is how a cached answer starts costing
 * somebody their daily quota.
 */
export async function scanDomain(
  turn: TurnCache,
  raw: string,
  spend: () => Promise<SpendDecision>,
): Promise<ScanResult> {
  const target = normalizeTarget(raw);
  if (!target) return { ok: false, reason: "invalid_domain" };

  const key = cacheKey("audit", target.domain, AUDIT_VERSION);

  // Set only when the spend gate refused, so the caller can tell "out of runs"
  // apart from "the site did not answer".
  let refused = false;

  const result = await getOrCompute<SidecarAudit>(turn, key, ONE_DAY, async () => {
    const decision = await spend();
    if (!decision.ok) {
      refused = true;
      return null;
    }

    const res = await sidecarPost<SidecarAudit>(
      "/audit",
      // crawl=false matches the free tier: one page fetch, not a site walk.
      { url: target.url, crawl: false },
      { timeoutMs: SCAN_TIMEOUT_MS },
    );

    if (res.status !== 200 || !res.data || res.data.error) {
      logger.warn({ status: res.status, domain: target.domain }, "assistant scan refused");
      return null;
    }
    return res.data;
  });

  if (!result) return { ok: false, reason: refused ? "refused" : "unreachable" };

  const summary = summarize(result.value);
  if (!summary) return { ok: false, reason: "unreachable" };

  return { ok: true, domain: target.domain, summary, cached: result.cached };
}
