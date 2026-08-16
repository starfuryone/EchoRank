/**
 * POST /api/assistant/pro/chat — one turn of the authenticated Pro assistant.
 *
 * AUTHENTICATED, AND NOT BY ACCIDENT. /api/assistant/chat (the anonymous one)
 * is an EXACT entry in the proxy's publicExactPaths precisely so that nothing
 * added later under /api/assistant/ inherits anonymous access by prefix. This
 * route is that "something added later": it must never appear in publicPaths or
 * publicExactPaths, and tests/assistant-pro.route.test.ts asserts it does not.
 *
 * GUARD CHAIN, CHEAPEST FIRST:
 *   kill switch → requirePaidPlan (session + tenant + ACTIVE billing) → zod →
 *   per-tenant rate limit → monthly token budget → tools → model.
 *
 * Everything above the model is free to refuse, so a request that is going to
 * be refused never reaches the thing that costs money.
 *
 * THE BODY CARRIES A QUESTION, NOT A CONFIGURATION. There is no field for a
 * model, a system prompt, a tool list, a token ceiling, or a tenant. A caller
 * cannot turn this route into a general-purpose model proxy on the tenant's
 * budget — the same boundary /api/action-agent and the Marketing Studio route
 * draw, restated because this is a new door onto a paid API.
 *
 * `forceRefresh` IS in the body, and it is the one exception: it comes from an
 * explicit "Refresh analysis" click in the UI. It is a boolean the customer
 * sets, never a tool argument the model can set — see src/lib/assistant/pro/
 * tools.ts for why that distinction is load-bearing.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { assistantEnabled } from "@/lib/assistant/config";
import { MAX_MESSAGE_CHARS, runProTurn } from "@/lib/assistant/pro/agent";
import { assistantError, assistantJson, proRouteError } from "@/lib/assistant/pro/http";
import * as metrics from "@/lib/assistant/pro/metrics";
import {
  assertAssistantBudget,
  buildAssistantUsage,
  recordAssistantTokens,
} from "@/lib/assistant/pro/quota";
import {
  appendExchange,
  historyFor,
  resolveConversation,
} from "@/lib/assistant/pro/store";
import { tenantDomains } from "@/lib/assistant/pro/tools";

/** Node runtime: Prisma, the Redis client and the sidecar call all need it. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Turns per tenant per minute. A floor under the monthly token budget, which a
 * scripted loop could otherwise drain in well under a minute.
 */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

const BodySchema = z
  .object({
    message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
    /** Omit to start a new conversation. */
    conversationId: z.string().trim().min(1).max(64).optional(),
    /** Set by the "Refresh analysis" button. Never by the model. */
    forceRefresh: z.boolean().optional(),
  })
  .strict();

