"use client";

/**
 * The Pro assistant's conversation surface — one component, two homes.
 *
 * SHARED BY THE WIDGET AND THE PAGE. The floating widget and /assistant render
 * this same component against the same endpoint, so a fix to the transcript or
 * the composer lands in both. `variant` changes layout only; nothing about how
 * a turn is sent or rendered branches on it.
 *
 * LIGHT DASHBOARD THEME. bg-gray-50 / white cards / gray borders, and the
 * shared Button and Input primitives. Nothing here reads the marketing site's
 * dark Binance tokens (--bg #181A20, --gold #FCD535) — those live on
 * src/app/[locale]/** and the two design systems stay apart. The public
 * assistant's AssistantChat.tsx is the dark twin of this file and is
 * deliberately not shared with it.
 *
 * COPY COMES FROM THE SERVER as a plain object. Same reason the public
 * assistant does it: the server→client boundary cannot carry functions, so the
 * page resolves the catalog and passes strings. Every visible string is in
 * ASSISTANT_COPY — there is no English written inline here, and
 * tests/assistant-pro-ui.test.tsx renders this in French and asserts it.
 *
 * THE ANSWER IS TEXT, AND IT IS RENDERED AS TEXT. No markdown parser and no
 * dangerouslySetInnerHTML: the model's output is untrusted by construction, and
 * "we render the model's HTML" is a cross-site-scripting hole with extra steps.
 * `whitespace-pre-wrap` gives paragraphs and lists their shape for free.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AssistantCopy } from "@/lib/i18n/dashboard";

export interface ToolSummaryEntry {
  tool: string;
  ok: boolean;
  cached: boolean;
}

export interface AssistantUsage {
  used: number;
  limit: number | null;
  resetsAt: string;
}

export interface PanelMessage {
  role: "user" | "assistant";
  content: string;
  toolSummary?: ToolSummaryEntry[] | null;
  budgetExceeded?: boolean;
}

interface ChatResponse {
  conversationId?: string;
  answer?: string;
  toolSummary?: ToolSummaryEntry[];
  budgetExceeded?: boolean;
  usage?: AssistantUsage;
  error?: string;
  code?: string;
}

export interface AssistantPanelProps {
  c: AssistantCopy;
  variant: "widget" | "page";
  /** Rendered as the "open full view" link. Widget only. */
  fullHref?: string;
  /** Seeded by the page when a saved conversation is opened. */
  initialMessages?: PanelMessage[];
  initialConversationId?: string | null;
  initialUsage?: AssistantUsage | null;
  /** Called after a turn so the page can refresh its history list. */
  onTurn?: (conversationId: string) => void;
}

