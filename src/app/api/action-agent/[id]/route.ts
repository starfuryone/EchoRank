/**
 * PATCH /api/action-agent/[id] — the only writes this tool performs on a draft.
 *
 * Five actions, one route:
 *   edit        replace the draft payload (only while it is a draft)
 *   approve     draft -> approved
 *   reject      draft|approved -> rejected
 *   apply       approved -> applied
 *   regenerate  enqueue a NEW draft for the same source; this row is untouched
 *
 * ── NOTHING HERE PUBLISHES ─────────────────────────────────────────────────
 * `apply` writes a status, a timestamp and an audit_logs row. It does not push
 * JSON-LD to anyone's site, does not post a reply to Google, and has no branch
 * that could. In v1 all three kinds are copy-or-download: the customer takes
 * the text and uses it, and `applied` is them telling us they did. For
 * review_reply that is a deliberate stop rather than an oversight — this repo
 * has no reply-publishing pipeline at all (ExternalReview.replyContent has no
 * writer anywhere in src/), so there is nothing for an apply adapter to call
 * and inventing one inside this route would be building a publishing path
 * nobody reviewed.
 *
 * ── EVERY TRANSITION IS AUDITED ────────────────────────────────────────────
 * Approve, reject and apply each write audit_logs before returning. That is the
 * record of who agreed to what, and it is written from here rather than from
 * the store because only a request has an actor and an ip address.
 *
 * ── TENANT SCOPING IS IN THE WHERE CLAUSE ──────────────────────────────────
 * Never a check-then-write. See store.ts: transition() and updateDraft() both
 * filter on (id, tenantId) inside the statement that writes, so a foreign id
 * gets the same 404 a missing one gets and cannot be used to probe for ids.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { createAuditLog } from "@/lib/audit";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { addJob } from "@/infrastructure/queue/registry";
import type { ActionAgentJob } from "@/infrastructure/queue/jobs/schemas";
import { assertActionAgentBudget } from "@/lib/action-agent/generate";
import { actionAgentRouteError } from "@/lib/action-agent/http";
import {
  getActionItem,
  transition,
  updateDraft,
  type WriteResult,
} from "@/lib/action-agent/store";
import { isV1Kind, parseDraft, type ActionItemStatus } from "@/lib/action-agent/types";

const BodySchema = z.object({
  action: z.enum(["edit", "approve", "reject", "apply", "regenerate"]),
  /** Only read by `edit`. Validated against the row's kind, not the body's. */
  draft: z.unknown().optional(),
  /** Only read by `reject`. */
  note: z.string().trim().max(2000).optional(),
  locale: z.string().trim().max(16).optional(),
});

/** Client ip, for the audit row. Best-effort — this box sits behind Cloudflare. */
function clientIp(request: Request): string | undefined {
  const header =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for") ??
    "";
  const first = header.split(",")[0]?.trim();
  return first || undefined;
}

