/**
 * Dogfood: one real domain analysis for echorank360.com, and the report.
 *
 * SPENDS REAL MONEY — two DataForSEO Labs calls and up to thirty-one Haiku
 * calls, modelled at roughly $0.15 all in. Writes to the real database.
 *
 *   npx tsx scripts/dogfood-keyword-opportunity.ts preflight   # spends nothing
 *   npx tsx scripts/dogfood-keyword-opportunity.ts run         # SPENDS
 *   npx tsx scripts/dogfood-keyword-opportunity.ts report [id]
 *   npx tsx scripts/dogfood-keyword-opportunity.ts junk   [id]
 *   npx tsx scripts/dogfood-keyword-opportunity.ts delete <id>
 *
 * PREFLIGHT FIRST, ALWAYS. It resolves the tenant, checks the allowlist, checks
 * the cap headroom and confirms the tables exist — every reason this run could
 * fail except the providers themselves — and spends nothing doing it. The
 * watcher's dogfood script split cheap from expensive for the same reason.
 *
 * IT CALLS runAnalysis(), NOT ITS OWN PIPELINE. What runs here is exactly the
 * code path a customer's click produces, including the worker's cap handling
 * and its partial-AI-coverage behaviour. A script that reimplemented the steps
 * would prove only that the script works.
 *
 * `junk` is the review pass the brief asks for: it lists what the brand filter
 * and the classifier let through, so a human can decide. `delete` removes one
 * analysis and its children (the FKs cascade), as the watcher dogfood did.
 *
 * Must run as `echorank` or root — .env is 0600 and a run without it comes up
 * with no DATABASE_URL and no DataForSEO credentials.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { registrableDomain } from "@/lib/registrable-domain";
import { kofAllowlist, kofEnabledFor } from "@/lib/keyword-opportunity/rollout";
import { checkKofCap } from "@/lib/keyword-opportunity/metering";
import { entitlementFor } from "@/lib/keyword-opportunity/store";
import { runAnalysis } from "@/lib/keyword-opportunity/runner";
import { startAnalysis } from "@/lib/keyword-opportunity/start";
import { OPPORTUNITY_SCORE_VERSION } from "@/lib/keyword-opportunity/score";
import { isNoise } from "@/lib/keyword-opportunity/discover";
import { classifyIntentDetailed } from "@/lib/keyword-opportunity/intent";

const DOMAIN = "echorank360.com";

/** The dogfood project: the brand profile whose website is our own domain. */
async function resolveProject() {
  const profiles = await prisma.brandProfile.findMany({
    select: { id: true, tenantId: true, name: true, website: true, aliases: true },
  });
  const match = profiles.find(
    (profile) => profile.website && registrableDomain(profile.website) === DOMAIN,
  );
  return match ?? null;
}

async function preflight(): Promise<void> {
  const project = await resolveProject();
  if (!project) {
    console.error(`no brand profile whose website resolves to ${DOMAIN}`);
    process.exitCode = 1;
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: project.tenantId },
    select: { id: true, name: true, planType: true },
  });
  if (!tenant) {
    console.error("brand profile has no tenant");
    process.exitCode = 1;
    return;
  }

  const allowlisted = kofEnabledFor(tenant.id);
  const cap = await checkKofCap(tenant.id, tenant.planType);
  const entitlement = await entitlementFor(tenant.id, tenant.planType, DOMAIN);

  console.log(`tenant       ${tenant.name} (${tenant.id}) on ${tenant.planType}`);
  console.log(`project      ${project.name} -> ${DOMAIN}`);
  console.log(`aliases      ${[project.name, ...project.aliases].join(", ")}`);
  console.log(`allowlisted  ${allowlisted ? "YES" : "NO"}`);
  if (!allowlisted) {
    console.log(`             KOF_TENANT_IDS currently: ${[...kofAllowlist()].join(",") || "(empty)"}`);
    console.log(`             add ${tenant.id} and restart the workers before running`);
  }
  console.log(
    `kof cap      $${cap.spent.toFixed(4)} of ${cap.cap === null ? "uncapped" : `$${cap.cap}`}` +
      `${cap.capped ? "  ** CAPPED **" : ""}`,
  );
  console.log(
    `allowance    ${entitlement.allowanceRemaining ?? "unlimited"} of ${
      entitlement.allowanceTotal ?? "unlimited"
    } left, ${entitlement.credits} credits`,
  );
  console.log(`cache        ${entitlement.cacheHit ? "HIT — a run today would be free" : "miss"}`);

  // Proves the migration has been applied. A missing table here is the one
  // failure that would otherwise surface as a dead job in the queue.
  const analyses = await prisma.keywordOpportunityAnalysis.count();
  console.log(`tables       ok (${analyses} analyses on record)`);
}

