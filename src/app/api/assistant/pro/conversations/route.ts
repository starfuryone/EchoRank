/**
 * GET /api/assistant/pro/conversations — this tenant's saved conversations.
 *
 * AUTHENTICATED AND PLAN-GATED, like every route under /api/assistant/pro/.
 * The tenant scope comes from the session and lands in the WHERE clause (see
 * src/lib/assistant/pro/store.ts); there is no query parameter that can widen
 * it, because there is no query parameter at all.
 *
 * NO KILL-SWITCH CHECK HERE, deliberately. `AI_ASSISTANT_ENABLED` takes the
 * assistant offline — it does not take a customer's own saved history away
 * from them. Reading and deleting what they already own must keep working
 * while the model is switched off; only /chat, which spends money, is gated.
 */

import { requirePaidPlan } from "@/lib/paid-plan";
import { assistantJson, proRouteError } from "@/lib/assistant/pro/http";
import { listConversations } from "@/lib/assistant/pro/store";
import { buildAssistantUsage } from "@/lib/assistant/pro/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const membership = await requirePaidPlan();
    const [conversations, usage] = await Promise.all([
      listConversations(membership.tenantId),
      buildAssistantUsage(membership.tenantId),
    ]);
    return assistantJson({ conversations, usage });
  } catch (err) {
    return proRouteError(err);
  }
}
