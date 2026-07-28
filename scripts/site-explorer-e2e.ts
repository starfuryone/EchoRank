/**
 * Site Explorer end-to-end: normalize -> quota -> four live DataForSEO calls
 * -> persisted analysis. Runs the REAL service code, not a simulation.
 *
 * Two modes:
 *
 *   # Live. Costs one full analysis (four billed calls). DATAFORSEO_RECORD=1
 *   # also writes fixtures/dataforseo/*.json for all four endpoints.
 *   DATAFORSEO_RECORD=1 npx tsx scripts/site-explorer-e2e.ts <tenantId> <domain>
 *
 *   # Replay. Zero spend, zero network — same flow off the recorded fixtures.
 *   DATAFORSEO_FIXTURES=1 npx tsx scripts/site-explorer-e2e.ts <tenantId> <domain>
 *
 * Replay note: the 24 h cache would short-circuit a second run for the same
 * domain, so replay mode clears the tenant's prior rows for that domain first.
 * Live mode deliberately does NOT — hitting the cache is a valid (free) result
 * and the script reports it as such.
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { normalizeDomain } from "@/lib/site-explorer/domain";
import { runAnalysis, DEFAULT_LANGUAGE_CODE, DEFAULT_LOCATION_CODE } from "@/lib/site-explorer/service";
import { fixturesEnabled } from "@/lib/dataforseo/fixtures";
import { siteExplorerAnalysesUsed, siteExplorerLimit } from "@/lib/site-explorer/quota";

async function main() {
  const [tenantId, domainArg] = process.argv.slice(2);
  if (!tenantId) {
    console.error("usage: npx tsx scripts/site-explorer-e2e.ts <tenantId> [domain]");
    process.exit(1);
  }
  const domain = normalizeDomain(domainArg ?? "echorank360.com");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, planType: true },
  });
  if (!tenant) throw new Error(`No tenant ${tenantId}`);

  const replay = fixturesEnabled();
  console.log(
    `[e2e] ${replay ? "REPLAY (fixtures, $0.00)" : "LIVE (4 billed calls)"} — ` +
      `tenant ${tenant.name} (${tenant.planType}), domain "${domain}"`,
  );

  if (replay) {
    const cleared = await prisma.siteExplorerAnalysis.deleteMany({ where: { tenantId, domain } });
    if (cleared.count) console.log(`[e2e] cleared ${cleared.count} prior row(s) so the cache misses`);
  }

  const startedAt = process.hrtime.bigint();
  const { analysis, cached } = await runAnalysis(tenantId, tenant.planType, {
    domain,
    locationCode: DEFAULT_LOCATION_CODE,
    languageCode: DEFAULT_LANGUAGE_CODE,
  });
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  if (cached) {
    console.log(
      `[e2e] cache hit — analysis ${analysis.id}, nothing called, nothing spent. ` +
        `Re-run available in ${Math.ceil((analysis.reRunAvailableInMs ?? 0) / 3_600_000)}h.`,
    );
  }

  console.log("─".repeat(72));
  console.log(`id            ${analysis.id}`);
  console.log(`domain        ${analysis.domain} (${analysis.locationCode}/${analysis.languageCode})`);
  console.log(`status        ${analysis.status}`);
  console.log(`costUsd       ${analysis.costUsd.toFixed(6)}${cached ? " (stored run)" : ""}`);
  console.log(`elapsed       ${elapsedMs.toFixed(0)} ms`);
  console.log(`failed        ${analysis.failedSections.join(", ") || "none"}`);

  const o = analysis.overview;
  console.log(
    `overview      ${o ? `etv ${o.etv.toFixed(1)} · ${o.keywordCount} keywords · #1×${o.distribution.pos1}` : "—"}`,
  );
  const k = analysis.rankedKeywords;
  console.log(`keywords      ${k ? `${k.items.length} rows of ${k.totalCount} total` : "—"}`);
  if (k?.items.length) {
    for (const row of k.items.slice(0, 3)) {
      console.log(`              #${row.position} "${row.keyword}" vol ${row.searchVolume} etv ${row.etv.toFixed(1)}`);
    }
  }
  const c = analysis.competitors;
  console.log(`competitors   ${c ? `${c.items.length} rows` : "—"}`);
  if (c?.items.length) {
    for (const row of c.items.slice(0, 3)) {
      console.log(`              ${row.domain} · ${row.intersections} shared · avg ${row.avgPosition.toFixed(1)}`);
    }
  }
  const b = analysis.backlinks;
  console.log(
    `backlinks     ${b ? `${b.backlinks} links · ${b.referringDomains} domains · rank ${b.rank} · ${b.brokenBacklinks} broken` : "—"}`,
  );
  if (b?.dofollowRatio !== null && b?.dofollowRatio !== undefined) {
    console.log(`              dofollow ${(b.dofollowRatio * 100).toFixed(1)}%`);
  }

  const used = await siteExplorerAnalysesUsed(tenantId);
  console.log(`quota         ${used} of ${siteExplorerLimit(tenant.planType)} used this month`);

  const spend = await prisma.siteExplorerAnalysis.aggregate({
    _sum: { costUsd: true },
    where: { tenantId },
  });
  console.log(`tenant spend  $${Number(spend._sum.costUsd ?? 0).toFixed(6)} (all analyses)`);

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
    for (const call of calls) {
      console.log(`  ${call.ok ? "ok  " : "fail"} $${Number(call.costUsd).toFixed(6)}  ${call.path}`);
    }
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
