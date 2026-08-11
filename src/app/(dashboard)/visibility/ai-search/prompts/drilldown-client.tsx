"use client";

// One prompt, and what every engine actually said.
//
// RAW ANSWERS RENDER AS TEXT. Never dangerouslySetInnerHTML, never a markdown
// renderer. This string was written by someone else's model, quoting pages
// written by strangers, and it reaches a logged-in dashboard — the one place an
// injected <script> or a crafted <a> would do real damage. React escapes text
// children by default; the `whitespace-pre-wrap` below is what keeps the answer
// readable without ever interpreting it. If a future ticket asks for formatted
// answers, it needs a sanitiser and a security review, not a quick swap.
//
// SKIPPED AND FAILED RUNS ARE SHOWN. "We did not ask on Tuesday" is part of
// reading a prompt's history; hiding it makes a gap look like a run where
// nobody mentioned the brand, which is the opposite conclusion.

import { useState } from "react";
import Link from "next/link";
import { formatInstant, positionLabel } from "@/lib/ai-monitor/dashboard/display";

interface PromptRow {
  id: string;
  text: string;
  category: string | null;
  active: boolean;
  tags: string[];
  lastRunAt: Date | string | null;
}

interface Answer {
  runId: string;
  engine: string;
  createdAt: Date | string;
  status: string;
  brandMentioned: boolean;
  brandPosition: number | null;
  sentiment: string | null;
  rawResponse: string | null;
  citations: { url: string; domain: string; title: string | null; isMonitored: boolean }[];
  competitors: { name: string; position: number | null }[];
}

export function PromptDrilldown({
  brand,
  prompts,
  selected,
  answers,
  timezone,
}: {
  brand: { id: string; name: string };
  prompts: PromptRow[];
  selected: PromptRow | null;
  answers: Answer[];
  timezone: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={`/visibility/ai-search?brand=${brand.id}`} className="text-sm text-blue-600">
        ← {brand.name}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">Questions</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <ul className="space-y-2">
          {prompts.map((prompt) => (
            <PromptItem
              key={prompt.id}
              prompt={prompt}
              brandId={brand.id}
              selected={selected?.id === prompt.id}
            />
          ))}
        </ul>

        <div>
          {!selected ? (
            <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
              Pick a question to see what each engine answered.
            </p>
          ) : answers.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
              This question has not been asked yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {answers.map((answer) => (
                <AnswerCard key={answer.runId} answer={answer} timezone={timezone} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function PromptItem({
  prompt,
  brandId,
  selected,
}: {
  prompt: PromptRow;
  brandId: string;
  selected: boolean;
}) {
  const [active, setActive] = useState(prompt.active);
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    setBusy(true);
    // Optimistic, then reverted on failure: the switch is the one control on
    // this page and a spinner on a checkbox reads as a broken checkbox.
    setActive(next);
    try {
      const res = await fetch(`/api/ai-search/prompts/${prompt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setActive(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={`rounded-xl border p-3 ${
        selected ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-blue-600"
          checked={active}
          disabled={busy}
          aria-label={`Track this question: ${prompt.text}`}
          onChange={(e) => toggle(e.target.checked)}
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/visibility/ai-search/prompts?brand=${brandId}&prompt=${prompt.id}`}
            className="block text-sm text-gray-900 hover:text-blue-700"
          >
            {prompt.text}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-500">
            {prompt.category && <span>{prompt.category}</span>}
            {prompt.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5">
                {tag}
              </span>
            ))}
            {!active && <span className="text-gray-400">paused</span>}
          </div>
        </div>
      </div>
    </li>
  );
}

const STATUS_NOTE: Record<string, string> = {
  SKIPPED_CAP: "Skipped — monthly AI budget reached. Nothing was asked or charged.",
  FAILED: "The engine did not answer.",
};

function AnswerCard({ answer, timezone }: { answer: Answer; timezone: string }) {
  const note = STATUS_NOTE[answer.status];

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-gray-900">{answer.engine}</span>
        <span className="text-xs text-gray-500">
          {formatInstant(new Date(answer.createdAt), timezone)}
        </span>
      </div>

      {note ? (
        <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">{note}</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Tag
              tone={answer.brandMentioned ? "good" : "muted"}
              label={answer.brandMentioned ? "Mentioned" : "Not mentioned"}
            />
            {answer.brandPosition !== null && (
              <Tag tone="info" label={`Ranked ${positionLabel(answer.brandPosition)}`} />
            )}
            {answer.sentiment && <Tag tone="info" label={answer.sentiment} />}
          </div>

          {answer.rawResponse && (
            // Text child, escaped by React. See the file header on why this must
            // never become dangerouslySetInnerHTML or a markdown renderer.
            <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-800">
              {answer.rawResponse}
            </p>
          )}

          {answer.citations.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Cited</p>
              <ul className="mt-1 space-y-1">
                {answer.citations.map((citation) => (
                  <li key={citation.url} className="flex items-baseline gap-2 text-sm">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        citation.isMonitored
                          ? "bg-blue-100 font-medium text-blue-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {citation.domain}
                      {citation.isMonitored && " · yours"}
                    </span>
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="truncate text-gray-600 hover:text-blue-700"
                    >
                      {citation.title ?? citation.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {answer.competitors.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Others named
              </p>
              <p className="mt-1 text-sm text-gray-700">
                {answer.competitors
                  .map((c) => (c.position ? `${c.name} (${positionLabel(c.position)})` : c.name))
                  .join(", ")}
              </p>
            </div>
          )}
        </>
      )}
    </li>
  );
}

const TONES: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-800",
  info: "bg-blue-100 text-blue-800",
  muted: "bg-gray-100 text-gray-600",
};

function Tag({ tone, label }: { tone: keyof typeof TONES | string; label: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 ${TONES[tone] ?? TONES.muted}`}>{label}</span>
  );
}
