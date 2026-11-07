import "server-only";

// src/lib/plan-change.ts — what happens to a tenant's background work when its
// plan moves across the plan allowlist (src/lib/plan-access.ts).
//
// DOWNGRADE into the AI-only plan: excluded schedules are paused and pending
// customer sends stopped; the data is kept, hidden behind the allowlist.
//   - crawl schedules: their repeatable jobs are removed (rows kept, still
//     `enabled`, so an upgrade can restore them);
//   - email/SMS sends waiting or delayed in their queues are removed;
//   - rank tracking, competitor sweeps, GSC sync, citation passes and feedback
//     routing need no pause: each re-checks the plan when it runs.
// UPGRADE out of it: crawl schedules get their repeatable jobs back.
// Every pause and resume is logged.
//
// Called from the Stripe webhook after the plan is written; it never throws,
// because the plan change has already happened and must stand.
import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { getQueue } from "@/infrastructure/queue/registry";
import { planAllowsArea } from "@/lib/plan-access";
import { removeScheduleRepeatable, syncScheduleRepeatable, type RepeatableQueue } from "@/lib/site-crawler/schedule-service";

const log = logger.child({ module: "plan-change" });

export interface PlanChangeOutcome {
  direction: "pause" | "resume" | "none";
  crawlSchedules: number;
  sendsStopped: number;
}

type QueueLike = {
  getJobs: (types: ("waiting" | "delayed" | "prioritized")[]) => Promise<{ data?: { tenantId?: string }; remove: () => Promise<void> }[]>;
};

export interface PlanChangeDeps {
  crawlQueue?: RepeatableQueue;
  sendQueues?: QueueLike[];
}

async function stopPendingSends(tenantId: string, queues: QueueLike[]): Promise<number> {
  let stopped = 0;
  for (const queue of queues) {
    const jobs = await queue.getJobs(["waiting", "delayed", "prioritized"]);
    for (const job of jobs) {
      if (job.data?.tenantId !== tenantId) continue;
      await job.remove();
      stopped += 1;
    }
  }
  return stopped;
}

export async function onPlanChange(
  tenantId: string,
  from: PlanType | null,
  to: PlanType,
  deps: PlanChangeDeps = {},
): Promise<PlanChangeOutcome> {
  const none: PlanChangeOutcome = { direction: "none", crawlSchedules: 0, sendsStopped: 0 };
  if (from === to) return none;
  const lostCrawler = planAllowsArea(from, "crawler") && !planAllowsArea(to, "crawler");
  const gainedCrawler = !planAllowsArea(from, "crawler") && planAllowsArea(to, "crawler");
  const lostReputation = planAllowsArea(from, "reputation") && !planAllowsArea(to, "reputation");
  if (!lostCrawler && !gainedCrawler && !lostReputation) return none;

  try {
    const crawlQueue = deps.crawlQueue ?? (getQueue("site-crawl") as unknown as RepeatableQueue);
    const schedules = await prisma.crawlSchedule.findMany({
      where: { tenantId, enabled: true },
      select: { id: true, cadence: true, hourUtc: true, enabled: true },
    });

    if (gainedCrawler) {
      for (const row of schedules) await syncScheduleRepeatable(crawlQueue, row);
      log.info({ tenantId, from, to, crawlSchedules: schedules.length }, "plan upgrade: crawl schedules resumed");
      return { direction: "resume", crawlSchedules: schedules.length, sendsStopped: 0 };
    }

    let paused = 0;
    if (lostCrawler) {
      for (const row of schedules) {
        await removeScheduleRepeatable(crawlQueue, row.id);
        paused += 1;
      }
    }
    let stopped = 0;
    if (lostReputation) {
      const queues = deps.sendQueues ?? [getQueue("email-delivery"), getQueue("sms-delivery")].map((q) => q as unknown as QueueLike);
      stopped = await stopPendingSends(tenantId, queues);
    }
    log.info(
      { tenantId, from, to, crawlSchedules: paused, sendsStopped: stopped },
      "plan downgrade: excluded schedules paused, pending sends stopped (data kept)",
    );
    return { direction: "pause", crawlSchedules: paused, sendsStopped: stopped };
  } catch (err) {
    log.error({ tenantId, from, to, err }, "plan change follow-up failed; the plan change stands, and every job re-checks the plan when it runs");
    return none;
  }
}
