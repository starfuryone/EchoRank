// src/lib/action-agent/generate.ts
//
// The three v1 generators, and the one budget they all spend from.
//
// ── ONE METER, SHARED WITH MARKETING STUDIO ────────────────────────────────
// Every call here goes through the same Redis month-keyed output-token counter
// Marketing Studio enforces, and writes the same `ai_api_calls` row — with
// `categoryId = "action_agent:<kind>"`, which is a free-text column, so the two
// features land in one monthly aggregate without a schema change. That is the
// intent: a tenant has ONE monthly allowance for generated content, and a
// second parallel budget would be a second number to explain on the pricing
// page and a second thing to be out of.
//
// ── BLOCKED, NOT QUEUED ────────────────────────────────────────────────────
// The budget is asserted TWICE, and the first assertion is the one the customer
// sees. The enqueue route checks before it puts anything on the queue, so an
// exhausted tenant gets an immediate 429 naming the limit and the reset date
// rather than a job that sits in Redis and dies quietly. The worker checks
// again because a job enqueued at 199,900 tokens can reach the head of the
// queue after a sibling has drained the rest — and there the failure is
// UNRECOVERABLE, so BullMQ does not retry a request that cannot become
// affordable by trying again.
//
// ── THE OVERSHOOT IS INHERITED AND BOUNDED ─────────────────────────────────
// quota.ts checks before the call and increments after, because output length
// is not knowable in advance. The largest single generation here is the FAQ at
// 2000 output tokens, so a tenant sitting one token under can end the month
// 2000 over — 1% of the STARTER allowance. See the argument in quota.ts; it is
// the same trade, taken for the same reason.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import type { DashLocale } from "@/lib/i18n/dashboard";
import { callMarketingModel, type MarketingCallResult } from "@/lib/marketing/client";
import { MARKETING_MODEL } from "@/lib/marketing-templates";
import {
  assertMarketingBudget,
  marketingBudgetResetsAt,
  marketingTokenLimit,
  marketingTokensUsed,
  recordMarketingTokens,
  MarketingBudgetExceededError,
} from "@/lib/marketing/quota";
import { notifyActionDraftReady } from "@/lib/notifications/adapters";
import {
  assembleSchema,
  cleanFaqs,
  coerceBusinessType,
  omittedFields,
  parseFieldsJson,
  renderFaq,
  schemaPlacement,
} from "./assemble";
import {
  gatherAuditFindings,
  gatherPageContext,
  gatherPageInventory,
  gatherTrackedPrompts,
  gatherUnansweredReviews,
} from "./context";
import { buildFaqPrompt, buildReviewReplyPrompt, buildSchemaPrompt } from "./prompts";
import { createDraft } from "./store";
import type { ActionItemDto, V1Kind } from "./types";

/** Reviews drafted in one batch. */
export const MAX_REVIEW_BATCH = 10;
export const DEFAULT_REVIEW_BATCH = 5;

/**
 * The budget is gone, and here is when it comes back.
 *
 * A DISTINCT ERROR FROM MarketingBudgetExceededError, carrying `resetsAt`.
 * Marketing Studio's own 429 never named a date — the usage line on that page
 * is right there beside the button, so "you are at your limit" was legible
 * without one. The Action Agent is reached from three other surfaces where the
 * meter is nowhere in sight, so its refusal has to be self-contained.
 */
export class ActionAgentBudgetError extends Error {
  readonly statusCode = 429;
  constructor(
    readonly limit: number,
    readonly plan: PlanType,
    readonly resetsAt: Date,
  ) {
    super(
      `Monthly generation budget reached (${limit.toLocaleString("en-US")} output tokens on the ${plan} plan).`,
    );
    this.name = "ActionAgentBudgetError";
  }
}

/**
 * Assert the shared budget, in the Action Agent's own vocabulary.
 *
 * Delegates to assertMarketingBudget so the plan gate, the fail-closed Redis
 * behaviour and the unmetered-ENTERPRISE case all stay defined in exactly one
 * place — this only re-shapes the exceeded case to carry the reset date.
 */
export async function assertActionAgentBudget(
  tenantId: string,
  plan: PlanType,
  now = new Date(),
): Promise<{ used: number; limit: number | null }> {
  try {
    return await assertMarketingBudget(tenantId, plan, now);
  } catch (err) {
    if (err instanceof MarketingBudgetExceededError) {
      throw new ActionAgentBudgetError(err.limit, err.plan, marketingBudgetResetsAt(now));
    }
    throw err;
  }
}

export interface ActionAgentUsage {
  used: number;
  limit: number | null;
  /** ISO 8601, UTC. The copy that renders it names the timezone. */
  resetsAt: string;
  plan: PlanType;
}

