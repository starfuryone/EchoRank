// src/lib/action-agent/prompts.ts
//
// The ONLY place an Action Agent prompt is built. Same injection boundary
// Marketing Studio draws in src/lib/marketing/prompt.ts: the API accepts a
// KIND and a source id, never prompt text, never a model id, never a token
// ceiling. A caller cannot rewrite the instructions; the worst they can do is
// own a page or a review whose text is unusual, and that text lands in the user
// message where user text belongs.
//
// SYSTEM BLOCK ORDER, most-shared first — the ordering a cached prefix wants,
// and the same one assemblePrompt uses:
//   1. the kind's own instruction  — identical for every tenant
//   2. the brand voice guide       — per tenant, absent for most
// cache_control is deliberately unset, for the reason prompt.ts documents at
// length: Haiku 4.5's minimum cacheable prefix is 4096 tokens and these come to
// a few hundred.
//
// THE REVIEW-REPLY INSTRUCTION IS NOT NEW. It is the one /api/ai/respond has
// been carrying, moved here so both callers read the same five clauses. That
// route now imports it. There was no other "tone system" to import: `tone` on
// that route was an unvalidated free-text field interpolated into the prompt,
// and this module keeps that shape while making the brand voice guide — the
// only durable tone asset this product actually stores — the primary input.

import type { DashLocale } from "@/lib/i18n/dashboard";
import type { SystemBlock } from "@/lib/marketing/prompt";
import { ALLOWED_BUSINESS_TYPES } from "./assemble";
import type { V1Kind } from "./types";

/** Output ceiling per kind. Read by the generator, never by the client. */
export const MAX_TOKENS: Record<V1Kind, number> = {
  // Matches remediate.py, which produces the same field set from the same
  // grounding context and has been sized against real pages in production.
  schema: 1800,
  // Higher: 6-10 answers of real length, versus schema's 5-6 short ones.
  faq: 2000,
  // Matches /api/ai/respond. A public review reply is 2-5 sentences; a ceiling
  // that allows an essay produces one.
  review_reply: 500,
};

/**
 * Deliverable language. English prompts, localized output — the same trade
 * prompt.ts makes, and for the same reason: translating a prompt costs
 * generation quality.
 *
 * SCHEMA IS EXEMPT and always writes in the page's own language, because a
 * JSON-LD `description` in French on an English page describes the page
 * wrongly. The FAQ and the reply follow the dashboard locale.
 */
const LANGUAGE_INSTRUCTION: Record<DashLocale, string | null> = {
  en: null,
  fr: "Write every user-facing string in French. Use natural, idiomatic French — not translated English.",
  "de-CH": "Write every user-facing string in Swiss High German. Use ss, never ß.",
};

// ─── schema ─────────────────────────────────────────────────────────────────

const SCHEMA_INSTRUCTION =
  "You are an AI-search optimization assistant. You extract structured-data " +
  "fields for a business, grounded ONLY in the page content provided. Never " +
  "invent facts. If a field is not present in the content, omit it. Write in " +
  "the business's own register. Return ONLY a single JSON object, no prose, " +
  "no markdown fences.";

export interface SchemaPromptInput {
  url: string;
  title: string;
  metaDescription: string | null;
  h1s: string[];
  existingSchemaTypes: string[];
  /** Page text, already truncated by the caller. */
  content: string;
  /** Failing audit checks, as "key — label" lines. Empty when none were run. */
  auditFindings: string[];
  voiceGuide: string | null;
}

export function buildSchemaPrompt(input: SchemaPromptInput): {
  system: SystemBlock[];
  userMessage: string;
  maxTokens: number;
} {
  const system: SystemBlock[] = [{ type: "text", text: SCHEMA_INSTRUCTION }];
  if (input.voiceGuide?.trim()) {
    system.push({
      type: "text",
      text: `Write in this brand's established voice:\n\n${input.voiceGuide.trim()}`,
    });
  }

  const parts = [
    `PAGE URL: ${input.url}`,
    `TITLE: ${input.title || "(none)"}`,
    `EXISTING META DESCRIPTION: ${input.metaDescription || "(none)"}`,
    `H1S: ${input.h1s.join(" | ") || "(none)"}`,
    `EXISTING SCHEMA TYPES: ${input.existingSchemaTypes.join(", ") || "(none)"}`,
  ];

  // The audit context. Present only when the tenant has a Site Audit for this
  // domain — it narrows what the model is being asked to fix rather than
  // changing the shape of the answer, so its absence degrades quality without
  // breaking the contract.
  if (input.auditFindings.length) {
    parts.push(
      "",
      "OUR AUDIT FLAGGED THESE ON THIS SITE (fix what structured data can fix, ignore the rest):",
      ...input.auditFindings.map((finding) => `- ${finding}`),
    );
  }

  parts.push(
    "",
    "PAGE CONTENT (truncated):",
    '"""',
    input.content,
    '"""',
    "",
    "Produce a JSON object with EXACTLY these keys (use null or [] when unknown):",
    "{",
    '  "business_name": string|null,',
    `  "business_type": one of [${[...ALLOWED_BUSINESS_TYPES].sort().join(", ")}],`,
    '  "description": string,      // <=160 chars, factual, no marketing fluff',
    '  "services": [string],       // concrete offerings named on the page',
    '  "area_served": [string],    // ONLY if the page indicates locality',
    '  "same_as": [string],        // social/profile URLs found in the content only',
    '  "faqs": [ {"q": string, "a": string} ]  // 5-6, answerable from the content,',
    "                                          // phrased the way a user would ask an AI",
    "}",
    "",
    "Rules: every FAQ answer must be supported by the page content. Pick the single",
    "best business_type. NEVER include an address or a telephone number, even if the",
    "page shows one — those are added by a human who can verify them.",
  );

  return { system, userMessage: parts.join("\n"), maxTokens: MAX_TOKENS.schema };
}

