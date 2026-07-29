/**
 * Lighthouse end-to-end: validate -> cache -> limiter -> PageSpeed Insights ->
 * persisted audit. Runs the REAL service code, not a simulation.
 *
 *   # Live. Free — PSI charges nothing. PAGESPEED_RECORD=1 also writes the raw
 *   # response to fixtures/pagespeed/ so tests can replay it.
 *   PAGESPEED_RECORD=1 npx tsx scripts/lighthouse-e2e.ts <tenantId> <url> [mobile|desktop|both]
 *
 *   # Replay. Zero network — same flow off a recorded response.
 *   PAGESPEED_FIXTURES=1 npx tsx scripts/lighthouse-e2e.ts <tenantId> <url> [strategy]
 *
 * ⚠ THIS SCRIPT IS THE ONE TO RUN ONCE A PAGESPEED_API_KEY EXISTS. The feature
 * shipped with SYNTHETIC fixtures because Google's keyless daily quota was
 * exhausted and no key was configured, so the parser has never seen a real PSI
 * response. Recording one here and re-running the suite is what closes that
 * gap — see the provenance note at the top of tests/lighthouse-parse.test.ts.
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { hasApiKey, type PsiStrategy } from "@/lib/pagespeed/client";
import { fixturesEnabled } from "@/lib/pagespeed/fixtures";
import { normalizeAuditUrl } from "@/lib/lighthouse/url";
import { runAudit } from "@/lib/lighthouse/service";
import { auditsUsedThisHour } from "@/lib/lighthouse/usage";
import { AUDITS_PER_HOUR, metricBand, scoreBand } from "@/lib/lighthouse/options";

async function auditOne(tenantId: string, url: string, strategy: PsiStrategy) {
  const startedAt = process.hrtime.bigint();
  const { audit, cached } = await runAudit(tenantId, { url, strategy });
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  console.log("─".repeat(72));
  console.log(`strategy      ${strategy}${cached ? "  (cache hit — nothing re-run)" : ""}`);
  console.log(`id            ${audit.id}`);
  console.log(`url           ${audit.url}`);
  console.log(`elapsed       ${elapsedMs.toFixed(0)} ms`);
  console.log(`lighthouse    ${audit.lighthouseVersion ?? "—"}`);

  const s = audit.scores;
  const fmt = (label: string, v: number | null) =>
    `${label} ${v === null ? "—" : String(v).padStart(3)} (${scoreBand(v) ?? "n/a"})`;
  console.log(
    `scores        ${fmt("perf", s.performance)} · ${fmt("a11y", s.accessibility)} · ` +
      `${fmt("best", s.bestPractices)} · ${fmt("seo", s.seo)}`,
  );

  console.log("lab metrics:");
  for (const m of audit.metrics) {
    const band = metricBand(m.key, m.value);
    console.log(
      `  ${m.key.padEnd(4)} ${(m.display || "—").padEnd(10)} ${band ? `[${band}]` : ""}`,
    );
  }

  if (audit.crux) {
    console.log(
      `field data    overall ${audit.crux.overall}` +
        (audit.crux.originFallback ? " (origin-level fallback)" : ""),
    );
    for (const m of audit.crux.metrics) {
      console.log(`  ${m.key.padEnd(5)} p75 ${String(m.p75).padEnd(10)} ${m.category}`);
    }
  } else {
    console.log("field data    none — not enough real-user Chrome traffic for this page");
  }

  console.log(`opportunities ${audit.opportunities.length}`);
  for (const o of audit.opportunities.slice(0, 5)) {
    const saving =
      o.savingsMs > 0 ? `${(o.savingsMs / 1000).toFixed(1)}s` : `${(o.savingsBytes / 1024).toFixed(0)} KiB`;
    console.log(`  ${saving.padStart(8)}  ${o.title}`);
  }

  return audit;
}

async function main() {
  const [tenantId, urlArg, strategyArg] = process.argv.slice(2);
  if (!tenantId || !urlArg) {
    console.error(
      "usage: npx tsx scripts/lighthouse-e2e.ts <tenantId> <url> [mobile|desktop|both]",
    );
    process.exit(1);
  }
  const url = normalizeAuditUrl(urlArg);
  const strategies: PsiStrategy[] =
    strategyArg === "both" || !strategyArg
      ? ["mobile", "desktop"]
      : [strategyArg === "desktop" ? "desktop" : "mobile"];

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });
  if (!tenant) throw new Error(`No tenant ${tenantId}`);

  const replay = fixturesEnabled();
  console.log(
    `[e2e] ${replay ? "REPLAY (fixtures)" : "LIVE (PageSpeed Insights — free)"} — ` +
      `tenant ${tenant.name}, url "${url}", strategies: ${strategies.join(", ")}`,
  );
  console.log(
    `[e2e] PAGESPEED_API_KEY ${hasApiKey() ? "IS configured" : "is NOT configured (keyless — low shared quota)"}`,
  );

  if (replay) {
    const cleared = await prisma.lighthouseAudit.deleteMany({ where: { tenantId, url } });
    if (cleared.count) console.log(`[e2e] cleared ${cleared.count} prior row(s) so the cache misses`);
  }

  for (const strategy of strategies) {
    try {
      await auditOne(tenantId, url, strategy);
    } catch (err) {
      console.error(`[e2e] ${strategy} failed:`, err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  }

  console.log("─".repeat(72));
  console.log(`limiter       ${await auditsUsedThisHour(tenantId)} of ${AUDITS_PER_HOUR} audits this hour`);
  console.log("─".repeat(72));
}

main()
  .catch((err) => {
    console.error("[e2e] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
