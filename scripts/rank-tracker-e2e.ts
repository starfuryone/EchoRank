/**
 * Rank Tracker end-to-end: create project -> run now -> standard queue ->
 * shared sweep -> snapshots with positions. Runs the REAL service and worker
 * code, not a simulation.
 *
 *   # Live. Costs one task_post per keyword. DATAFORSEO_RECORD=1 also records
 *   # the envelopes, including a COMPLETED task_get once results land.
 *   DATAFORSEO_RECORD=1 npx tsx scripts/rank-tracker-e2e.ts <tenantId> <domain> kw1 "kw 2"
 *
 *   # Replay. Zero spend, zero network.
 *   DATAFORSEO_FIXTURES=1 npx tsx scripts/rank-tracker-e2e.ts <tenantId> <domain> kw1
 *
 * Replay note: the task_post fixture always returns the SAME DataForSEO task
 * id and RankSnapshot.dataforseoTaskId is unique, so replay is limited to ONE
 * keyword and clears the previous replay's project first. That constraint is
 * deliberate — in production one upstream task maps to exactly one snapshot.
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { fixturesEnabled } from "@/lib/dataforseo/fixtures";
import { createProject, getProjectDetail, runProject } from "@/lib/rank-tracker/service";
import { processSweep } from "@/infrastructure/queue/workers/serp-check.worker";
import { rankChecksUsed } from "@/lib/rank-tracker/quota";
import { DEFAULT_LANGUAGE_CODE, DEFAULT_LOCATION_CODE } from "@/lib/rank-tracker/options";

const POLL_INTERVAL_MS = 15_000;
/** 20 min. The standard queue is documented at 1–5 min but its SLA is 45. */
const MAX_POLLS = 80;
/**
 * Live and replay use DIFFERENT project names on purpose. Each mode clears its
 * own prior project by name for reproducibility, and a shared name means a
 * replay silently deletes the live run you are still waiting on — which is
 * exactly what happened on 2026-07-28.
 */
const projectName = (replayMode: boolean) =>
  `e2e rank tracker (${replayMode ? "replay" : "live"})`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [tenantId, domainArg, ...keywordArgs] = process.argv.slice(2);
  if (!tenantId || !domainArg) {
    console.error(
      "usage: npx tsx scripts/rank-tracker-e2e.ts <tenantId> <domain> [keyword...]",
    );
    process.exit(1);
  }

  const replay = fixturesEnabled();
  const keywords = (keywordArgs.length ? keywordArgs : ["reputation management software"])
    .map((k) => k.trim().toLowerCase())
    .slice(0, replay ? 1 : undefined);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, planType: true },
  });
  if (!tenant) throw new Error(`No tenant ${tenantId}`);

  console.log(
    `[e2e] ${replay ? "REPLAY (fixtures, $0.00)" : `LIVE (${keywords.length} task_post)`} — ` +
      `tenant ${tenant.name} (${tenant.planType}), domain "${domainArg}", ` +
      `keywords: ${keywords.join(" | ")}`,
  );

  // Always start clean so the run is reproducible — but only this mode's own
  // project (see projectName above).
  const NAME = projectName(replay);
  const cleared = await prisma.rankProject.deleteMany({
    where: { tenantId, name: NAME },
  });
  if (cleared.count) console.log(`[e2e] cleared ${cleared.count} prior e2e project(s)`);

  // ── 1. Create (exercises the plan gates + keyword cap) ──────────────────
  const project = await createProject(tenantId, tenant.planType, {
    name: NAME,
    domain: domainArg,
    keywords,
    locationCode: DEFAULT_LOCATION_CODE,
    languageCode: DEFAULT_LANGUAGE_CODE,
    device: "desktop",
    frequency: tenant.planType === "AGENCY" ? "daily" : "weekly",
  });
  console.log(
    `[e2e] created project ${project.id} — ${project.keywordCount} keyword(s), ${project.frequency}`,
  );

  // ── 2. Run now (what the button enqueues) ───────────────────────────────
  const run = await runProject(project.id);
  console.log(
    `[e2e] posted ${run.posted}/${run.posted + run.failed} keyword(s), cost $${run.costUsd.toFixed(6)}`,
  );
  if (run.posted === 0) {
    console.error("[e2e] nothing was posted — stopping");
    process.exitCode = 1;
    return report(tenantId, project.id);
  }

  // Replay only: backdate the rows so the sweep will actually look at them.
  //
  // The sweep ignores rows younger than 30 s and only direct-fetches ones
  // older than 5 min, and in replay the task_post and task_get fixtures carry
  // different DataForSEO ids (they were recorded minutes apart), so the
  // tasks_ready match can never fire. Backdating exercises the real
  // direct-task_get path instead of hand-editing a fixture to fake an id.
  if (replay) {
    await prisma.rankSnapshot.updateMany({
      where: { keyword: { projectId: project.id } },
      data: { runDate: new Date(Date.now() - 10 * 60_000) },
    });
    console.log("[e2e] replay: backdated snapshots 10 min so the sweep picks them up");
  }

  // ── 3. Drain via the REAL shared sweep ──────────────────────────────────
  for (let poll = 1; poll <= MAX_POLLS; poll++) {
    // The sweep ignores rows younger than 30 s; wait before the first pass.
    await sleep(replay ? 500 : POLL_INTERVAL_MS);
    await processSweep();

    const pending = await prisma.rankSnapshot.count({
      where: { keyword: { projectId: project.id }, status: "queued" },
    });
    if (pending === 0) {
      console.log(`[e2e] all snapshots settled after ${poll} sweep(s)`);
      return report(tenantId, project.id);
    }
    console.log(`[e2e] sweep ${poll}/${MAX_POLLS} — ${pending} still queued`);
  }

  console.error("[e2e] snapshots never settled within the poll window");
  process.exitCode = 1;
  await report(tenantId, project.id);
}

async function report(tenantId: string, projectId: string) {
  const detail = await getProjectDetail(tenantId, projectId);

  console.log("─".repeat(72));
  console.log(`project       ${detail.name} (${detail.id})`);
  console.log(`domain        ${detail.domain} · ${detail.frequency}`);
  console.log(`last run      ${detail.lastRunAt ?? "—"}`);
  console.log(`cost          $${detail.totalCostUsd.toFixed(6)} (all snapshots)`);
  console.log(`avg position  ${detail.averagePosition?.toFixed(1) ?? "—"}`);
  console.log("keywords:");
  for (const row of detail.keywords) {
    const position =
      row.position === null ? (row.pending ? "queued" : "not in top 100") : `#${row.position}`;
    console.log(
      `  ${position.padEnd(16)} ${row.keyword}` + (row.url ? `\n      -> ${row.url}` : ""),
    );
  }

  const raw = await prisma.rankSnapshot.findMany({
    where: { keyword: { projectId } },
    select: { status: true, position: true, dataforseoTaskId: true, error: true },
  });
  console.log("snapshot rows:");
  for (const snap of raw) {
    console.log(
      `  ${snap.status.padEnd(10)} pos=${snap.position ?? "null"} task=${snap.dataforseoTaskId ?? "—"}` +
        (snap.error ? ` err=${snap.error}` : ""),
    );
  }

  console.log(`quota used    ${await rankChecksUsed(tenantId)} checks this month`);
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