export async function buildActionAgentUsage(
  tenantId: string,
  plan: PlanType,
  now = new Date(),
): Promise<ActionAgentUsage> {
  return {
    used: await marketingTokensUsed(tenantId, now),
    limit: marketingTokenLimit(plan),
    resetsAt: marketingBudgetResetsAt(now).toISOString(),
    plan,
  };
}

/**
 * Record what one call produced.
 *
 * BEST-EFFORT, EXACTLY AS quota.ts IS. By the time this runs the tokens are
 * spent and the draft is about to be written; a Redis blip must not turn a
 * successful generation into a failed job that then retries and spends again.
 * The `ai_api_calls` row is the durable record and Postgres is the truth if the
 * two ever disagree.
 */
async function meter(tenantId: string, kind: V1Kind, call: MarketingCallResult): Promise<void> {
  await Promise.all([
    prisma.aiApiCall
      .create({
        data: {
          tenantId,
          categoryId: `action_agent:${kind}`,
          model: MARKETING_MODEL,
          inputTokens: call.inputTokens,
          outputTokens: call.outputTokens,
          cacheReadTokens: call.cacheReadTokens,
        },
      })
      .catch((err: unknown) => {
        logger.error({ tenantId, kind, err }, "action agent: spend row not written");
      }),
    recordMarketingTokens(tenantId, call.outputTokens),
  ]);
}

/** Read the tenant's voice guide once per generation. */
async function loadTenant(tenantId: string): Promise<{ name: string; voiceGuide: string | null }> {
  const row = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { name: true, brandVoiceGuide: true },
  });
  return { name: row?.name ?? "", voiceGuide: row?.brandVoiceGuide ?? null };
}

export interface GenerateInput {
  tenantId: string;
  plan: PlanType;
  locale: DashLocale;
  /** Page URL for schema/faq. Ignored by review_reply. */
  url?: string;
  /** How many reviews to draft. Ignored by the page kinds. */
  reviewLimit?: number;
  /**
   * Draft for these reviews specifically. Set by re-generation, which has to
   * redraft the one review a reviewer rejected. Ignored by the page kinds.
   */
  reviewIds?: string[];
}

export interface GenerateOutcome {
  kind: V1Kind;
  items: ActionItemDto[];
  outputTokens: number;
  /** Set when the generator had nothing to work on. Not an error. */
  emptyReason?: string;
}

// ─── schema ─────────────────────────────────────────────────────────────────

export async function generateSchema(input: GenerateInput): Promise<GenerateOutcome> {
  const url = (input.url ?? "").trim();
  if (!url) throw new Error("schema generation needs a url");

  // Grounding first, budget second: an unreachable page must not cost a token,
  // and this is the step most likely to fail.
  const page = await gatherPageContext(url);
  const [findings, tenant] = await Promise.all([
    gatherAuditFindings(input.tenantId, page.url),
    loadTenant(input.tenantId),
  ]);

  await assertActionAgentBudget(input.tenantId, input.plan);

  const prompt = buildSchemaPrompt({
    url: page.url,
    title: page.title,
    metaDescription: page.metaDescription,
    h1s: page.h1s,
    existingSchemaTypes: page.existingSchemaTypes,
    content: page.content,
    auditFindings: findings,
    voiceGuide: tenant.voiceGuide,
  });

  const call = await callMarketingModel(prompt);
  await meter(input.tenantId, "schema", call);

  const fields = parseFieldsJson(call.text);
  const draft = {
    url: page.url,
    jsonLd: assembleSchema(fields, page.url),
    businessType: coerceBusinessType(fields.business_type),
    placement: schemaPlacement(page.url),
    omitted: omittedFields(fields),
  };

  const item = await createDraft({
    tenantId: input.tenantId,
    kind: "schema",
    sourceRef: page.url,
    draft,
  });
  await notifyActionDraftReady({ tenantId: input.tenantId, actionItemId: item.id, kind: "schema" });

  return { kind: "schema", items: [item], outputTokens: call.outputTokens };
}

// ─── faq ────────────────────────────────────────────────────────────────────

