// One positive and one negative per axe rule, generated from the same
// metadata the family is generated from. The sidecar's real axe output is
// covered end to end in av-service/tests/test_render.py.
import { AXE_RULES } from "@/lib/crawl-rules";
import { doc, page, pc, rc, withRender, type RuleCase } from "../harness";

const P = () => page(doc("<title>t</title>", "<h1>x</h1>"));
const html = doc("<title>t</title>", "<h1>x</h1>");
const id = (axeId: string) => `accessibility.${axeId.replace(/-/g, "_")}`;

const cases: RuleCase[] = AXE_RULES.flatMap((m) => [
  rc(id(m.axeId), "axe reports it", true, withRender(P(), html, { axe: { [m.axeId]: { impact: m.impact, nodes: 3 } } }), { elements: 3 }),
  rc(id(m.axeId), "axe passes", false, withRender(P(), html, { axe: { other: { impact: "minor", nodes: 1 } } })),
]);

// Not rendered, or axe ran out of budget: nothing fires.
cases.push(pc(id("image-alt"), "not rendered", false, P()));
cases.push(rc(id("image-alt"), "axe did not run", false, withRender(P(), html, { axe: null })));

export default cases;
