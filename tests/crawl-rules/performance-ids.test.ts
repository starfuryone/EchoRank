// The performance rules' audit ids against what Lighthouse actually reports.
//
// fixtures/pagespeed/lighthouse-perf-audit-ids.json is taken from Lighthouse's
// own default config (12.8.2 and 13.6.0); the synthetic PSI responses beside
// it go through the real parser. A rule whose ids vanish from both majors, or
// a typo in an id, fails here instead of silently never firing.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MOBILE_USABILITY_AUDITS, PERF_SPECS, PSI_AUDIT_IDS } from "@/lib/crawl-rules";
import { parseAuditVerdicts } from "@/lib/lighthouse/parse";

const FIX = join(process.cwd(), "fixtures/pagespeed");
const ids = JSON.parse(readFileSync(join(FIX, "lighthouse-perf-audit-ids.json"), "utf8")) as Record<string, string[]>;

describe("performance audit ids", () => {
  it("every id a rule reads exists in Lighthouse 12 or 13", () => {
    const known = new Set([...ids["12.8.2"]!, ...ids["13.6.0"]!]);
    expect(PSI_AUDIT_IDS.filter((i) => !known.has(i))).toEqual([]);
  });

  it("on Lighthouse 12 every audit-based rule has an id", () => {
    const v12 = new Set(ids["12.8.2"]);
    const missing = PERF_SPECS.filter((s) => s.check.by !== "inp" && !s.check.audits.some((a) => v12.has(a))).map((s) => s.id);
    expect(missing).toEqual([]);
  });

  it("on Lighthouse 13 exactly these four lose their audit (Lighthouse dropped them)", () => {
    const v13 = new Set(ids["13.6.0"]);
    const missing = PERF_SPECS.filter((s) => s.check.by !== "inp" && !s.check.audits.some((a) => v13.has(a))).map((s) => s.id);
    expect(missing.sort()).toEqual([
      "performance.next_gen_image_formats",
      "performance.offscreen_images",
      "performance.properly_size_images",
      "performance.text_compression",
    ]);
  });

  it("the parser keeps exactly the audits the rules read, from a recorded response", () => {
    const raw = JSON.parse(readFileSync(join(FIX, "__synthetic__-with-crux-mobile.json"), "utf8"));
    const verdicts = parseAuditVerdicts(raw);
    // Phase 4d adds the mobile usability audits mobile.lighthouse_usability_low reads.
    expect(Object.keys(verdicts).every((k) => PSI_AUDIT_IDS.includes(k) || (MOBILE_USABILITY_AUDITS as readonly string[]).includes(k))).toBe(true);
    expect(verdicts["largest-contentful-paint"]).toEqual({ score: 0.48, value: 3104.8, display: expect.anything() });
    expect(verdicts["render-blocking-resources"]?.score).toBe(0.41);
    expect(verdicts).toHaveProperty("viewport");
  });
});
