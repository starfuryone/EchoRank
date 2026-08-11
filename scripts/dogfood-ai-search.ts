/**
 * Dogfood: set up AI Search for our own product and run one real checkup.
 *
 * SPENDS REAL MONEY against the real Anthropic API and writes to the real
 * database. Explicitly authorised for this run. It is split into phases so the
 * cheap part can be inspected before the expensive part starts.
 *
 *   npx tsx scripts/dogfood-ai-search.ts setup     # 1 Haiku call
 *   npx tsx scripts/dogfood-ai-search.ts checkup   # the tier's full shape
 *   npx tsx scripts/dogfood-ai-search.ts report
 *   npx tsx scripts/dogfood-ai-search.ts teardown
 *
 * Uses the wizard's own functions and the worker's own runOne rather than raw
 * SQL, so what runs here is the code path a customer gets.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { planConfig } from "@/lib/plan-config";
import { suggestPrompts } from "@/lib/ai-monitor/wizard/suggest";
import { completeWizard } from "@/lib/ai-monitor/wizard/create";
import { brandVariations, normalizeDomain } from "@/lib/ai-monitor/wizard/validation";
import { wizardEngineOptions } from "@/lib/ai-monitor/wizard/engines";
import { costUsdFor } from "@/lib/ai-monitor/pricing";

const SLUG = "echorank360-dogfood";
const BRAND = "EchoRank360";
const DOMAIN = "echorank360.com";
const PLAN = "GROWTH" as const;

async function tenant() {
  const existing = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.tenant.create({
    data: { name: BRAND, slug: SLUG, planType: PLAN },
    select: { id: true },
  });
  return created.id;
}

async function setup() {
  const tenantId = await tenant();
  console.log("tenantId:", tenantId);
  console.log(
    "engines selectable:",
    wizardEngineOptions()
      .filter((e) => e.selectable)
      .map((e) => e.provider),
  );

  const domain = normalizeDomain(DOMAIN);
  if (!domain) throw new Error("domain failed validation");

  console.log("— suggesting prompts (1 metered Haiku call + 1 homepage fetch) —");
  const suggested = await suggestPrompts(
    {
      brand: BRAND,
      domain,
      industry: "AI search visibility and SEO software",
      competitors: ["Profound", "Peec AI", "Otterly"],
      language: "en",
    },
    { tenantId, plan: PLAN, shape: planConfig(PLAN).aiCheckup },
  );

  console.log("site read ok:", suggested.site.ok, "|", suggested.site.summary.slice(0, 120));
  console.log("capped:", suggested.capped, "| error:", suggested.error);
  console.log(`suggestions: ${suggested.suggestions.length} of limit ${suggested.limit}`);
  for (const s of suggested.suggestions) {
    console.log(`  [${s.score}] (${s.label ?? s.category}) ${s.text}`);
  }
  // The core product rule, checked against real output rather than a fixture.
  const naming = suggested.suggestions.filter((s) =>
    /echorank/i.test(s.text.replace(/\s+/g, "")),
  );
  console.log(`suggestions naming the brand: ${naming.length} (expected 0 outside BRAND_AWARENESS)`);
  naming.forEach((s) => console.log("   NAMES BRAND:", s.text));

  if (suggested.suggestions.length === 0) throw new Error("no suggestions; aborting");

  const result = await completeWizard(
    { tenantId, plan: PLAN },
    {
      brand: BRAND,
      domain,
      aliases: brandVariations(BRAND, ["EchoRank", "Echo Rank 360"]),
      engines: ["CLAUDE"],
      industry: "AI search visibility and SEO software",
      country: null,
      language: "en",
      competitors: ["Profound", "Peec AI", "Otterly"],
      prompts: suggested.suggestions.map((s) => ({
        text: s.text,
        category: s.category,
        intent: s.intent,
        audience: s.audience,
        suggestionScore: s.score,
        custom: false,
      })),
    },
  );
  console.log("wizard complete:", result);
  console.log("\nNEXT: add this tenant to AI_SEARCH_TENANT_IDS, then run `checkup`.");
}

async function checkup() {
  const tenantId = await tenant();
  const brand = await prisma.brandProfile.findFirstOrThrow({
    where: { tenantId },
    select: { id: true, name: true },
  });
  const shape = planConfig(PLAN).aiCheckup;
  console.log(`running: ${shape.prompts} prompts x reps ${shape.repetitions} on CLAUDE`);
  console.log("start:", new Date().toISOString());

  const worker = await import("@/infrastructure/queue/workers/ai-checkup.worker");
  await worker.__testing.runOne({ brandProfileId: brand.id, tenantId, manual: true }, new Date());

  console.log("end:", new Date().toISOString());
}

async function report() {
  const tenantId = await tenant();
  const brand = await prisma.brandProfile.findFirstOrThrow({
    where: { tenantId },
    select: { id: true, name: true },
  });

  const checkups = await prisma.checkup.findMany({
    where: { brandProfileId: brand.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      stoppedReason: true,
      startedAt: true,
      completedAt: true,
      promptCount: true,
      repetitions: true,
      providers: true,
    },
  });
  console.log("=== checkups ===");
  for (const c of checkups) {
    const secs =
      c.startedAt && c.completedAt
        ? Math.round((c.completedAt.getTime() - c.startedAt.getTime()) / 1000)
        : null;
    console.log(
      `${c.status} | ${c.promptCount}p x${c.repetitions} ${c.providers.join(",")} | ${secs}s | ${c.stoppedReason ?? "-"}`,
    );
  }

  const runs = await prisma.promptRun.groupBy({
    by: ["status"],
    where: { checkup: { brandProfileId: brand.id } },
    _count: true,
  });
  console.log("=== runs by status ===", runs.map((r) => `${r.status}:${r._count}`).join(" "));

  const calls = await prisma.aiProviderCall.findMany({
    where: { tenantId },
    select: {
      provider: true,
      model: true,
      purpose: true,
      inputTokens: true,
      outputTokens: true,
      costUsd: true,
      ok: true,
      error: true,
    },
  });
  const spend = calls.reduce((total, c) => total + Number(c.costUsd), 0);
  const byPurpose = new Map<string, { n: number; usd: number; in: number; out: number }>();
  for (const call of calls) {
    const key = `${call.purpose}:${call.model}`;
    const b = byPurpose.get(key) ?? { n: 0, usd: 0, in: 0, out: 0 };
    b.n += 1;
    b.usd += Number(call.costUsd);
    b.in += call.inputTokens;
    b.out += call.outputTokens;
    byPurpose.set(key, b);
  }
  console.log("=== metered spend ===");
  for (const [key, b] of byPurpose) {
    console.log(`  ${key}: ${b.n} calls, ${b.in} in / ${b.out} out, $${b.usd.toFixed(6)}`);
  }
  console.log(`  TOTAL: $${spend.toFixed(6)}  (cap $${planConfig(PLAN).aiMonthlyCapUsd})`);
  const failures = calls.filter((c) => !c.ok);
  console.log(`  failed calls: ${failures.length}`);
  failures.slice(0, 5).forEach((f) => console.log("   ", f.provider, f.model, f.error));

  // Would any call have metered at zero?
  const unpriced = calls.filter(
    (c) => !costUsdFor(c.provider as never, c.model, { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 }).priced,
  );
  console.log(`  unpriced-provider calls: ${unpriced.length}`);

  const metrics = await prisma.visibilityMetric.findMany({
    where: { brandProfileId: brand.id },
    select: {
      day: true,
      engine: true,
      scoreVersion: true,
      visibilityScore: true,
      mentionRate: true,
      top3Rate: true,
      averagePosition: true,
      sentimentScore: true,
      citationScore: true,
      recommendationScore: true,
      shareOfVoice: true,
      runCount: true,
      partialCoverage: true,
      skippedRuns: true,
    },
  });
  console.log("=== VisibilityMetric rows ===");
  console.log(JSON.stringify(metrics, null, 2));

  const mentioned = await prisma.promptRun.count({
    where: { checkup: { brandProfileId: brand.id }, brandMentioned: true },
  });
  const total = await prisma.promptRun.count({ where: { checkup: { brandProfileId: brand.id } } });
  console.log(`=== mentioned in ${mentioned} of ${total} runs ===`);

  const competitors = await prisma.competitorMention.groupBy({
    by: ["name"],
    where: { promptRun: { checkup: { brandProfileId: brand.id } } },
    _count: true,
  });
  console.log(
    "=== competitors ===",
    competitors
      .sort((a, b) => b._count - a._count)
      .slice(0, 10)
      .map((c) => `${c.name}:${c._count}`)
      .join(" "),
  );

  const citations = await prisma.citation.groupBy({
    by: ["domain"],
    where: { promptRun: { checkup: { brandProfileId: brand.id } } },
    _count: true,
  });
  console.log(
    "=== cited domains ===",
    citations
      .sort((a, b) => b._count - a._count)
      .slice(0, 10)
      .map((c) => `${c.domain}:${c._count}`)
      .join(" "),
  );

  const sample = await prisma.promptRun.findFirst({
    where: { checkup: { brandProfileId: brand.id }, status: "OK", brandMentioned: true },
    select: { engine: true, rawResponse: true, prompt: { select: { text: true } } },
  });
  if (sample) {
    console.log("=== sample answer ===");
    console.log("Q:", sample.prompt.text);
    console.log("A:", (sample.rawResponse ?? "").slice(0, 600));
  }
}

async function teardown() {
  const existing = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true } });
  if (!existing) return console.log("nothing to remove");
  await prisma.tenant.delete({ where: { id: existing.id } });
  console.log("dogfood tenant removed (cascades to brand, prompts, runs, metrics, calls)");
}

const command = process.argv[2];
const commands: Record<string, () => Promise<void>> = { setup, checkup, report, teardown };
if (!commands[command]) {
  console.error("usage: dogfood-ai-search.ts setup|checkup|report|teardown");
  process.exit(1);
}
commands[command]()
  .catch((err) => {
    console.error("FAILED:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
