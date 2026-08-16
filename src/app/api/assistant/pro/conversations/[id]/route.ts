/**
 * GET    /api/assistant/pro/conversations/[id] — one transcript.
 * DELETE /api/assistant/pro/conversations/[id] — remove it, permanently.
 *
 * ── THE ID IS UNTRUSTED ────────────────────────────────────────────────────
 * A conversation id is a cuid that ends up in a URL, which means it ends up
 * pasted into chat windows and support tickets. Both handlers pass it to the
 * store with the session's tenantId, and the store puts BOTH in the WHERE
 * clause — never a findUnique on the id followed by a comparison. A foreign id
 * therefore returns exactly what a made-up id returns: 404. That symmetry is
 * the point; a 403 on a real-but-other-tenant id confirms the id exists.
 *
 * ── DELETE IS A HARD DELETE ────────────────────────────────────────────────
 * Row gone, messages gone by cascade. No soft-delete flag and no tombstone:
 * this phase ships no retention policy, so "the customer deleted it" has to
 * actually mean it. See the schema comment on AssistantConversation.
 *
 * ── NO KILL-SWITCH CHECK ───────────────────────────────────────────────────
 * As in the list route: AI_ASSISTANT_ENABLED stops the assistant answering,
 * not the customer reading and deleting what they already own.
 */

import { requirePaidPlan } from "@/lib/paid-plan";
import { assistantError, assistantJson, proRouteError } from "@/lib/assistant/pro/http";
import { deleteConversation, getTranscript } from "@/lib/assistant/pro/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const membership = await requirePaidPlan();
    const { id } = await context.params;

    const transcript = await getTranscript(membership.tenantId, id);
    if (!transcript) {
      return assistantError("That conversation no longer exists.", "NOT_FOUND", 404);
    }
    return assistantJson(transcript);
  } catch (err) {
    return proRouteError(err);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const membership = await requirePaidPlan();
    const { id } = await context.params;

    const deleted = await deleteConversation(membership.tenantId, id);
    if (!deleted) {
      return assistantError("That conversation no longer exists.", "NOT_FOUND", 404);
    }
    return assistantJson({ deleted: true });
  } catch (err) {
    return proRouteError(err);
  }
}
