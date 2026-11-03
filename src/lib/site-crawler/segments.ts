// src/lib/site-crawler/segments.ts
//
// Segments (Phase 4b): named slices of one site, saved per tenant + host in
// crawl_segments and snapshotted into a crawl's config.segments when it is
// created. Each page is matched against every segment once, inline at crawl
// time, and stores the indexes it fell in (crawl_pages.segmentIds). A page
// can sit in several segments, or none.
//
// One rule per segment:
//   urlPattern      a glob or /regex/ (the include/exclude syntax) on the URL
//   extractorValue  extractor #index returned a value equal to `equals`
//                   (trimmed, case-insensitive)
//   depthMax        crawl depth ≤ max
//   statusClass     2xx / 3xx / 4xx / 5xx, or "none" (no response)
//
// DEPENDENCY-FREE (zod + crawl-config's pattern compiler): the Configuration
// section is a Client Component and validates as it edits.

import { z } from "zod";
import { compilePattern } from "./crawl-config";

export const STATUS_CLASSES = ["2xx", "3xx", "4xx", "5xx", "none"] as const;
export type StatusClass = (typeof STATUS_CLASSES)[number];

export const SEGMENT_NAME_CHARS = 60;

export const SegmentRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("urlPattern"), pattern: z.string().trim().min(1).max(200) }),
  z.object({
    kind: z.literal("extractorValue"),
    index: z.number().int().min(0).max(49),
    equals: z.string().trim().min(1).max(500),
  }),
  z.object({ kind: z.literal("depthMax"), max: z.number().int().min(0).max(100) }),
  z.object({ kind: z.literal("statusClass"), cls: z.enum(STATUS_CLASSES) }),
]);
export type SegmentRule = z.infer<typeof SegmentRuleSchema>;

export const SegmentDefSchema = z.object({
  name: z.string().trim().min(1).max(SEGMENT_NAME_CHARS),
  rule: SegmentRuleSchema,
});
export type SegmentDef = z.infer<typeof SegmentDefSchema>;

/** What a segment rule can see of a page. */
export interface SegmentPage {
  url: string;
  depth: number;
  statusCode: number | null;
  /** Extracted values by extractor index; missing = nothing extracted. */
  extracted: ReadonlyMap<number, readonly string[]>;
}

/** Null when the rule can run; otherwise why not (a pattern that does not compile). */
export function segmentRuleProblem(rule: SegmentRule): string | null {
  if (rule.kind !== "urlPattern") return null;
  const c = compilePattern(rule.pattern);
  return c.ok ? null : c.reason;
}

export function statusClassOf(status: number | null): StatusClass | null {
  if (status === null) return "none";
  if (status >= 200 && status < 600) return `${Math.floor(status / 100)}xx` as StatusClass;
  return null;
}

/**
 * Compile a crawl's segments into one function: page → the indexes it falls
 * in. A segment whose rule does not compile matches nothing.
 */
export function segmentMatcher(defs: readonly SegmentDef[]): (page: SegmentPage) => number[] {
  const tests = defs.map(({ rule }): ((p: SegmentPage) => boolean) => {
    switch (rule.kind) {
      case "urlPattern": {
        const c = compilePattern(rule.pattern);
        return c.ok ? (p) => c.test(p.url) : () => false;
      }
      case "extractorValue": {
        const want = rule.equals.trim().toLowerCase();
        return (p) => (p.extracted.get(rule.index) ?? []).some((v) => v.trim().toLowerCase() === want);
      }
      case "depthMax":
        return (p) => p.depth <= rule.max;
      case "statusClass":
        return (p) => statusClassOf(p.statusCode) === rule.cls;
    }
  });
  return (page) => tests.flatMap((t, i) => (t(page) ? [i] : []));
}

/** The `segment` CSV cell: the names of the segments a page is in, "; "-joined. */
export function segmentCell(ids: readonly number[] | null | undefined, defs: readonly SegmentDef[]): string {
  return (ids ?? []).flatMap((i) => (defs[i] ? [defs[i]!.name] : [])).join("; ");
}

/** A `segment` query parameter as an index into the crawl's segments, or null for none / out of range. */
export function parseSegmentParam(raw: string | null, defs: readonly SegmentDef[] | undefined): number | null {
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < (defs?.length ?? 0) ? n : null;
}
