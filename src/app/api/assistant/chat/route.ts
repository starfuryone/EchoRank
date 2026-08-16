/**
 * POST /api/assistant/chat — one turn of the anonymous Echorank assistant.
 *
 * PUBLIC BY DESIGN, AND ORIGIN-PROTECTED. The path is an exact entry in the
 * proxy's `publicExactPaths`, so an anonymous visitor reaches it without being
 * 307'd to /login. It is NOT exempt from the CSRF origin check — same posture as
 * /api/av/audit, and the deliberate opposite of /api/public/v1/*: this endpoint
 * is called by a browser on our own pages, so requiring a same-origin Origin or
 * Referer costs nothing legitimate and closes the door on a third-party page
 * spending our model budget through a visitor's connection.
 *
 * NO SESSION, NO COOKIE, NO DATABASE WRITE. The only state a turn touches is
 * Redis: the per-IP counters and the shared public-audit cache. Conversations
 * are held in the browser and are never persisted.
 *
 * COST ORDER: cache → heuristics → model. See src/lib/assistant/agent.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/infrastructure/observability/logger";
import { MAX_HISTORY_TURNS, MAX_MESSAGE_CHARS, runTurn } from "@/lib/assistant/agent";
import { assistantEnabled, assistantLimits } from "@/lib/assistant/config";
import {
  consume,
  outputBudgetExhausted,
  peek,
  recordOutputTokens,
  refund,
  visitorIp,
} from "@/lib/assistant/limits";
import { AssistantKeyMissingError, AssistantUpstreamError } from "@/lib/assistant/model";
import type { AssistantLocale } from "@/lib/assistant/prompt";

/** Node runtime: the Redis client and the sidecar call both need it. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCALES = ["en", "en-CA", "fr", "fr-CA", "de-CH"] as const;

const BodySchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .max(MAX_HISTORY_TURNS * 2)
    .optional(),
  locale: z.enum(LOCALES).optional(),
  /** Set when the visitor used the scan box rather than typing a domain. */
  domain: z.string().trim().min(3).max(253).optional(),
});

const COPY = {
  disabled: "The Echorank assistant is offline for maintenance. Try again shortly.",
  noIp: "We could not identify your connection, so the assistant is unavailable. If you use a VPN or proxy, try disabling it.",
  rateLimited:
    "You have used today's free assistant messages. They reset at midnight UTC — or create an account for unlimited use.",
  scanLimited:
    "You have used today's free site scan. It resets at midnight UTC — or create an account to scan any time.",
  badRequest: "Check what you entered and try again.",
  invalidDomain: "That does not look like a public website address. Try example.com.",
  unavailable: "The assistant is briefly unavailable. Try again in a few minutes.",
  budget:
    "The free assistant has hit this month's shared usage budget. Create an account to keep going.",
} as const;

/** Every response from this route is uncacheable — answers are per-visitor. */
function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function error(message: string, code: string, status: number, extra: Record<string, unknown> = {}) {
  return json({ error: message, code, ...extra }, status);
}

export async function POST(request: Request) {
  // The kill switch, before anything is parsed or spent.
  if (!assistantEnabled()) {
    return error(COPY.disabled, "ASSISTANT_DISABLED", 503);
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return error(COPY.badRequest, "INVALID_REQUEST", 400);
  }

  // Attribution before limits: a request we cannot attribute cannot be limited,
  // and there is deliberately no shared 'unknown' bucket to fall into.
  const ip = visitorIp(request);
  if (!ip) {
    return error(COPY.noIp, "NO_CLIENT_IP", 403);
  }

  if (await outputBudgetExhausted()) {
    return error(COPY.budget, "BUDGET_REACHED", 429);
  }

  const limits = assistantLimits();
  let scanConsumed = false;
  let chatConsumed = false;
  /**
   * The refusal that stopped the turn, for its reset hint and its wording.
   *
   * A box rather than a bare `let`: the assignment happens inside a callback,
   * and TypeScript narrows a `let` initialised to null down to `never` at the
   * read site because it cannot see the callback run.
   */
  const denial: { at: { bucket: "chat" | "scan"; resetSeconds: number | null } | null } = {
    at: null,
  };

  let result: Awaited<ReturnType<typeof runTurn>>;
  try {
    result = await runTurn({
      message: parsed.data.message,
      history: parsed.data.history ?? [],
      locale: (parsed.data.locale ?? "en") as AssistantLocale,
      scanTarget: parsed.data.domain,
      spendScan: async () => {
        const decision = await consume("scan", ip, limits.scanPerDay);
        if (decision.ok) scanConsumed = true;
        else denial.at = { bucket: "scan", resetSeconds: decision.resetSeconds ?? null };
        return { ok: decision.ok };
      },
      spendChat: async () => {
        const decision = await consume("chat", ip, limits.chatPerDay);
        if (decision.ok) chatConsumed = true;
        else denial.at = { bucket: "chat", resetSeconds: decision.resetSeconds ?? null };
        return { ok: decision.ok };
      },
    });
  } catch (err) {
    // The model call is the last thing a turn does, so a throw here means the
    // visitor was charged for an answer they never got. Hand both back.
    if (chatConsumed) await refund("chat", ip);
    if (scanConsumed) await refund("scan", ip);
    logger.warn({ err: String(err) }, "assistant turn failed");
    return assistantErrorResponse(err);
  }

  if (!result.ok) {
    if (result.reason === "invalid_domain") {
      if (scanConsumed) await refund("scan", ip);
      return error(COPY.invalidDomain, "INVALID_DOMAIN", 400);
    }
    const refused = denial.at;
    return error(
      refused?.bucket === "scan" ? COPY.scanLimited : COPY.rateLimited,
      "RATE_LIMITED",
      429,
      { resetSeconds: refused?.resetSeconds ?? null },
    );
  }

  // A scan that consumed an allowance but produced nothing cost us nothing —
  // the visitor keeps their run rather than paying for our upstream's failure.
  if (scanConsumed && !result.scan) {
    await refund("scan", ip);
  }

  await recordOutputTokens(result.cost.outputTokens);

  const [chatLeft, scanLeft] = await Promise.all([
    peek("chat", ip, limits.chatPerDay),
    peek("scan", ip, limits.scanPerDay),
  ]);

  logger.info(
    {
      intent: result.intent,
      model: result.cost.model,
      scanCached: result.cost.scanCached,
      scanFetched: result.cost.scanFetched,
      outputTokens: result.cost.outputTokens,
      inputTokens: result.cost.inputTokens,
      cacheReadTokens: result.cost.cacheReadTokens,
      lookups: result.cost.lookups,
    },
    "assistant turn",
  );

  return json({
    answer: result.answer,
    intent: result.intent,
    scan: result.scan,
    cached: result.cost.scanCached,
    remaining: { chat: chatLeft, scan: scanLeft },
  });
}

/**
 * Errors from the model layer carry their own status and visitor-safe copy.
 *
 * NOT EXPORTED. A route module may only export HTTP verbs and the framework's
 * own config fields; anything else is rejected as an invalid route export.
 */
function assistantErrorResponse(err: unknown): NextResponse {
  if (err instanceof AssistantKeyMissingError) {
    return error(COPY.disabled, "ASSISTANT_DISABLED", 503);
  }
  if (err instanceof AssistantUpstreamError) {
    return error(err.message, "UPSTREAM_UNAVAILABLE", 502);
  }
  return error(COPY.unavailable, "UNAVAILABLE", 503);
}