async function run(): Promise<void> {
  const project = await resolveProject();
  if (!project) {
    console.error(`no brand profile for ${DOMAIN} — run preflight`);
    process.exitCode = 1;
    return;
  }
  if (!kofEnabledFor(project.tenantId)) {
    console.error(`tenant ${project.tenantId} is not in KOF_TENANT_IDS — refusing to spend`);
    process.exitCode = 1;
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: project.tenantId },
    select: { planType: true },
  });
  if (!tenant) {
    console.error("brand profile has no tenant");
    process.exitCode = 1;
    return;
  }

  // THROUGH startAnalysis(), LIKE THE ROUTE. This used to call createAnalysis()
  // directly, which skipped the cache probe and the entitlement decision — and
  // so paid for the same domain twice inside forty seconds while the preflight
  // command reported "cache HIT" correctly the whole time. The script is a
  // second entry point and had to behave like the first.
  const outcome = await startAnalysis({
    tenantId: project.tenantId,
    plan: tenant.planType,
    brandProfileId: project.id,
    domain: DOMAIN,
    scoreVersion: OPPORTUNITY_SCORE_VERSION,
  });

  if (outcome.kind === "denied") {
    console.error("no allowance and no credits — nothing was spent");
    process.exitCode = 1;
    return;
  }

  if (outcome.kind === "cached") {
    console.log(`CACHE HIT — served from ${outcome.sourceAnalysisId}, spent $0, consumed nothing`);
    console.log(`analysis ${outcome.analysisId} recorded as a cache hit`);
    console.log(`\nnext: npx tsx scripts/dogfood-keyword-opportunity.ts report ${outcome.analysisId}`);
    return;
  }

  const id = outcome.analysisId;
  console.log(`analysis ${id} queued (${outcome.funding}); running inline (the worker would do this)`);
  const summary = await runAnalysis(id);

  console.log(`status            ${summary.status}${summary.stoppedReason ? ` (${summary.stoppedReason})` : ""}`);
  console.log(`keywords scored   ${summary.keywordCount}`);
  if (summary.discovery) {
    const d = summary.discovery;
    console.log(
      `discovery funnel  keywords_for_site ${d.keywordsForSite} + ranked_keywords ${d.rankedKeywords} + tracked ${d.tracked}` +
        ` -> merged ${d.merged} -> after noise ${d.afterNoise} -> kept ${d.kept}`,
    );
  }
  console.log(`ai-tested         ${summary.aiTestedCount}`);
  console.log(`prompts generated ${summary.generatedPrompts} (rest used the fallback)`);
  console.log(`dropped for brand ${summary.droppedForBrand}`);
  console.log(`dataforseo        $${summary.dataforseoCostUsd.toFixed(4)}`);
  console.log(`haiku             $${summary.aiCostUsd.toFixed(4)}`);
  console.log(
    `total             $${(summary.dataforseoCostUsd + summary.aiCostUsd).toFixed(4)}  (modelled ~$0.15)`,
  );
  console.log(`\nnext: npx tsx scripts/dogfood-keyword-opportunity.ts report ${id}`);
}

