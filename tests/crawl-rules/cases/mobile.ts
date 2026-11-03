import { doc, page, pc, rc, withRender, type RuleCase } from "../harness";

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
];

export default cases;
