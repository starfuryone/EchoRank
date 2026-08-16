/**
 * GET  /api/action-agent — the review queue: this tenant's drafts, plus counts
 *                          and the shared token meter.
 * POST /api/action-agent — enqueue one generation.
 *
 * Guard chain, cheapest first: requirePaidPlan (session + tenant + billing) →
 * zod → known kind → rate limit → BUDGET → enqueue.
 *
 * THE BUDGET IS ASSERTED HERE, BEFORE ANYTHING REACHES THE QUEUE. That is what
 * "blocked, not queued" means: an exhausted tenant gets a 429 naming the limit
 * and the reset date on the click, rather than a job that sits in Redis and
 * fails somewhere they cannot see. The worker asserts it again — see
 * action-agent.worker.ts for why both are needed.
 *
 * THE BODY CARRIES A KIND AND A TARGET, NOT A PROMPT. `kind` selects a
 * generator; the prompt text, the model and the token ceiling all come from
 * src/lib/action-agent/prompts.ts. There is no request field that can change
 * any of them, so a caller cannot turn this route into a general-purpose model
 * proxy on the tenant's budget — the same boundary the Marketing Studio route
 * draws, and the reason both are worth restating on every new door into the
 * same budget.
 *
 * AUTHENTICATED. Do not add /api/action-agent to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { addJob } from "@/infrastructure/queue/registry";
import type { ActionAgentJob } from "@/infrastructure/queue/jobs/schemas";
import { createAuditLog } from "@/lib/audit";
import {
  assertActionAgentBudget,
  buildActionAgentUsage,
  MAX_REVIEW_BATCH,
} from "@/lib/action-agent/generate";
import { actionAgentRouteError } from "@/lib/action-agent/http";
import { countByStatus, listActionItems } from "@/lib/action-agent/store";
import { isActionItemStatus, isV1Kind, V1_KINDS } from "@/lib/action-agent/types";

/** Generations per tenant per minute. A floor under the monthly token budget,
 *  which a scripted loop could otherwise drain in well under a minute. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

const BodySchema = z.object({
  kind: z.enum(V1_KINDS),
  url: z.string().trim().max(2048).optional(),
  reviewLimit: z.number().int().min(1).max(MAX_REVIEW_BATCH).optional(),
  locale: z.string().trim().max(16).optional(),
});

export async function GET(request: Request) {
  try {
    const membership = await requirePaidPlan();

    const params = new URL(request.url).searchParams;
    const statusParam = params.get("status");
    const kindParam = params.get("kind");
    const limitParam = Number(params.get("limit"));

    const [items, counts, usage] = await Promise.all([
      listActionItems({
        tenantId: membership.tenantId,
        // An unrecognised filter is IGNORED, not rejected: these come from
        // query params a link can carry, and a 400 on a stale bookmark is a
        // worse outcome than the unfiltered list.
        status: isActionItemStatus(statusParam) ? statusParam : undefined,
        kind: isV1Kind(kindParam) ? kindParam : undefined,
        limit: Number.isFinite(limitParam) ? limitParam : undefined,
      }),
      countByStatus(membership.tenantId),
      buildActionAgentUsage(membership.tenantId, membership.tenant.planType),
    ]);

    return NextResponse.json({ items, counts, usage });
  } catch (err) {
    return actionAgentRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const membership = await requirePaidPlan();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_REQUEST", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { kind, url, reviewLimit, locale } = parsed.data;

    // The page-shaped kinds need a target. Checked here rather than in the
    // generator so the caller gets a 400 instead of a failed job.
    if ((kind === "schema" || kind === "faq") && !url) {
      return NextResponse.json(
        { error: "Enter the page address to generate for.", code: "URL_REQUIRED" },
        { status: 400 },
      );
    }

    // Rate limit before the budget so a locked or exhausted plan cannot be used
    // as a free probe — the ordering the Marketing Studio route establishes.
    const limited = await rateLimit(
      `action-agent:${membership.tenantId}`,
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many generations at once — try again in a minute.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    // BLOCKED, NOT QUEUED. Throws MarketingPlanLockedError (403) for a plan
    // without marketing_studio, ActionAgentBudgetError (429, with the reset
    // date) when the month is spent, MarketingBudgetUnavailableError (503) when
    // Redis is unreachable — fail-closed, because an unbounded spend on
    // someone else's API bill is the worse failure.
    await assertActionAgentBudget(membership.tenantId, membership.tenant.planType);

    const job: ActionAgentJob = {
      tenantId: membership.tenantId,
      correlationId: `action-agent:${membership.tenantId}:${kind}`,
      kind,
      // Snapshotted, not re-read in the worker: this is the plan the budget was
      // asserted against, and a downgrade landing while the job waits must not
      // enforce a limit the customer was never refused under.
      plan: membership.tenant.planType,
      locale: dashboardLocale(locale),
      ...(url ? { url } : {}),
      ...(reviewLimit ? { reviewLimit } : {}),
      requestedByUserId: membership.userId,
    };

    const queued = await addJob<ActionAgentJob>("action-agent", kind, job);

    // The request is the auditable event, not just the result: this is where a
    // human decided to spend the tenant's budget, and the drafts that appear
    // later carry no record of who asked for them.
    await createAuditLog({
      tenantId: membership.tenantId,
      userId: membership.userId,
      action: "action_agent.generation_requested",
      entity: "ActionItem",
      details: { kind, url: url ?? null, reviewLimit: reviewLimit ?? null, jobId: queued.id },
    }).catch(() => undefined);

    return NextResponse.json({ queued: true, kind, jobId: queued.id }, { status: 202 });
  } catch (err) {
    return actionAgentRouteError(err);
  }
}
