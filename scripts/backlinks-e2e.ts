/**
 * Backlinks end-to-end: normalize -> plan gate -> quota -> five live calls ->
 * persisted analysis. Runs the REAL service code, not a simulation.
 *
 *   # Live. Costs one full analysis (five billed calls). DATAFORSEO_RECORD=1
 *   # also writes fixtures/dataforseo/*.json for all five endpoints.
 *   DATAFORSEO_RECORD=1 npx tsx scripts/backlinks-e2e.ts <tenantId> <target> [mode]
 *
 *   # Replay. Zero spend, zero network — same flow off the recorded fixtures.
 *   DATAFORSEO_FIXTURES=1 npx tsx scripts/backlinks-e2e.ts <tenantId> <target> [mode]
 *
 * mode is "domain" (default) or "exact_url".
 *
 * Replay note: the 24 h cache would short-circuit a second run for the same
 * target, so replay mode clears the tenant's prior rows for it first. Live mode
 * deliberately does NOT — hitting the cache is a valid (free) result and the
 * script reports it as such.
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { fixturesEnabled } from "@/lib/dataforseo/fixtures";
import { normalizeTarget, type BacklinksMode } from "@/lib/backlinks/target";
import { runAnalysis } from "@/lib/backlinks/service";
import { backlinksAnalysesUsed } from "@/lib/backlinks/quota";
import { backlinksAnalysisLimit } from "@/lib/backlinks/options";

async function main() {
  const [tenantId, targetArg, modeArg] = process.argv.slice(2);
  if (!tenantId || !targetArg) {
    console.error("usage: npx tsx scripts/backlinks-e2e.ts <tenantId> <target> [domain|exact_url]");
    process.exit(1);
  }
  const mode = (modeArg === "exact_url" ? "exact_url" : "domain") as BacklinksMode;
  const target = normalizeTarget(targetArg, mode);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, planType: true },
  });
  if (!tenant) throw new Error(`No tenant ${tenantId}`);

  const replay = fixturesEnabled();
  console.log(
    `[e2e] ${replay ? "REPLAY (fixtures, $0.00)" : "LIVE (5 billed calls)"} — ` +
      `tenant ${tenant.name} (${tenant.planType}), target "${target}" (${mode})`,
  );

  if (replay) {
    const cleared = await prisma.backlinksAnalysis.deleteMany({
      where: { tenantId, target, mode },
    });
    if (cleared.count) console.log(`[e2e] cleared ${cleared.count} prior row(s) so the cache misses`);
  }

  const startedAt = process.hrtime.bigint();
  const { analysis, cached } = await runAnalysis(tenantId, tenant.planType, { target, mode });
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  if (cached) {
    console.log(
      `[e2e] cache hit — analysis ${analysis.id}, nothing called, nothing spent. ` +
        `Re-run available in ${Math.ceil((analysis.reRunAvailableInMs ?? 0) / 3_600_000)}h.`,
    );
  }

  console.log("─".repeat(72));
  console.log(`id            ${analysis.id}`);
  console.log(`target        ${analysis.target} (${analysis.mode})`);
  console.log(`status        ${analysis.status}`);
  console.log(`costUsd       ${analysis.costUsd.toFixed(6)}${cached ? " (stored run)" : ""}`);
  console.log(`elapsed       ${elapsedMs.toFixed(0)} ms`);
  console.log(`failed        ${analysis.failedSections.join(", ") || "none"}`);

  const s = analysis.summary;
  console.log(
    `summary       ${s ? `${s.backlinks} links · ${s.referringDomains} domains · rank ${s.rank} · ${s.brokenBacklinks} broken` : "—"}`,
  );
  if (s?.dofollowRatio != null) {
    console.log(`              dofollow ${(s.dofollowRatio * 100).toFixed(1)}% of domains · spam ${s.spamScore ?? "—"}`);
  }

  const h = analysis.history;
  console.log(`history       ${h ? `${h.points.length} month(s)` : "—"}`);
  if (h?.points.length) {
    const first = h.points[0];
    const last = h.points[h.points.length - 1];
    console.log(`              ${first.month}: ${first.backlinks} -> ${last.month}: ${last.backlinks}`);
  }

  const rd = analysis.referringDomains;
  console.log(`ref domains   ${rd ? `${rd.items.length} of ${rd.totalCount}` : "—"}`);
  for (const row of rd?.items.slice(0, 3) ?? []) {
    console.log(`              ${row.domain} · rank ${row.rank} · ${row.backlinks} links`);
  }

  const a = analysis.anchors;
  console.log(`anchors       ${a ? `${a.items.length} of ${a.totalCount} (max ${a.maxBacklinks})` : "—"}`);
  for (const row of a?.items.slice(0, 3) ?? []) {
    console.log(`              "${row.anchor || "(no text)"}" · ${row.backlinks} links`);
  }

  const p = analysis.pages;
  console.log(`pages         ${p ? `${p.items.length} of ${p.totalCount}` : "—"}`);
  for (const row of p?.items.slice(0, 3) ?? []) {
    console.log(`              ${row.url} · ${row.backlinks} links`);
  }

  console.log(
    `quota         ${await backlinksAnalysesUsed(tenantId)} of ${backlinksAnalysisLimit(tenant.planType)} used this month`,
  );

  // Per-call breakdown straight from the metering ledger, so the reported cost
  // per analysis is the billed figure and not an inference.
  const calls = await prisma.seoApiCall.findMany({
    where: { tenantId, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    orderBy: { createdAt: "asc" },
    select: { path: true, costUsd: true, ok: true },
  });
  if (calls.length) {
    console.log("─".repeat(72));
    console.log("billed calls in the last 10 min (SeoApiCall ledger):");
    let total = 0;
    for (const call of calls) {
      total += Number(call.costUsd);
      console.log(`  ${call.ok ? "ok  " : "fail"} $${Number(call.costUsd).toFixed(6)}  ${call.path}`);
    }
    console.log(`  total $${total.toFixed(6)}`);
  }
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