export async function POST(request: Request) {
  // The runtime kill switch, before anything is parsed, read or spent. Shared
  // with the public assistant deliberately: one flag takes the whole feature
  // offline rather than half of it.
  if (!assistantEnabled()) {
    return assistantError(
      "The Echorank assistant is offline for maintenance. Try again shortly.",
      "ASSISTANT_DISABLED",
      503,
    );
  }

  try {
    const membership = await requirePaidPlan();
    const { tenantId, userId } = membership;

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return assistantError("Check what you entered and try again.", "INVALID_REQUEST", 400);
    }

    const limited = await rateLimit(`assistant-pro:${tenantId}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limited.success) {
      return assistantError(
        "That is a lot of questions at once. Give it a moment and try again.",
        "RATE_LIMITED",
        429,
      );
    }

    // Throws AssistantBudgetExceededError / AssistantBudgetUnavailableError,
    // both mapped by proRouteError. Checked BEFORE the model call; recorded
    // after, because output length is not knowable in advance.
    await assertAssistantBudget(tenantId);

    const conversation = await resolveConversation(
      tenantId,
      userId,
      parsed.data.conversationId,
      parsed.data.message,
    );
    if (!conversation) {
      // A conversation id that is not this tenant's. A 404, not a 403: the
      // honest answer is that no such conversation exists for this caller, and
      // a 403 would confirm that the id belongs to somebody.
      return assistantError("That conversation no longer exists.", "NOT_FOUND", 404);
    }

    const [history, domains] = await Promise.all([
      conversation.created ? Promise.resolve([]) : historyFor(tenantId, conversation.id),
      tenantDomains(tenantId),
    ]);

    const locale = dashboardLocale(
      request.headers.get("cookie")?.match(/echorank_locale=([^;]+)/)?.[1],
    );

    const result = await runProTurn({
      message: parsed.data.message,
      history,
      locale,
      ctx: {
        tenantId,
        tenantName: membership.tenant.name,
        planType: membership.tenant.planType,
        domains,
        forceRefresh: parsed.data.forceRefresh === true,
      },
    });

    // ── After the answer: persist, meter, count ──
    //
    // The transcript write comes first because it is the only one the customer
    // would notice missing. The meter and the counters are best-effort by
    // construction (see quota.ts and metrics.ts) and never fail the response.
    await appendExchange({
      tenantId,
      conversationId: conversation.id,
      question: parsed.data.message,
      answer: result.answer,
      toolSummary: result.toolSummary,
      inputTokens: result.cost.inputTokens,
      outputTokens: result.cost.outputTokens,
    });

    await Promise.all([
      recordAssistantTokens(tenantId, result.cost.outputTokens),
      // The durable spend record, in the same table Marketing Studio and the
      // Action Agent write to. Separate BUDGET, shared LEDGER: the monthly cap
      // is its own Redis counter, but the row that says what was actually spent
      // belongs where every other model call in this product records it.
      prisma.aiApiCall
        .create({
          data: {
            tenantId,
            categoryId: "assistant_pro",
            model: result.cost.model,
            inputTokens: result.cost.inputTokens,
            outputTokens: result.cost.outputTokens,
            cacheReadTokens: result.cost.cacheReadTokens,
          },
        })
        .catch((err: unknown) => {
          logger.error({ tenantId, err }, "assistant pro: spend row not written");
        }),
      recordMetrics(result),
    ]);

    const usage = await buildAssistantUsage(tenantId);

    logger.info(
      {
        tenantId,
        conversationId: conversation.id,
        model: result.cost.model,
        toolCalls: result.cost.toolCalls,
        cachedToolCalls: result.cost.cachedToolCalls,
        toolsSkipped: result.cost.toolsSkipped,
        budgetExceeded: result.budgetExceeded,
        inputTokens: result.cost.inputTokens,
        outputTokens: result.cost.outputTokens,
        cacheReadTokens: result.cost.cacheReadTokens,
      },
      "assistant pro turn",
    );

    return assistantJson({
      conversationId: conversation.id,
      answer: result.answer,
      toolSummary: result.toolSummary,
      budgetExceeded: result.budgetExceeded,
      usage,
    });
  } catch (err) {
    await metrics.bump("pro", "errors");
    return proRouteError(err);
  }
}

/**
 * Day counters for this turn.
 *
 * NOT EXPORTED. A route module may only export HTTP verbs and the framework's
 * own config fields; anything else is rejected as an invalid route export.
 */
function recordMetrics(result: Awaited<ReturnType<typeof runProTurn>>): Promise<void> {
  const fields: Record<string, number> = {
    turns: 1,
    llm_answer: 1,
    [metrics.tokensField(result.cost.model)]: result.cost.outputTokens,
  };

  // "llm_avoided" counts the turns the router answered without an
  // investigation — the cheap path working is the thing worth measuring.
  if (result.cost.toolsSkipped) fields.llm_avoided = 1;
  if (result.budgetExceeded) fields.budget_exceeded = 1;

  fields.cache_hit = result.cost.cachedToolCalls;
  fields.cache_miss = result.cost.toolCalls - result.cost.cachedToolCalls;

  for (const entry of result.toolSummary) {
    const field = metrics.toolField(entry.tool);
    fields[field] = (fields[field] ?? 0) + 1;
  }

  return metrics.record("pro", fields);
}
