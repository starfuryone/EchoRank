/**
 * Make the owner tenant's tracked prompts exactly OWNER_PROMPTS
 * (src/lib/owner-prompts/seed.ts), declare both brands so the runner can
 * detect a mention of either, and queue one run now.
 *
 * Usage (as echorank or root — it reads the 600 .env):
 *   set -a && . ./.env && set +a
 *   npm run prompts:seed-owner -- --tenant <tenant id or slug>          # apply + run once
 *   npm run prompts:seed-owner -- --tenant <id|slug> --prune            # delete, not pause, the old ones
 *   npm run prompts:seed-owner -- --tenant <id|slug> report             # mention rates per brand
 *   OWNER_TENANT_ID=<id> npm run prompts:seed-owner                     # same, via env
 *
 * With no tenant it lists the tenants that can hold 25 prompts and exits.
 *
 * SPENDS MONEY: the queued batch is one sidecar /track call over 25 prompts,
 * metered as AI_INFERENCE against the tenant like any customer run. After that
 * the prompts are on the tenant's normal cadence — the visibility-monitoring
 * sweep re-asks each one daily (nextRunAt + 1 day), as for every tenant.
 *
 * Idempotent: re-running re-applies the list and queues another run.
 *
 * Runtime strategy for `server-only` (CLAUDE.md): the npm script sets
 * --conditions=react-server, like `npm run workers`.
 */
import { prisma, disconnectPrisma } from "@/lib/prisma";
import { OWNER_BRANDS, planOwnerSeed } from "@/lib/owner-prompts/seed";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function resolveTenant(): Promise<{ id: string; name: string; planType: string } | null> {
  const ref = opt("--tenant") ?? process.env.OWNER_TENANT_ID;
  if (!ref) return null;
  return prisma.tenant.findFirst({
    where: { OR: [{ id: ref }, { slug: ref }] },
    select: { id: true, name: true, planType: true },
  });
}

async function listCandidates() {
  const tenants = await prisma.tenant.findMany({
    where: { planType: { in: ["AGENCY", "ENTERPRISE"] } },
    select: {
      id: true,
      slug: true,
      name: true,
      planType: true,
      _count: { select: { trackedPrompts: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  console.log("No tenant given. Pass --tenant <id|slug> (or OWNER_TENANT_ID). Candidates:");
  for (const t of tenants) {
    console.log(`  ${t.id}  ${t.slug ?? "-"}  ${t.planType}  ${t._count.trackedPrompts} prompts  ${t.name}`);
  }
}

async function apply(tenantId: string) {
  // Both brands as BrandProfiles: the prompt runner counts a mention of any
  // of the tenant's declared brands. trackingActive stays false — this
  // declares the brand, it does not start AI Search checkups for it.
  for (const b of OWNER_BRANDS) {
    const found = await prisma.brandProfile.findFirst({
      where: { tenantId, name: { equals: b.name, mode: "insensitive" } },
      select: { id: true, aliases: true },
    });
    if (found) {
      const aliases = Array.from(new Set([...found.aliases, ...b.aliases]));
      await prisma.brandProfile.update({ where: { id: found.id }, data: { aliases } });
    } else {
      await prisma.brandProfile.create({
        data: { tenantId, name: b.name, aliases: b.aliases, website: b.website, trackingActive: false },
      });
      console.log(`declared brand ${b.name}`);
    }
  }

  const existing = await prisma.trackedPrompt.findMany({
    where: { tenantId },
    select: { id: true, text: true, active: true },
  });
  const plan = planOwnerSeed(existing, flag("--prune"));

  await prisma.$transaction(async (tx) => {
    if (plan.pause.length) {
      await tx.trackedPrompt.updateMany({ where: { tenantId, id: { in: plan.pause } }, data: { active: false } });
    }
    if (plan.remove.length) {
      await tx.trackedPrompt.deleteMany({ where: { tenantId, id: { in: plan.remove } } });
    }
    const now = new Date();
    for (const p of plan.upsert) {
      await tx.trackedPrompt.upsert({
        where: { tenantId_text: { tenantId, text: p.text } },
        update: { active: true, tags: [p.brand], nextRunAt: now },
        create: { tenantId, text: p.text, tags: [p.brand], source: null, nextRunAt: now },
      });
    }
  });
  console.log(
    `prompts: ${plan.upsert.length} active, ${plan.pause.length} paused, ${plan.remove.length} deleted`,
  );

  // Run once now — the same job POST /api/ai/visibility/prompts/run queues.
  // If Redis is unreachable the prompts are still due, and the 15-minute
  // sweep picks them up on its own.
  try {
    const { addJob } = await import("@/infrastructure/queue/registry");
    await addJob(
      "visibility-monitoring",
      "run-prompt-batch",
      { promptTenantId: tenantId },
      { jobId: `pt-seed-${tenantId}-${Date.now()}`, removeOnComplete: true, removeOnFail: true },
    );
    console.log("queued: run-prompt-batch (results in ~1 min; then `report`)");
  } catch (err) {
    console.warn("could not queue now; the sweep will run them within 15 min:", (err as Error).message);
  }
}

async function report(tenantId: string) {
  const prompts = await prisma.trackedPrompt.findMany({
    where: { tenantId, active: true },
    select: { id: true, text: true, tags: true },
  });
  const runs = await prisma.promptRun.findMany({
    where: { tenantId, promptId: { in: prompts.map((p) => p.id) }, error: null },
    orderBy: { createdAt: "desc" },
    distinct: ["promptId"],
    select: { promptId: true, brandMentioned: true, createdAt: true },
  });
  const latest = new Map(runs.map((r) => [r.promptId, r]));
  for (const b of OWNER_BRANDS) {
    const mine = prompts.filter((p) => p.tags.includes(b.key));
    const ran = mine.filter((p) => latest.has(p.id));
    const hit = ran.filter((p) => latest.get(p.id)!.brandMentioned);
    const pct = ran.length ? Math.round((hit.length / ran.length) * 100) : null;
    console.log(`\n${b.name}: ${hit.length}/${ran.length} mentioned (${pct ?? "-"}%), ${mine.length - ran.length} not run yet`);
    for (const p of mine) {
      const r = latest.get(p.id);
      console.log(`  ${r ? (r.brandMentioned ? "YES" : " no") : "  …"}  ${p.text}`);
    }
  }
}

async function main() {
  const tenant = await resolveTenant();
  if (!tenant) {
    await listCandidates();
    process.exitCode = 1;
    return;
  }
  console.log(`tenant: ${tenant.name} (${tenant.id}, ${tenant.planType})`);
  if (args.includes("report")) await report(tenant.id);
  else await apply(tenant.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
    // The queue holds a Redis connection open; nothing else is pending.
    process.exit(process.exitCode ?? 0);
  });
