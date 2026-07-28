/**
 * SERP Checker end-to-end: submit -> DataForSEO standard queue -> worker sweep
 * -> completed row. Runs the REAL service and worker code, not a simulation.
 *
 * Two modes:
 *
 *   # Live. Costs exactly one task_post (~$0.0006). DATAFORSEO_RECORD=1 also
 *   # writes fixtures/dataforseo/*.json for the three endpoints it touches.
 *   DATAFORSEO_RECORD=1 npx tsx scripts/serp-check-e2e.ts <tenantId> "<keyword>"
 *
 *   # Replay. Zero spend, zero network — verifies the same flow off fixtures.
 *   DATAFORSEO_FIXTURES=1 npx tsx scripts/serp-check-e2e.ts <tenantId>
 *
 * Replay note: the task_post fixture always returns the SAME DataForSEO task
 * id, and SerpCheck.dataforseoTaskId is unique, so a replay first clears the
 * row left by the previous replay. That constraint is deliberate — in
 * production one upstream task must map to exactly one row.
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { submitSerpCheck } from "@/lib/serp/service";
import { processSweep } from "@/infrastructure/queue/workers/serp-check.worker";
import { fixturesEnabled } from "@/lib/dataforseo/fixtures";
import { serpChecksUsed } from "@/lib/serp/quota";

const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 24; // 6 minutes — past the 1–5 min standard-queue window

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [tenantId, keywordArg] = process.argv.slice(2);
  if (!tenantId) {
    console.error("usage: npx tsx scripts/serp-check-e2e.ts <tenantId> [keyword]");
    process.exit(1);
  }
  const keyword = keywordArg ?? "reputation management software";

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, planType: true },
  });
  if (!tenant) throw new Error(`No tenant ${tenantId}`);

  const replay = fixturesEnabled();
  console.log(
    `[e2e] ${replay ? "REPLAY (fixtures, $0.00)" : "LIVE (~$0.0006)"} — ` +
      `tenant ${tenant.name} (${tenant.planType}), keyword "${keyword}"`,
  );

  if (replay) {
    // Fixtures replay one fixed task id; clear the previous replay's row.
    const cleared = await prisma.serpCheck.deleteMany({
      where: { tenantId, keyword, status: { in: ["queued", "completed", "failed"] } },
    });
    if (cleared.count) console.log(`[e2e] cleared ${cleared.count} prior replay row(s)`);
  }

  // ── Submit (the POST route's body, minus HTTP) ─────────────────────────
  const { check, cached } = await submitSerpCheck(tenantId, tenant.planType, {
    keyword,
    locationCode: 2124,
    languageCode: "en",
    device: "desktop",
  });

  if (cached) {
    console.log(`[e2e] cache hit — check ${check.id}, no task posted, no spend.`);
    return report(check.id);
  }

  console.log(`[e2e] queued: row ${check.id}, cost $${check.costUsd.toFixed(6)}`);

  // ── Drain via the real worker sweep ────────────────────────────────────
  for (let poll = 1; poll <= MAX_POLLS; poll++) {
    // The sweep ignores rows younger than 30 s; wait before the first pass.
    await sleep(replay ? 500 : POLL_INTERVAL_MS);
    await processSweep();

    const row = await prisma.serpCheck.findUnique({ where: { id: check.id } });
    if (row && row.status !== "queued") {
      console.log(`[e2e] ${row.status} after ${poll} sweep(s)`);
      return report(check.id);
    }
    console.log(`[e2e] sweep ${poll}/${MAX_POLLS} — still queued`);
  }

  console.error("[e2e] never completed within the poll window");
  process.exitCode = 1;
  await report(check.id);
}

async function report(id: string) {
  const row = await prisma.serpCheck.findUnique({ where: { id } });
  if (!row) return;

  const items = (row.results as { items?: { position: number; domain: string }[] } | null)?.items ?? [];
  console.log("─".repeat(64));
  console.log(`id           ${row.id}`);
  console.log(`status       ${row.status}${row.error ? ` (${row.error})` : ""}`);
  console.log(`task id      ${row.dataforseoTaskId ?? "—"}`);
  console.log(`costUsd      ${Number(row.costUsd).toFixed(6)}`);
  console.log(`organic      ${row.itemCount ?? 0}`);
  console.log(`features     ${(row.serpFeatures as string[] | null)?.join(", ") || "none"}`);
  console.log(`top 3        ${items.slice(0, 3).map((i) => `${i.position}. ${i.domain}`).join(" | ") || "—"}`);
  console.log(`quota used   ${await serpChecksUsed(row.tenantId)} this month`);

  const spend = await prisma.serpCheck.aggregate({
    _sum: { costUsd: true },
    where: { tenantId: row.tenantId },
  });
  console.log(`tenant spend $${Number(spend._sum.costUsd ?? 0).toFixed(6)} (all SERP checks)`);
  console.log("─".repeat(64));
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
