// src/lib/action-agent/types.ts
//
// The Action Agent's vocabulary: what a draft is, what shape each kind carries,
// and which status transitions exist.
//
// THE ENUM IS WIDE, THE GENERATORS ARE NARROW. `ActionItemKind` ships all five
// values because adding one to a live Postgres enum later is a migration
// against a table with rows in it. `V1_KINDS` is the half that has a generator;
// everything user-facing iterates that, so `page` and `gbp_post` are invisible
// until someone writes them a generator and adds them here.
//
// NOTHING HERE PUBLISHES. `applied` is a human saying "I pasted this in", not a
// code path that pasted it. See the ActionItem model comment.

import { z } from "zod";
import type { ActionItemKind, ActionItemStatus } from "@/generated/prisma";

export type { ActionItemKind, ActionItemStatus };

/** Kinds with a generator today. The UI, the API and the tests all read this. */
export const V1_KINDS = ["schema", "faq", "review_reply"] as const;
export type V1Kind = (typeof V1_KINDS)[number];

/** Declared, not yet generated. Named so a reader does not go hunting. */
export const V2_KINDS = ["page", "gbp_post"] as const;

export const ACTION_ITEM_STATUSES = ["draft", "approved", "applied", "rejected"] as const;

export function isV1Kind(value: unknown): value is V1Kind {
  return typeof value === "string" && (V1_KINDS as readonly string[]).includes(value);
}

export function isActionItemStatus(value: unknown): value is ActionItemStatus {
  return typeof value === "string" && (ACTION_ITEM_STATUSES as readonly string[]).includes(value);
}

// ─── The state machine ──────────────────────────────────────────────────────

/**
 * The ONLY legal transitions. The PATCH route refuses anything absent from
 * here, which is what makes "approved" a gate rather than a label.
 *
 * WHY `draft -> applied` IS NOT HERE. Apply is what happens after a human has
 * read the draft and said yes; letting a surface skip approval would make the
 * approval step decorative, and the audit trail would no longer answer "who
 * agreed to this" separately from "who used it". A single-reviewer tenant
 * clicks twice, which is the price of the trail.
 *
 * WHY BOTH TERMINALS ARE EMPTY. `rejected` does not reopen — re-generating
 * writes a new row with the same sourceRef (see reGenerate in store.ts), so the
 * history of what was refused survives. `applied` does not reopen either: the
 * change is out in the world, and un-applying it is not something this table
 * can make true.
 */
export const ACTION_ITEM_TRANSITIONS: Record<ActionItemStatus, readonly ActionItemStatus[]> = {
  draft: ["approved", "rejected"],
  approved: ["applied", "rejected"],
  applied: [],
  rejected: [],
};

export function canTransition(from: ActionItemStatus, to: ActionItemStatus): boolean {
  return ACTION_ITEM_TRANSITIONS[from].includes(to);
}

/** Statuses whose `draft` payload a reviewer may still edit. */
export function isEditable(status: ActionItemStatus): boolean {
  return status === "draft";
}

// ─── Draft payloads, one schema per kind ────────────────────────────────────

/**
 * The generated JSON-LD, plus where to put it.
 *
 * `jsonLd` IS A COMPLETE <script> BLOCK, assembled deterministically in
 * schema-build.ts from fields the model returned — never a string the model
 * wrote. That is the same division remediate.py draws, and for the same reason:
 * a model that writes markup eventually writes markup that does not parse.
 */
export const SchemaDraftSchema = z.object({
  url: z.string().min(1).max(2048),
  /** The pasteable `<script type="application/ld+json">…</script>`. */
  jsonLd: z.string().min(1).max(200_000),
  /** schema.org type chosen, echoed so the reviewer can sanity-check it. */
  businessType: z.string().min(1).max(64),
  /** Ordered, imperative placement steps. Rendered as a list, not prose. */
  placement: z.array(z.string().min(1).max(400)).min(1).max(10),
  /** Fields the page did not evidence, so the reviewer knows what was omitted
   *  rather than assuming the model had nothing to say. */
  omitted: z.array(z.string().min(1).max(64)).max(20).default([]),
});
export type SchemaDraft = z.infer<typeof SchemaDraftSchema>;

/**
 * 6-10 question/answer pairs plus both renderings.
 *
 * `html` and `markdown` are DERIVED from `items` and are re-derived on every
 * edit — see renderFaq(). Storing them anyway is what makes the copy buttons a
 * clipboard write rather than a render, and what an API consumer gets.
 */
export const FaqDraftSchema = z.object({
  url: z.string().min(1).max(2048),
  items: z
    .array(
      z.object({
        q: z.string().min(1).max(300),
        a: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
  html: z.string().max(200_000),
  markdown: z.string().max(200_000),
  /** The Watcher prompts this FAQ was built to answer, for the reviewer's
   *  "why these questions" check. Empty when the tenant tracks none. */
  sourcePrompts: z.array(z.string().min(1).max(500)).max(20).default([]),
});
export type FaqDraft = z.infer<typeof FaqDraftSchema>;

/**
 * One drafted public reply, and enough of the review to judge it against.
 *
 * COPY-ONLY IN V1, AND THAT IS A PRODUCT DECISION, NOT AN OMISSION. This repo
 * has no path that posts a reply to Google, Trustpilot or Facebook —
 * `ExternalReview.replyContent` has no writer anywhere in src/ — so there is
 * nothing for an apply adapter to call. `applied` therefore means the same
 * thing here it means for the other two kinds: a human pasted it in. See
 * docs/agents/gotchas.md for what a real reply pipeline would take.
 */
export const ReviewReplyDraftSchema = z.object({
  reviewId: z.string().min(1).max(64),
  platform: z.string().min(1).max(32),
  rating: z.number().nullable(),
  authorName: z.string().max(200).nullable(),
  /** Trimmed copy of what is being answered. Stored rather than joined so the
   *  queue renders in one read and still reads correctly if the review is later
   *  purged by retention. */
  reviewExcerpt: z.string().max(5000),
  reply: z.string().min(1).max(4000),
});
export type ReviewReplyDraft = z.infer<typeof ReviewReplyDraftSchema>;

export type ActionItemDraft = SchemaDraft | FaqDraft | ReviewReplyDraft;

/** Kind -> its payload validator. Exhaustive over V1_KINDS by construction. */
export const DRAFT_SCHEMAS: Record<V1Kind, z.ZodType> = {
  schema: SchemaDraftSchema,
  faq: FaqDraftSchema,
  review_reply: ReviewReplyDraftSchema,
};

/**
 * Validate a draft payload against its kind.
 *
 * Called on GENERATION and again on EVERY EDIT. The second one is the one that
 * matters: the review queue edits in place, so without it a reviewer could
 * empty the reply body and then approve an empty reply.
 */
export function parseDraft(kind: V1Kind, value: unknown):
  | { ok: true; draft: ActionItemDraft }
  | { ok: false; error: string } {
  const parsed = DRAFT_SCHEMAS[kind].safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  return { ok: true, draft: parsed.data as ActionItemDraft };
}

// ─── The row as the UI consumes it ──────────────────────────────────────────

export interface ActionItemDto {
  id: string;
  kind: ActionItemKind;
  sourceRef: string;
  draft: unknown;
  status: ActionItemStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectedNote: string | null;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
}
