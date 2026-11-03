// performance — 25 Lighthouse audits as opportunity rules (Phase 3c).
//
// Site scope: the consumer attaches a Lighthouse run per page (ctx.psi) at
// aggregation time; no rule here fetches anything. The crawler attaches runs
// the tenant already made with its Lighthouse tool, so a crawl spends no PSI
// quota of its own.
//
// AUDIT IDS. Lighthouse 12 reports the classic audits ("render-blocking-
// resources"); Lighthouse 13 folded many into insights ("render-blocking-
// insight") and dropped others. Each rule lists every id that answers its
// question, first match wins, so one registry reads both. A rule whose ids are
// all absent from a run does not fire: Lighthouse no longer measures it.
// tests/crawl-rules/performance-ids.test.ts pins the lists against recorded
// PSI fixtures.
//
// Score-based rules fail below PASS_SCORE, Lighthouse's own pass line. Metric
// rules compare numericValue to Google's "good" thresholds.

import { ev, siteRule } from "../engine";
import type { PsiFacts, Rule } from "../types";

const F = "performance" as const;
const PSI = ["psi" as const];

export const PASS_SCORE = 0.9;

type Check =
  | { by: "score"; audits: string[] }
  | { by: "over"; audits: string[]; limit: number; unit: "ms" | "" }
  | { by: "inp"; limit: number };

interface PerfSpec {
  id: string;
  priority: "high" | "medium" | "low";
  check: Check;
}

const score = (...audits: string[]): Check => ({ by: "score", audits });
const over = (audit: string, limit: number, unit: "ms" | "" = "ms"): Check => ({ by: "over", audits: [audit], limit, unit });

export const PERF_SPECS: readonly PerfSpec[] = [
  { id: "performance.render_blocking_resources", priority: "high", check: score("render-blocking-resources", "render-blocking-insight") },
  { id: "performance.unused_css", priority: "medium", check: score("unused-css-rules") },
  { id: "performance.unused_javascript", priority: "medium", check: score("unused-javascript") },
  { id: "performance.unminified_css", priority: "low", check: score("unminified-css") },
  { id: "performance.unminified_javascript", priority: "low", check: score("unminified-javascript") },
  { id: "performance.unsized_images", priority: "medium", check: score("unsized-images") },
  { id: "performance.offscreen_images", priority: "medium", check: score("offscreen-images") },
  { id: "performance.efficiently_encode_images", priority: "medium", check: score("uses-optimized-images", "image-delivery-insight") },
  { id: "performance.properly_size_images", priority: "medium", check: score("uses-responsive-images") },
  { id: "performance.next_gen_image_formats", priority: "low", check: score("modern-image-formats") },
  { id: "performance.text_compression", priority: "high", check: score("uses-text-compression") },
  { id: "performance.efficient_cache_policy", priority: "medium", check: score("uses-long-cache-ttl", "cache-insight") },
  { id: "performance.multiple_redirects", priority: "high", check: score("redirects") },
  { id: "performance.server_response_over_600ms", priority: "high", check: over("server-response-time", 600) },
  { id: "performance.preconnect_required_origins", priority: "low", check: score("uses-rel-preconnect", "network-dependency-tree-insight") },
  { id: "performance.excessive_dom_size", priority: "medium", check: score("dom-size", "dom-size-insight") },
  { id: "performance.javascript_execution_time", priority: "medium", check: score("bootup-time") },
  { id: "performance.main_thread_work", priority: "medium", check: score("mainthread-work-breakdown") },
  { id: "performance.large_network_payload", priority: "medium", check: score("total-byte-weight") },
  { id: "performance.lcp_over_2_5s", priority: "high", check: over("largest-contentful-paint", 2500) },
  { id: "performance.cls_over_0_1", priority: "high", check: over("cumulative-layout-shift", 0.1, "") },
  { id: "performance.inp_over_200ms", priority: "high", check: { by: "inp", limit: 200 } },
  { id: "performance.fcp_over_1_8s", priority: "medium", check: over("first-contentful-paint", 1800) },
  { id: "performance.tbt_over_200ms", priority: "medium", check: over("total-blocking-time", 200) },
  { id: "performance.speed_index_over_3_4s", priority: "low", check: over("speed-index", 3400) },
];

/** Every audit id a rule reads: what a consumer needs to keep from a PSI response. */
export const PSI_AUDIT_IDS: readonly string[] = [
  ...new Set(PERF_SPECS.flatMap((s) => (s.check.by === "inp" ? [] : s.check.audits))),
];

function evaluate(check: Check, psi: PsiFacts) {
  if (check.by === "inp") {
    return psi.inpP75 !== null && psi.inpP75 > check.limit ? ev({ inpP75: psi.inpP75, source: "crux" }) : null;
  }
  const id = check.audits.find((a) => a in psi.audits);
  if (!id) return null;
  const a = psi.audits[id]!;
  const base = { audit: id, strategy: psi.strategy, lighthouse: psi.lighthouseVersion };
  if (check.by === "score") {
    return a.score !== null && a.score < PASS_SCORE ? ev({ ...base, score: a.score, display: a.display }) : null;
  }
  return a.value !== null && a.value > check.limit ? ev({ ...base, value: a.value, display: a.display }) : null;
}

export const RULES: Rule[] = PERF_SPECS.map((s) =>
  siteRule({
    id: s.id,
    family: F,
    kind: "opportunity",
    priority: s.priority,
    requires: PSI,
    detect: (_page, ctx) => (ctx.psi ? evaluate(s.check, ctx.psi) : null),
  }),
);
