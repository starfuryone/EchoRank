"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Lock, MessageSquareText, Play, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Answer tracking panel — the Agency headline. "When customers ask AI for a
 * recommendation, are you the answer?" Locked below AGENCY.
 */

interface PromptRow {
  id: string;
  text: string;
  active: boolean;
  lastRunAt: string | null;
  latest: {
    brandMentioned: boolean;
    brandRank: number | null;
    excerpt: string | null;
    createdAt: string;
  } | null;
}

export function AnswerTrackingCard() {
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [limit, setLimit] = useState(25);
  const [used, setUsed] = useState(0);
  const [mentionRate, setMentionRate] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/visibility/prompts", { cache: "no-store" });
      if (res.status === 403) {
        setLocked(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setPrompts(data.prompts ?? []);
      setLimit(data.limit ?? 25);
      setUsed(data.used ?? 0);
      setMentionRate(data.mentionRate ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load prompts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPrompt() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/ai/visibility/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || `Request failed (${res.status})`);
        return;
      }
      setInput("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add prompt");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch("/api/ai/visibility/prompts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function runNow() {
    setRunning(true);
    setNotice(null);
    setErr(null);
    try {
      const res = await fetch("/api/ai/visibility/prompts/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || `Request failed (${res.status})`);
        return;
      }
      setNotice(`Running ${data.queued} prompt${data.queued === 1 ? "" : "s"} — results land here in about a minute.`);
    } finally {
      setRunning(false);
    }
  }

  if (loading) return null;

  if (locked) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-5">
          <Lock className="h-5 w-5 shrink-0 text-gray-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Answer tracking</p>
            <p className="text-sm text-gray-500">
              When customers ask ChatGPT or Claude for a recommendation, are you the answer?
              Track the exact questions daily and know the moment you appear — or a competitor
              does. The headline of the Agency plan.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => (window.location.href = "/billing")}>
            Upgrade
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Answer tracking</h3>
            {mentionRate !== null && (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                mentioned in {mentionRate}% of answers (14d)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {used} / {limit} prompts
            </span>
            {prompts.some((p) => p.active) && (
              <Button variant="outline" size="sm" onClick={() => void runNow()} disabled={running}>
                <Play className="h-4 w-4" /> {running ? "Queuing…" : "Run now"}
              </Button>
            )}
          </div>
        </div>

        {prompts.length === 0 && (
          <p className="text-sm text-gray-500">
            Add the questions your customers actually ask an AI — &ldquo;best [what you do] in
            [your city]&rdquo; — and EchoRank runs them every day, flagging whether you were the
            answer.
          </p>
        )}

        {prompts.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{p.text}</p>
              {p.latest?.excerpt && (
                <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{p.latest.excerpt}</p>
              )}
            </div>
            {p.latest ? (
              p.latest.brandMentioned ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  Mentioned{p.latest.brandRank ? ` · #${p.latest.brandRank}` : ""}
                </span>
              ) : (
                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                  Not mentioned
                </span>
              )
            ) : (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                first run pending
              </span>
            )}
            <button
              type="button"
              aria-label="Delete prompt"
              onClick={() => void remove(p.id)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {used < limit && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={input}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") void addPrompt();
              }}
              placeholder="best plumber in Mérida"
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={() => void addPrompt()} disabled={busy}>
              {busy ? "Adding…" : "Track prompt"}
            </Button>
          </div>
        )}

        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </CardContent>
    </Card>
  );
}
