// src/lib/assistant/pro/store.ts
//
// Conversation persistence for the Pro assistant.
//
// EVERY READ IS TENANT-SCOPED IN THE WHERE CLAUSE. Not "fetch then compare" —
// `findFirst({ where: { id, tenantId } })`, never `findUnique({ where: { id } })`.
// CLAUDE.md states this rule for every route taking an `:id`, and a
// conversation id is exactly the kind of thing that ends up in a pasted URL. A
// check-then-read has a window; a WHERE clause does not.
//
// THE SAME RULE APPLIES TO MESSAGES, which have no tenantId column of their
// own. Their scope comes from the conversation, so every message read joins
// through `conversation: { tenantId }` rather than trusting a conversation id
// the caller handed us. That is what stops tenant A reading tenant B's
// transcript by guessing an id.
//
// DELETES ARE HARD AND CASCADING. `deleteMany({ where: { id, tenantId } })`
// removes the row and the foreign key removes its messages. deleteMany rather
// than delete because a miss must be "you deleted nothing", not a thrown
// P2025 the route then has to translate back into a 404.

import { prisma } from "@/lib/prisma";
import { clip } from "./evidence";
import type { StoredTurn, ToolSummaryEntry } from "./agent";

/** Conversations returned by the history list. */
const HISTORY_LIMIT = 30;
/** Messages replayed from one conversation. The agent trims again for the model. */
const TRANSCRIPT_LIMIT = 200;
/** Longest generated title. Long enough to recognise, short enough for a list. */
const TITLE_CHARS = 80;

export interface ConversationRow {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The history list as the client consumes it.
 *
 * Dates are ISO strings: this crosses the server→client boundary, and a Date
 * that survives serialization on one Next version and arrives as a string on
 * the next is a bug that only shows up in production.
 */
export interface ConversationListItem {
  id: string;
  title: string;
  updatedAt: string;
}

export function toListItem(row: ConversationRow): ConversationListItem {
  return { id: row.id, title: row.title, updatedAt: row.updatedAt.toISOString() };
}

export interface MessageRow {
  id: string;
  role: string;
  content: string;
  toolSummary: ToolSummaryEntry[] | null;
  createdAt: Date;
}

/**
 * A title from the customer's own first message.
 *
 * NEVER MODEL-AUTHORED, deliberately: a title is a locator in a list, and
 * paying for a generated one — plus the latency of generating it before the
 * answer can render — buys nothing a truncated question does not.
 */
export function titleFrom(message: string): string {
  const cleaned = clip(message, TITLE_CHARS);
  return cleaned || "New conversation";
}

/** This tenant's conversations, most recently used first. */
export async function listConversations(tenantId: string): Promise<ConversationRow[]> {
  return prisma.assistantConversation.findMany({
    where: { tenantId },
    orderBy: { updatedAt: "desc" },
    take: HISTORY_LIMIT,
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
}

/** One conversation's transcript, oldest first. Null when it is not this tenant's. */
export async function getTranscript(
  tenantId: string,
  conversationId: string,
): Promise<{ conversation: ConversationRow; messages: MessageRow[] } | null> {
  const conversation = await prisma.assistantConversation.findFirst({
    where: { id: conversationId, tenantId },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  if (!conversation) return null;

  const messages = await prisma.assistantMessage.findMany({
    // Scoped through the conversation rather than by the id alone: the row has
    // no tenantId of its own, so this join IS the tenant check.
    where: { conversationId, conversation: { tenantId } },
    orderBy: { createdAt: "asc" },
    take: TRANSCRIPT_LIMIT,
    select: {
      id: true,
      role: true,
      content: true,
      toolSummary: true,
      createdAt: true,
    },
  });

  return {
    conversation,
    messages: messages.map((message) => ({
      ...message,
      toolSummary: (message.toolSummary as ToolSummaryEntry[] | null) ?? null,
    })),
  };
}

/** The turns replayed to the model. Same tenant scoping as the transcript. */
export async function historyFor(
  tenantId: string,
  conversationId: string,
): Promise<StoredTurn[]> {
  const rows = await prisma.assistantMessage.findMany({
    where: { conversationId, conversation: { tenantId } },
    orderBy: { createdAt: "asc" },
    take: TRANSCRIPT_LIMIT,
    select: { role: true, content: true },
  });
  return rows
    .filter((row): row is { role: "user" | "assistant"; content: string } =>
      row.role === "user" || row.role === "assistant",
    )
    .map((row) => ({ role: row.role, content: row.content }));
}

/**
 * Resolve the conversation this turn belongs to, creating one if needed.
 *
 * An id that is not this tenant's resolves to null rather than throwing, and
 * the route turns that into a 404. Returning a NEW conversation instead would
 * silently swallow a cross-tenant id and make the isolation bug invisible.
 */
export async function resolveConversation(
  tenantId: string,
  userId: string,
  conversationId: string | undefined,
  firstMessage: string,
): Promise<{ id: string; created: boolean } | null> {
  if (conversationId) {
    const existing = await prisma.assistantConversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });
    return existing ? { id: existing.id, created: false } : null;
  }

  const created = await prisma.assistantConversation.create({
    data: { tenantId, userId, title: titleFrom(firstMessage) },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

/**
 * Append one exchange and bump the conversation's position in the list.
 *
 * ONE TRANSACTION. A stored question with no answer is a conversation that
 * renders as a dead end, and the customer has already been charged for the
 * tokens by the time this runs — so the two rows land together or neither
 * does.
 */
export async function appendExchange(input: {
  tenantId: string;
  conversationId: string;
  question: string;
  answer: string;
  toolSummary: ToolSummaryEntry[];
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  await prisma.$transaction([
    prisma.assistantMessage.create({
      data: {
        conversationId: input.conversationId,
        role: "user",
        content: input.question,
      },
    }),
    prisma.assistantMessage.create({
      data: {
        conversationId: input.conversationId,
        role: "assistant",
        content: input.answer,
        // Empty array rather than null when tools ran and returned nothing:
        // "looked at nothing" and "did not look" are different, and the UI
        // says so.
        //
        // Cast because Prisma's InputJsonValue does not accept an array of a
        // named interface without an index signature. The shape is JSON —
        // three primitives per entry, checked by ToolSummaryEntry at every
        // call site — so this narrows nothing that was not already narrow.
        toolSummary: input.toolSummary as unknown as object[],
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
      },
    }),
    // Re-scoped on tenantId even though the id was already resolved: this is
    // the write, and a write is where a scoping slip actually costs something.
    prisma.assistantConversation.updateMany({
      where: { id: input.conversationId, tenantId: input.tenantId },
      data: { updatedAt: new Date() },
    }),
  ]);
}

/** Hard delete, cascading to messages. Returns false when nothing matched. */
export async function deleteConversation(
  tenantId: string,
  conversationId: string,
): Promise<boolean> {
  const result = await prisma.assistantConversation.deleteMany({
    where: { id: conversationId, tenantId },
  });
  return result.count > 0;
}
