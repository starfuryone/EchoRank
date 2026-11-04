import type { PsiAudit, PsiFacts } from "@/lib/crawl-rules";
import { doc, page, pc, rc, sc, siteCtx, stored, withRender, type RuleCase } from "../harness";

const lh = (audits: Record<string, PsiAudit>, strategy: "mobile" | "desktop" = "mobile", capabilities: ("psi")[] = ["psi"]) => {
  const psi: PsiFacts = { strategy, lighthouseVersion: "13.0.1", fetchedAt: "2026-11-01T00:00:00Z", audits, inpP75: null };
  return { ...siteCtx({ capabilities }), psi };
};
const a = (score: number | null): PsiAudit => ({ score, value: null, display: null });

const P = () => page(doc("<title>t</title>", "<h1>x</h1>"));
const R = (over: Parameters<typeof withRender>[2]) => withRender(P(), doc("<title>t</title>", "<h1>x</h1>"), over);

const cases: RuleCase[] = [
  rc("mobile.content_wider_than_viewport", "2000 px wide", true, R({ viewport: { width: 412, scrollWidth: 2000 } }), { contentWidth: 2000 }),
  rc("mobile.content_wider_than_viewport", "1 px rounding", false, R({ viewport: { width: 412, scrollWidth: 413 } })),
  rc("mobile.content_wider_than_viewport", "measurement missing", false, R({ viewport: null })),
  pc("mobile.content_wider_than_viewport", "not rendered", false, P()),

  rc("mobile.font_too_small", "10 px body", true, R({ bodyFontPx: 10 }), { bodyFontPx: 10 }),
  rc("mobile.font_too_small", "12 px is the floor", false, R({ bodyFontPx: 12 })),

  rc("mobile.tap_targets_too_close", "crowded", true, R({ tapTargets: { checked: 30, tooClose: 4, sample: "Next" } }), { tooClose: 4 }),
  rc("mobile.tap_targets_too_close", "spaced", false, R({})),
  sc("mobile.lighthouse_usability_low", "mobile run fails viewport", true, stored(), lh({ viewport: a(0) })),
  sc("mobile.lighthouse_usability_low", "older Lighthouse: tap targets fail", true, stored(), lh({ viewport: a(1), "tap-targets": a(0.5) })),
  sc("mobile.lighthouse_usability_low", "mobile run passes", false, stored(), lh({ viewport: a(1) })),
  sc("mobile.lighthouse_usability_low", "desktop run only", false, stored(), lh({ viewport: a(0) }, "desktop")),
  sc("mobile.lighthouse_usability_low", "audit not scored", false, stored(), lh({ viewport: a(null) })),
  sc("mobile.lighthouse_usability_low", "no Lighthouse run attached", false, stored(), lh({ viewport: a(0) }, "mobile", [])),
];

export default cases;