function writeFailureResponse(result: Extract<WriteResult, { ok: false }>): NextResponse {
  switch (result.reason) {
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "not_editable":
      return NextResponse.json(
        { error: "not_editable", code: "NOT_EDITABLE", status: result.from },
        { status: 409 },
      );
    case "illegal_transition":
      return NextResponse.json(
        { error: "illegal_transition", code: "ILLEGAL_TRANSITION", status: result.from },
        { status: 409 },
      );
    case "conflict":
      // Somebody else moved it between our read and our write. 409, not 500:
      // the caller's view is stale and refetching fixes it.
      return NextResponse.json(
        { error: "conflict", code: "CONFLICT", status: result.from },
        { status: 409 },
      );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const membership = await requirePaidPlan();
    const { id } = await context.params;

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_REQUEST", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { action, draft, note, locale } = parsed.data;

    const existing = await getActionItem(membership.tenantId, id);
    if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // A row of a v2 kind cannot exist yet — nothing writes one — but the enum
    // carries those values, so the narrowing is done rather than assumed.
    if (!isV1Kind(existing.kind)) {
      return NextResponse.json({ error: "unsupported_kind" }, { status: 409 });
    }

    const ipAddress = clientIp(request);

    // ── regenerate: a NEW row, same source. This one stays terminal. ────────
    if (action === "regenerate") {
      // The budget is asserted here for the same reason it is on the enqueue
      // route: this is a generation request, and an exhausted tenant must be
      // refused on the click with a reset date rather than queued.
      await assertActionAgentBudget(membership.tenantId, membership.tenant.planType);

      const job: ActionAgentJob = {
        tenantId: membership.tenantId,
        correlationId: `action-agent:regen:${id}`,
        kind: existing.kind,
        plan: membership.tenant.planType,
        locale: dashboardLocale(locale),
        // The source comes off the ROW, never off the request: a client that
        // could name the target could redraft one item against another's page.
        ...(existing.kind === "review_reply"
          ? { reviewIds: [existing.sourceRef.replace(/^ExternalReview:/, "")], reviewLimit: 1 }
          : { url: existing.sourceRef }),
        requestedByUserId: membership.userId,
      };

      const queued = await addJob<ActionAgentJob>("action-agent", existing.kind, job);

      await createAuditLog({
        tenantId: membership.tenantId,
        userId: membership.userId,
        action: "action_agent.regenerate_requested",
        entity: "ActionItem",
        entityId: id,
        details: { kind: existing.kind, fromStatus: existing.status, jobId: queued.id },
        ipAddress,
      }).catch(() => undefined);

      return NextResponse.json({ queued: true, jobId: queued.id }, { status: 202 });
    }

    // ── edit: replace the payload, only while it is a draft ────────────────
    if (action === "edit") {
      // Validated against the ROW'S kind. A body that claims to be a schema
      // draft cannot be written onto a review_reply row.
      const validated = parseDraft(existing.kind, draft);
      if (!validated.ok) {
        return NextResponse.json(
          { error: validated.error, code: "INVALID_DRAFT" },
          { status: 400 },
        );
      }

      const result = await updateDraft(membership.tenantId, id, validated.draft);
      if (!result.ok) return writeFailureResponse(result);

      await createAuditLog({
        tenantId: membership.tenantId,
        userId: membership.userId,
        action: "action_agent.draft_edited",
        entity: "ActionItem",
        entityId: id,
        // THE CONTENT IS NOT IN THE AUDIT ROW. A drafted reply quotes a named
        // customer's complaint, and audit_logs is read by a different audience
        // under a different retention policy than the queue is. What is audited
        // is that an edit happened, by whom.
        details: { kind: existing.kind },
        ipAddress,
      }).catch(() => undefined);

      return NextResponse.json({ item: result.item });
    }

    // ── the three transitions ──────────────────────────────────────────────
    const to: ActionItemStatus =
      action === "approve" ? "approved" : action === "reject" ? "rejected" : "applied";

    const result = await transition({
      tenantId: membership.tenantId,
      id,
      to,
      actorUserId: membership.userId,
      note,
    });
    if (!result.ok) return writeFailureResponse(result);

    await createAuditLog({
      tenantId: membership.tenantId,
      userId: membership.userId,
      action: `action_agent.${action}`,
      entity: "ActionItem",
      entityId: id,
      details: {
        kind: existing.kind,
        sourceRef: existing.sourceRef,
        fromStatus: existing.status,
        toStatus: to,
        // Recorded on every apply so the trail states, in the row itself, what
        // `applied` did and did not mean.
        ...(to === "applied" ? { published: false, mechanism: "manual_copy" } : {}),
        ...(to === "rejected" && note ? { note } : {}),
      },
      ipAddress,
    }).catch(() => undefined);

    return NextResponse.json({ item: result.item });
  } catch (err) {
    return actionAgentRouteError(err);
  }
}