// ─── faq ────────────────────────────────────────────────────────────────────

const FAQ_INSTRUCTION =
  "You write FAQ content for a business, grounded ONLY in the page inventory " +
  "and page content provided. Never invent a fact, a price, a guarantee or a " +
  "policy. If a tracked question cannot be answered from the material given, " +
  "skip it rather than answering it vaguely. Return ONLY a single JSON object, " +
  "no prose, no markdown fences.";

export interface FaqPromptInput {
  url: string;
  title: string;
  content: string;
  /** The tenant's highest-value tracked Watcher prompts, best first. */
  trackedPrompts: string[];
  /** Titles/URLs the site already publishes, so answers can point at them. */
  pageInventory: { url: string; title: string }[];
  locale: DashLocale;
  voiceGuide: string | null;
}

export function buildFaqPrompt(input: FaqPromptInput): {
  system: SystemBlock[];
  userMessage: string;
  maxTokens: number;
} {
  const system: SystemBlock[] = [{ type: "text", text: FAQ_INSTRUCTION }];
  if (input.voiceGuide?.trim()) {
    system.push({
      type: "text",
      text: `Write in this brand's established voice:\n\n${input.voiceGuide.trim()}`,
    });
  }

  const parts = [`PAGE URL: ${input.url}`, `TITLE: ${input.title || "(none)"}`];

  // The Watcher half. These are the questions the tenant is already tracking
  // across AI engines, so an FAQ built from them answers the questions their
  // buyers are actually asking a model — which is the entire premise of the
  // kind. Absent for a tenant tracking nothing; the prompt degrades to "write
  // an FAQ for this page" and says so rather than pretending otherwise.
  if (input.trackedPrompts.length) {
    parts.push(
      "",
      "QUESTIONS THIS BRAND TRACKS ACROSS AI ENGINES, most important first:",
      ...input.trackedPrompts.map((prompt, index) => `${index + 1}. ${prompt}`),
    );
  } else {
    parts.push("", "This brand tracks no questions yet — infer them from the page content.");
  }

  if (input.pageInventory.length) {
    parts.push(
      "",
      "PAGES THIS SITE ALREADY PUBLISHES (link to one when an answer needs more room):",
      ...input.pageInventory.map((page) => `- ${page.title || page.url} — ${page.url}`),
    );
  }

  parts.push(
    "",
    "PAGE CONTENT (truncated):",
    '"""',
    input.content,
    '"""',
    "",
    "Produce a JSON object with EXACTLY this key:",
    "{",
    '  "faqs": [ {"q": string, "a": string} ]',
    "}",
    "",
    "Rules: between 6 and 10 pairs. Phrase each question the way a person would ask",
    "an AI assistant, not the way a marketer would headline it. Answer in 2-4",
    "sentences, specific and checkable. Cover the tracked questions above first,",
    "in order, and skip any the material cannot answer.",
  );

  const language = LANGUAGE_INSTRUCTION[input.locale];
  if (language) parts.push("", language);

  return { system, userMessage: parts.join("\n"), maxTokens: MAX_TOKENS.faq };
}

// ─── review_reply ───────────────────────────────────────────────────────────

/**
 * The public-reply instruction, verbatim from /api/ai/respond.
 *
 * EXPORTED AND IMPORTED RATHER THAN COPIED. That route is the only prior art
 * this repo had for drafting a reply, and two divergent copies of a paragraph
 * that says "never admit legal fault" is precisely the kind of drift that ends
 * up in front of a lawyer. `tests/action-agent-generate.test.ts` asserts the
 * route still imports this constant.
 */
export const REVIEW_REPLY_INSTRUCTION =
  "You draft public replies to customer reviews for a local business. " +
  "Write in the business's voice: professional, warm, specific to what the reviewer said, 2 to 5 sentences. " +
  "Thank positive reviewers concretely. For negative reviews: acknowledge, never argue, never admit legal fault, " +
  "offer to make it right and invite offline contact. No emojis unless the tone asks. " +
  "Never fabricate facts, discounts or promises. Output only the reply text.";

export interface ReviewReplyPromptInput {
  businessName: string;
  platform: string;
  rating: number | null;
  authorName: string | null;
  reviewText: string;
  locale: DashLocale;
  voiceGuide: string | null;
}

export function buildReviewReplyPrompt(input: ReviewReplyPromptInput): {
  system: SystemBlock[];
  userMessage: string;
  maxTokens: number;
} {
  const system: SystemBlock[] = [{ type: "text", text: REVIEW_REPLY_INSTRUCTION }];
  // The brand voice guide replaces the free-text `tone` field /api/ai/respond
  // accepts. It is durable, tenant-owned and produced by Marketing Studio's
  // own voice analyser, where `tone` was a string somebody typed into a request
  // body once and nothing ever stored.
  if (input.voiceGuide?.trim()) {
    system.push({
      type: "text",
      text: `Write in this brand's established voice:\n\n${input.voiceGuide.trim()}`,
    });
  }

  const parts = [`Business: ${input.businessName || "the business"}`, `Platform: ${input.platform}`];
  if (typeof input.rating === "number") parts.push(`Rating: ${input.rating}/5`);
  if (input.authorName) parts.push(`Reviewer: ${input.authorName}`);
  parts.push(`Review:\n${input.reviewText}`);

  const language = LANGUAGE_INSTRUCTION[input.locale];
  if (language) parts.push("", language);

  return { system, userMessage: parts.join("\n"), maxTokens: MAX_TOKENS.review_reply };
}
