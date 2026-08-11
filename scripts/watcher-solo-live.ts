/**
 * The WATCHER_SOLO path, executed once for real.
 *
 * SPENDS REAL MONEY. Explicitly authorised, expected around $0.39 against the
 * $5 watcher cap.
 *
 * NO STRIPE INVOLVED. The entitlement is granted administratively — a
 * Subscription row with productKind WATCHER — which is exactly the state
 * resolveWatcherShape's comment calls "reachable only by an administrative
 * grant". That is the point: the shape has never executed, and waiting for a
 * sandbox key to prove it would leave the 10-prompt / 3-rep / 1-engine / $5-cap
 * path untested for a reason unrelated to the path.
 *
 * The tenant is STARTER, so the resolver takes the field-wise max of STARTER
 * and solo. In practice that IS the solo profile: 10 prompts (both agree), 3
 * repetitions (solo's, over STARTER's 1), a $5 cap (both agree), and one
 * engine, because Claude is the only rate-backed adapter whatever the shape
 * allows. A tier that schedules nothing would give pure solo, and none exists.
 *
 *   npx tsx scripts/watcher-solo-live.ts grant
 *   npx tsx scripts/watcher-solo-live.ts checkup
 *   npx tsx scripts/watcher-solo-live.ts report
 *   npx tsx scripts/watcher-solo-live.ts teardown
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { resolveShapeForTenant } from "@/lib/ai-monitor/limits";
import { suggestPrompts } from "@/lib/ai-monitor/wizard/suggest";
import { completeWizard } from "@/lib/ai-monitor/wizard/create";
import { brandVariations, normalizeDomain } from "@/lib/ai-monitor/wizard/validation";
import { WATCHER_SOLO, WATCHER_SOLO_CAP_USD } from "@/lib/plan-config";

const SLUG = "watcher-solo-live";
const BRAND = "EchoRank360";
const DOMAIN = "echorank360.com";
const PLAN = "STARTER" as const;

async function tenantId(): Promise<string> {
  const existing = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.tenant.create({
    data: { name: "Watcher Solo (live test)", slug: SLUG, planType: PLAN },
    select: { id: true },
  });
  return created.id;
}

async function grant() {
  const id = await tenantId();
  await prisma.subscription.upsert({
    where: { tenantId: id },
    update: { productKind: "WATCHER", status: "ACTIVE", planType: PLAN },
    create: { tenantId: id, productKind: "WATCHER", status: "ACTIVE", planType: PLAN },
  });

  const shape = await resolveShapeForTenant(id, PLAN);
  console.log("tenantId:", id);
  console.log("resolved shape:", JSON.stringify(shape));
  console.log("WATCHER_SOLO  :", JSON.stringify(WATCHER_SOLO), "cap $" + WATCHER_SOLO_CAP_USD);

  // The gate this entitlement must NOT open.
  const { hasPaidPlan } = await import("@/lib/paid-plan");
  console.log("hasPaidPlan (must be false):", await hasPaidPlan(id));

  const domain = normalizeDomain(DOMAIN);
  if (!domain) throw new Error("bad domain");

  const suggested = await suggestPrompts(
    {
      brand: BRAND,
      domain,
      industry: "AI search visibility and SEO software",
      competitors: ["Profound", "Peec AI", "Otterly"],
      language: "en",
    },
    { tenantId: id, plan: PLAN, shape },
  );
  console.log(`suggestions: ${suggested.suggestions.length} of limit ${suggested.limit}`);
  if (suggested.suggestions.length === 0) throw new Error("no suggestions");

  const result = await completeWizard(
    { tenantId: id, plan: PLAN },
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
  console.log("wizard:", result);
  console.log(`\nAdd ${id} to AI_SEARCH_TENANT_IDS, then run \`checkup\`.`);
}

async function checkup() {
  const id = await tenantId();
  const brand = await prisma.brandProfile.findFirstOrThrow({
    where: { tenantId: id },
    select: { id: true },
  });
  const shape = await resolveShapeForTenant(id, PLAN);
  console.log(`running ${shape.prompts} prompts x ${shape.repetitions} reps`);
  console.log("start:", new Date().toISOString());
  const worker = await import("@/infrastructure/queue/workers/ai-checkup.worker");
  await worker.__testing.runOne({ brandProfileId: brand.id, tenantId: id, manual: true }, new Date());
  console.log("end:", new Date().toISOString());
}

async function report() {
  const id = await tenantId();
  const brand = await prisma.brandProfile.findFirstOrThrow({
    where: { tenantId: id },
    select: { id: true },
  });
  const checkups = await prisma.checkup.findMany({
    where: { brandProfileId: brand.id },
    select: {
      status: true,
      promptCount: true,
      repetitions: true,
      providers: true,
      stoppedReason: true,
      startedAt: true,
      completedAt: true,
    },
  });
  for (const c of checkups) {
    const secs =
      c.startedAt && c.completedAt
        ? Math.round((c.completedAt.getTime() - c.startedAt.getTime()) / 1000)
        : null;
    console.log(
      `checkup ${c.status} | ${c.promptCount}p x${c.repetitions} ${c.providers.join(",")} | ${secs}s | ${c.stoppedReason ?? "-"}`,
    );
  }
  const runs = await prisma.promptRun.groupBy({
    by: ["status"],
    where: { checkup: { brandProfileId: brand.id } },
    _count: true,
  });
  console.log("runs:", runs.map((r) => `${r.status}:${r._count}`).join(" "));

  const calls = await prisma.aiProviderCall.findMany({
    where: { tenantId: id },
    select: { purpose: true, costUsd: true, ok: true },
  });
  const spend = calls.reduce((t, c) => t + Number(c.costUsd), 0);
  console.log(
    `spend $${spend.toFixed(6)} of cap $${WATCHER_SOLO_CAP_USD} | calls ${calls.length} | failed ${calls.filter((c) => !c.ok).length}`,
  );

  const metrics = await prisma.visibilityMetric.findMany({ where: { brandProfileId: brand.id } });
  console.log("metrics:", JSON.stringify(metrics, null, 2));

  const { hasPaidPlan } = await import("@/lib/paid-plan");
  console.log("hasPaidPlan (must still be false):", await hasPaidPlan(id));
}

async function teardown() {
  const existing = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true } });
  if (!existing) return console.log("nothing to remove");
  await prisma.tenant.delete({ where: { id: existing.id } });
  console.log("removed");
}

const commands: Record<string, () => Promise<void>> = { grant, checkup, report, teardown };
const command = process.argv[2];
if (!commands[command]) {
  console.error("usage: watcher-solo-live.ts grant|checkup|report|teardown");
  process.exit(1);
}
commands[command]()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
