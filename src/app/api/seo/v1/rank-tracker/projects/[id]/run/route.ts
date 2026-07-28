/**
 * POST /api/seo/v1/rank-tracker/projects/[id]/run — check every keyword now.
 *
 * Enqueues rather than running inline: a 250-keyword project is 250 upstream
 * task_posts, which is a minute of work and no business in a request handler.
 * The response is 202 + the project's pending count; the UI polls the detail
 * route until `pendingCount` falls back to zero.
 *
 * The gates here are a fast pre-flight so the user gets an immediate 403/429
 * instead of a job that silently no-ops. runProject() re-checks all of them
 * (and holds the authoritative Redis reservation) inside the worker, because
 * only that check is race-free.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { addJob } from "@/infrastructure/queue/registry";
import { rankTrackerRouteError } from "@/lib/rank-tracker/http";
import { checksPerMonthLimit, planCanTrack, trackedKeywordLimit } from "@/lib/rank-tracker/options";
import { rankChecksUsed } from "@/lib/rank-tracker/quota";
import {
  RankCheckQuotaExceededError,
  RankKeywordCapExceededError,
} from "@/lib/rank-tracker/quota";
import { RankPlanLockedError, RankProjectNotFoundError } from "@/lib/rank-tracker/service";

/** Manual runs per tenant per minute. The monthly check quota is the real
 * spend bound; this stops a double-click from queueing two full runs. */
const RUN_RATE_LIMIT = 3;
const RUN_RATE_WINDOW_MS = 60_000;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const plan = tenant.tenant.planType;

    if (!planCanTrack(plan)) throw new RankPlanLockedError(plan);

    const project = await prisma.rankProject.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true, _count: { select: { keywords: true } } },
    });
    if (!project) throw new RankProjectNotFoundError();

    const keywordCount = project._count.keywords;
    if (keywordCount === 0) {
      return NextResponse.json(
        { error: "This project has no keywords yet.", code: "NO_KEYWORDS" },
        { status: 400 },
      );
    }

    // A downgrade can leave an existing project over the cap; refuse the run
    // rather than post a truncated one.
    const limit = trackedKeywordLimit(plan);
    if (keywordCount > limit) {
      throw new RankKeywordCapExceededError(limit, keywordCount, plan);
    }

    const limited = await rateLimit(
      `rank-run:${tenant.tenantId}`,
      RUN_RATE_LIMIT,
      RUN_RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many runs in a row. Wait a minute.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    // Non-reserving headroom check, purely so an over-quota click fails fast.
    const used = await rankChecksUsed(tenant.tenantId);
    const monthlyLimit = checksPerMonthLimit(plan);
    if (used + keywordCount > monthlyLimit) {
      throw new RankCheckQuotaExceededError(monthlyLimit, plan);
    }

    await addJob("rank-tracker", "run-now", { projectId: project.id });

    return NextResponse.json(
      { queued: true, keywords: keywordCount },
      { status: 202 },
    );
  } catch (err) {
    return rankTrackerRouteError(err);
  }
}