export async function generateFaq(input: GenerateInput): Promise<GenerateOutcome> {
  const url = (input.url ?? "").trim();
  if (!url) throw new Error("faq generation needs a url");

  const page = await gatherPageContext(url);
  const [trackedPrompts, inventory, tenant] = await Promise.all([
    gatherTrackedPrompts(input.tenantId),
    gatherPageInventory(input.tenantId, page.url),
    loadTenant(input.tenantId),
  ]);

  await assertActionAgentBudget(input.tenantId, input.plan);

  const prompt = buildFaqPrompt({
    url: page.url,
    title: page.title,
    content: page.content,
    trackedPrompts,
    pageInventory: inventory,
    locale: input.locale,
    voiceGuide: tenant.voiceGuide,
  });

  const call = await callMarketingModel(prompt);
  await meter(input.tenantId, "faq", call);

  const items = cleanFaqs(parseFieldsJson(call.text).faqs);
  if (!items.length) {
    // The tokens are spent and there is nothing to show for them. Say so rather
    // than writing an empty draft somebody has to open to discover is empty.
    return {
      kind: "faq",
      items: [],
      outputTokens: call.outputTokens,
      emptyReason: "no_answerable_questions",
    };
  }

  const rendered = renderFaq(items);
  const item = await createDraft({
    tenantId: input.tenantId,
    kind: "faq",
    sourceRef: page.url,
    draft: {
      url: page.url,
      items,
      html: rendered.html,
      markdown: rendered.markdown,
      sourcePrompts: trackedPrompts,
    },
  });
  await notifyActionDraftReady({ tenantId: input.tenantId, actionItemId: item.id, kind: "faq" });

  return { kind: "faq", items: [item], outputTokens: call.outputTokens };
}

// ─── review_reply ───────────────────────────────────────────────────────────

/**
 * Draft replies for a batch of unanswered reviews. ONE CALL PER REVIEW.
 *
 * Not one call for the batch, deliberately: a public reply is specific to what
 * one person wrote, and asking for ten at once produces ten variations of the
 * same paragraph. Ten small Haiku calls at a 500-token ceiling also cost less
 * than one call whose ceiling has to be ten times that.
 *
 * THE BUDGET IS RE-ASSERTED BEFORE EVERY REVIEW, not once for the batch. A
 * batch that crosses the limit halfway stops there and returns what it has —
 * the drafts already written are real work the tenant paid for and keeps.
 *
 * ONE NOTIFICATION PER DRAFT, which is what the typed payload
 * ({ actionItemId, kind }) can express. A batch of ten therefore puts ten rows
 * in the tray; MAX_REVIEW_BATCH is 10 to bound exactly that, and the default is
 * 5. A per-batch summary would need a different payload shape and a second
 * notification type.
 */
export async function generateReviewReplies(input: GenerateInput): Promise<GenerateOutcome> {
  const limit = Math.min(
    MAX_REVIEW_BATCH,
    Math.max(1, input.reviewLimit ?? DEFAULT_REVIEW_BATCH),
  );

  const reviews = await gatherUnansweredReviews(input.tenantId, limit, input.reviewIds);
  if (!reviews.length) {
    return { kind: "review_reply", items: [], outputTokens: 0, emptyReason: "nothing_unanswered" };
  }

  const tenant = await loadTenant(input.tenantId);

  // Assert once before the first call so an already-exhausted tenant is refused
  // rather than told "0 of 5 drafted".
  await assertActionAgentBudget(input.tenantId, input.plan);

  const items: ActionItemDto[] = [];
  let outputTokens = 0;

  for (const review of reviews) {
    if (items.length > 0) {
      // Re-assert between reviews. The first iteration is covered above.
      try {
        await assertActionAgentBudget(input.tenantId, input.plan);
      } catch (err) {
        if (err instanceof ActionAgentBudgetError) {
          logger.warn(
            { tenantId: input.tenantId, drafted: items.length, of: reviews.length },
            "action agent: review batch stopped at the budget",
          );
          break;
        }
        throw err;
      }
    }

    const prompt = buildReviewReplyPrompt({
      businessName: tenant.name,
      platform: review.platform,
      rating: review.rating,
      authorName: review.authorName,
      reviewText: review.content,
      locale: input.locale,
      voiceGuide: tenant.voiceGuide,
    });

    const call = await callMarketingModel(prompt);
    await meter(input.tenantId, "review_reply", call);
    outputTokens += call.outputTokens;

    const item = await createDraft({
      tenantId: input.tenantId,
      kind: "review_reply",
      // "<Model>:<id>", the same convention Notification.sourceRef uses.
      sourceRef: `ExternalReview:${review.id}`,
      draft: {
        reviewId: review.id,
        platform: review.platform,
        rating: review.rating,
        authorName: review.authorName,
        reviewExcerpt: review.content.slice(0, 5000),
        reply: call.text,
      },
    });
    items.push(item);

    await notifyActionDraftReady({
      tenantId: input.tenantId,
      actionItemId: item.id,
      kind: "review_reply",
    });
  }

  return { kind: "review_reply", items, outputTokens };
}

/** Kind -> generator. Exhaustive over V1_KINDS by construction. */
export const GENERATORS: Record<V1Kind, (input: GenerateInput) => Promise<GenerateOutcome>> = {
  schema: generateSchema,
  faq: generateFaq,
  review_reply: generateReviewReplies,
};

export function generate(kind: V1Kind, input: GenerateInput): Promise<GenerateOutcome> {
  return GENERATORS[kind](input);
}
