import { PERF_SPECS, type PsiAudit, type PsiFacts } from "@/lib/crawl-rules";
import { sc, siteCtx, stored, type RuleCase } from "../harness";

function ctxWith(audits: Record<string, PsiAudit>, inpP75: number | null = null, capabilities = ["psi" as const]) {
  const c = siteCtx({ capabilities });
  const psi: PsiFacts = { strategy: "mobile", lighthouseVersion: "13.0.1", fetchedAt: "2026-11-01T00:00:00Z", audits, inpP75 };
  return { ...c, psi };
}
const audit = (score: number | null, value: number | null = null): PsiAudit => ({ score, value, display: null });

const cases: RuleCase[] = PERF_SPECS.flatMap((s): RuleCase[] => {
  const c = s.check;
  if (c.by === "inp") {
    return [
      sc(s.id, "field INP 350 ms", true, stored(), ctxWith({}, 350)),
      sc(s.id, "field INP 150 ms", false, stored(), ctxWith({}, 150)),
      sc(s.id, "no field data", false, stored(), ctxWith({}, null)),
    ];
  }
  const id = c.audits[c.audits.length - 1]!;
  if (c.by === "score") {
    return [
      sc(s.id, `${id} scores 0.4`, true, stored(), ctxWith({ [id]: audit(0.4) })),
      sc(s.id, `${id} passes at 0.9`, false, stored(), ctxWith({ [id]: audit(0.9) })),
      sc(s.id, "audit absent from the run", false, stored(), ctxWith({})),
      sc(s.id, "no psi capability", false, stored(), ctxWith({ [id]: audit(0) }, null, [])),
    ];
  }
  return [
    sc(s.id, `${id} over the limit`, true, stored(), ctxWith({ [id]: audit(0.2, c.limit * 2) })),
    sc(s.id, `${id} at the limit`, false, stored(), ctxWith({ [id]: audit(0.9, c.limit) })),
  ];
});

// First listed id wins when a run reports both a classic audit and its insight.
cases.push(
  sc("performance.render_blocking_resources", "classic audit passes, insight ignored", false, stored(),
    ctxWith({ "render-blocking-resources": audit(1), "render-blocking-insight": audit(0) })),
);

export default cases;