async function latestId(): Promise<string | null> {
  const row = await prisma.keywordOpportunityAnalysis.findFirst({
    where: { domain: DOMAIN },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function report(argId?: string): Promise<void> {
  const id = argId ?? (await latestId());
  if (!id) {
    console.error("no analysis for this domain yet");
    process.exitCode = 1;
    return;
  }

  const analysis = await prisma.keywordOpportunityAnalysis.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      stoppedReason: true,
      error: true,
      keywordCount: true,
      aiTestedCount: true,
      costUsd: true,
      dataforseoCostUsd: true,
      aiCostUsd: true,
      allowanceConsumed: true,
      fundingSource: true,
      opportunities: {
        orderBy: [{ opportunityScore: "desc" }, { keyword: "asc" }],
        select: {
          keyword: true,
          monthlyVolume: true,
          cpcUsd: true,
          trendPercent: true,
          googleRank: true,
          rankSource: true,
          intent: true,
          opportunityScore: true,
          severity: true,
          aiTested: true,
          aiMentioned: true,
          aiAveragePosition: true,
          prompt: { select: { text: true, result: { select: { competitors: true } } } },
        },
      },
    },
  });

  if (!analysis) {
    console.error(`no analysis ${id}`);
    process.exitCode = 1;
    return;
  }

  console.log(`analysis ${analysis.id}  ${analysis.status}`);

  // THE FAILURE REASON COMES FIRST AND IS NEVER OMITTED.
  //
  // This block exists because the first dogfood run FAILED and this report said
  // nothing about why: it selected `stoppedReason` and not `error`, and a plain
  // failure sets `error` while leaving `stoppedReason` null — that column is
  // reserved for caps. So the one code path that was not a cap printed an empty
  // string. A FAILED report that hides the reason is half a report.
  if (analysis.status === "FAILED" || analysis.stoppedReason || analysis.error) {
    console.log("");
    if (analysis.stoppedReason) console.log(`  stoppedReason  ${analysis.stoppedReason}`);
    if (analysis.error) console.log(`  error          ${analysis.error}`);
    if (analysis.status === "FAILED" && !analysis.stoppedReason && !analysis.error) {
      // Should be unreachable: markFailed always writes one or the other.
      console.log("  (FAILED with neither stoppedReason nor error — that is a bug in markFailed)");
    }
    console.log("");
  }
  console.log(
    `cost  total $${Number(analysis.costUsd).toFixed(4)}  =  dataforseo $${Number(
      analysis.dataforseoCostUsd,
    ).toFixed(4)} + haiku $${Number(analysis.aiCostUsd).toFixed(4)}   (modelled ~$0.15)`,
  );
  console.log(
    `allowance consumed: ${analysis.allowanceConsumed} (${analysis.fundingSource ?? "n/a"})`,
  );

  const severities = { HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>;
  for (const row of analysis.opportunities) severities[row.severity] += 1;
  console.log(
    `\nseverity   HIGH ${severities.HIGH}   MEDIUM ${severities.MEDIUM}   LOW ${severities.LOW}   (of ${analysis.opportunities.length})`,
  );

  console.log(`\ntop 15 by score:`);
  for (const row of analysis.opportunities.slice(0, 15)) {
    const rank = row.googleRank === null ? `null/${row.rankSource ?? "?"}` : String(row.googleRank);
    const ai = !row.aiTested
      ? "untested"
      : row.aiMentioned
        ? `#${row.aiAveragePosition ?? "-"}`
        : "absent";
    console.log(
      `  ${String(row.opportunityScore).padStart(3)} ${row.severity.padEnd(6)} vol ${String(
        row.monthlyVolume,
      ).padStart(6)} cpc $${Number(row.cpcUsd).toFixed(2).padStart(6)} trend ${String(
        Math.round(row.trendPercent),
      ).padStart(5)}% rank ${rank.padEnd(14)} ai ${ai.padEnd(9)} ${row.intent.padEnd(24)} ${row.keyword}`,
    );
  }

  // Rival share across the answers, the same rollup the panel shows.
  const counts = new Map<string, number>();
  let answered = 0;
  for (const row of analysis.opportunities) {
    const stored = row.prompt?.result?.competitors;
    if (!Array.isArray(stored)) continue;
    answered += 1;
    for (const entry of stored as { name?: string; classification?: string }[]) {
      if (entry.classification !== "RIVAL" || !entry.name) continue;
      counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
    }
  }
  console.log(`\ncompetitors surfaced (share of ${answered} answers):`);
  for (const [name, count] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${String(Math.round((count / Math.max(1, answered)) * 100)).padStart(3)}%  ${name}`);
  }
}

/**
 * What the filters let through.
 *
 * Re-runs the brand filter and the intent classifier over the STORED rows. A
 * keyword flagged here is one a human should look at — either the filter has a
 * gap or the keyword is fine and the filter is right. The script does not
 * delete anything; `delete` is a separate, explicit command.
 */
async function junk(argId?: string): Promise<void> {
  const id = argId ?? (await latestId());
  if (!id) {
    console.error("no analysis for this domain yet");
    process.exitCode = 1;
    return;
  }

  const analysis = await prisma.keywordOpportunityAnalysis.findUnique({
    where: { id },
    select: {
      brandProfile: { select: { name: true, aliases: true } },
      opportunities: {
        select: {
          keyword: true,
          intent: true,
          opportunityScore: true,
          prompt: { select: { text: true, result: { select: { competitors: true } } } },
        },
      },
    },
  });
  if (!analysis) {
    console.error(`no analysis ${id}`);
    process.exitCode = 1;
    return;
  }

  const aliases = [analysis.brandProfile.name, ...analysis.brandProfile.aliases].filter((a) =>
    a?.trim(),
  );

  const branded = analysis.opportunities.filter((row) => isNoise(row.keyword, aliases));
  console.log(`branded/navigational keywords that survived discovery: ${branded.length}`);
  for (const row of branded) console.log(`  ${row.opportunityScore}  ${row.keyword}`);

  const defaulted = analysis.opportunities.filter(
    (row) => classifyIntentDetailed(row.keyword, null).source === "default",
  );
  console.log(`\nkeywords that fell through to the default intent: ${defaulted.length}`);
  for (const row of defaulted.slice(0, 20)) console.log(`  ${row.keyword}`);

  const namedBrand = analysis.opportunities.filter(
    (row) => row.prompt && isNoise(row.prompt.text, aliases),
  );
  console.log(`\nPROMPTS NAMING THE BRAND (must be zero): ${namedBrand.length}`);
  for (const row of namedBrand) console.log(`  ${row.prompt?.text}`);

  const nonRival = new Set<string>();
  for (const row of analysis.opportunities) {
    const stored = row.prompt?.result?.competitors;
    if (!Array.isArray(stored)) continue;
    for (const entry of stored as { name?: string; classification?: string }[]) {
      if (entry.classification !== "RIVAL" && entry.name) nonRival.add(`${entry.classification} ${entry.name}`);
    }
  }
  console.log(`\nentities the classifier excluded from the rival panel: ${nonRival.size}`);
  for (const entry of [...nonRival].sort().slice(0, 30)) console.log(`  ${entry}`);
}

async function remove(id: string): Promise<void> {
  if (!id) {
    console.error("delete needs an analysis id");
    process.exitCode = 1;
    return;
  }
  // Opportunities, prompts and results cascade from the analysis row.
  await prisma.keywordOpportunityAnalysis.delete({ where: { id } });
  console.log(`deleted ${id} and its children`);
}

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  switch (command) {
    case "preflight":
      return preflight();
    case "run":
      return run();
    case "report":
      return report(arg);
    case "junk":
      return junk(arg);
    case "delete":
      return remove(arg ?? "");
    default:
      console.error("usage: dogfood-keyword-opportunity.ts <preflight|run|report|junk|delete>");
      process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