/** Human-readable tool label: "getGscQueryStats" -> "Gsc query stats". */
function toolLabel(tool: string): string {
  const words = tool
    .replace(/^get|^run/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : tool;
}

function formatUsage(c: AssistantCopy, usage: AssistantUsage): string {
  const used = usage.used.toLocaleString();
  if (usage.limit === null) return c.usageUnmetered.replace("{used}", used);
  return c.usageTemplate
    .replace("{used}", used)
    .replace("{limit}", usage.limit.toLocaleString());
}

export function AssistantPanel({
  c,
  variant,
  fullHref,
  initialMessages,
  initialConversationId,
  initialUsage,
  onTurn,
}: AssistantPanelProps) {
  // Props seed state ONCE, at mount. Switching conversations is a REMOUNT —
  // the page passes a `key` — rather than an effect copying props into state.
  // That is React's own guidance, and it is also why this file has no
  // props-sync effect to keep correct as props grow.
  const [messages, setMessages] = useState<PanelMessage[]>(initialMessages ?? []);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId ?? null,
  );
  const [usage, setUsage] = useState<AssistantUsage | null>(initialUsage ?? null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Newest turn into view. Scrolling the log rather than the window so the
    // widget never yanks the page underneath it.
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = useCallback(
    async (text: string, forceRefresh = false) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      setBusy(true);
      setError("");
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setQuestion("");

      try {
        const res = await fetch("/api/assistant/pro/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            // Omitted on the first turn: the server creates the conversation.
            ...(conversationId ? { conversationId } : {}),
            // The ONE thing the customer controls that costs money. It is a
            // button, not something the model can ask for — see tools.ts.
            ...(forceRefresh ? { forceRefresh: true } : {}),
          }),
        });

        const data = (await res.json().catch(() => null)) as ChatResponse | null;

        if (!res.ok || !data?.answer) {
          setError(errorCopy(c, data?.code));
          // The question stays in the transcript: it was asked, and dropping
          // it would make a failure look like the customer never typed.
          return;
        }

        if (data.conversationId) {
          setConversationId(data.conversationId);
          onTurn?.(data.conversationId);
        }
        if (data.usage) setUsage(data.usage);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.answer as string,
            toolSummary: data.toolSummary ?? null,
            budgetExceeded: data.budgetExceeded === true,
          },
        ]);
      } catch {
        setError(c.errNetwork);
      } finally {
        setBusy(false);
      }
    },
    [busy, c, conversationId, onTurn],
  );

  const isWidget = variant === "widget";

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-gray-900">{c.heading}</h2>
          {!isWidget && <p className="mt-1 text-sm text-gray-500">{c.subtitle}</p>}
        </div>
        {isWidget && fullHref && (
          <Link
            href={fullHref}
            className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            {c.openFullView}
          </Link>
        )}
      </div>

      {/* Transcript */}
      <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl">
            <p className="text-sm font-medium text-gray-900">{c.emptyTitle}</p>
            <ul className="mt-3 space-y-2">
              {c.suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => void send(suggestion)}
                    disabled={busy}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="mx-auto max-w-3xl space-y-4">
            {messages.map((message, index) => (
              <li key={index}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {message.role === "user" ? c.you : c.assistant}
                </p>
                <div
                  className={
                    message.role === "user"
                      ? "rounded-lg bg-blue-50 px-3 py-2 text-sm whitespace-pre-wrap text-gray-900"
                      : "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm whitespace-pre-wrap text-gray-800"
                  }
                >
                  {message.content}
                </div>

                {message.toolSummary && message.toolSummary.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {c.checked}:{" "}
                    {message.toolSummary
                      .map(
                        (entry) =>
                          `${toolLabel(entry.tool)}${
                            !entry.ok
                              ? ` (${c.failedSuffix})`
                              : entry.cached
                                ? ` (${c.cachedSuffix})`
                                : ""
                          }`,
                      )
                      .join(", ")}
                  </p>
                )}

                {message.budgetExceeded && (
                  <p className="mt-1 text-xs text-amber-700">{c.budgetNote}</p>
                )}
              </li>
            ))}
            {busy && <li className="text-sm text-gray-500">{c.sending}</li>}
          </ul>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        {error && (
          <p role="alert" className="mb-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(question);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor={`assistant-input-${variant}`} className="sr-only">
            {c.placeholder}
          </label>
          <textarea
            id={`assistant-input-${variant}`}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter is a newline — the convention every
              // chat surface uses, and the one people try first.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(question);
              }
            }}
            rows={isWidget ? 2 : 3}
            maxLength={4000}
            placeholder={c.placeholder}
            disabled={busy}
            className="block w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
          />
          <div className="flex shrink-0 flex-col gap-2">
            <Button type="submit" size="sm" loading={busy} disabled={!question.trim()}>
              {busy ? c.sending : c.send}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              title={c.refreshHint}
              disabled={busy || !question.trim()}
              onClick={() => void send(question, true)}
            >
              {c.refresh}
            </Button>
          </div>
        </form>

        {usage && <p className="mt-2 text-xs text-gray-400">{formatUsage(c, usage)}</p>}
      </div>
    </div>
  );
}

/**
 * Map an API error code to catalog copy.
 *
 * THE SERVER'S OWN `error` STRING IS NEVER RENDERED. Those sentences are
 * written in English in the route handlers, and showing one would drop English
 * into a French panel — the exact failure the i18n render test looks for. The
 * code is the contract; the wording is the catalog's job.
 */
function errorCopy(c: AssistantCopy, code: string | undefined): string {
  switch (code) {
    case "ASSISTANT_DISABLED":
      return c.errDisabled;
    case "RATE_LIMITED":
      return c.errRateLimited;
    case "BUDGET_REACHED":
    case "BUDGET_UNAVAILABLE":
      return c.errBudget;
    default:
      return c.errGeneric;
  }
}
