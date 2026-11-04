"use client";

// Settings → Integrations: the tenant's own OpenAI / Gemini keys for the
// Site Crawler's AI prompts (Phase 4e). Write-only: once saved, a key is
// shown as "Saved <date>" and never sent back to the browser.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SiteCrawler4eCopy } from "@/lib/i18n/site-crawler-4e";

type Provider = "openai" | "gemini";
type Status = Record<Provider, { set: boolean; createdAt: string | null; lastUsedAt: string | null }>;
const NAMES: Record<Provider, string> = { openai: "OpenAI", gemini: "Gemini" };

export function AiKeysIntegration({ t, locale }: { t: SiteCrawler4eCopy; locale: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [draft, setDraft] = useState<Record<Provider, string>>({ openai: "", gemini: "" });
  const [note, setNote] = useState<{ provider: Provider; text: string } | null>(null);
  const [busy, setBusy] = useState<Provider | null>(null);
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/seo/v1/ai-keys")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Status | null) => !cancelled && d && setStatus(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(p: Provider) {
    setBusy(p);
    setNote(null);
    try {
      const res = await fetch("/api/seo/v1/ai-keys", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: p, key: draft[p] }),
      });
      if (res.ok) {
        setStatus(await res.json());
        setDraft((d) => ({ ...d, [p]: "" }));
        setNote({ provider: p, text: t.keySaved });
      } else {
        const d = await res.json().catch(() => null);
        setNote({ provider: p, text: d?.code === "INVALID_KEY" ? t.keyInvalid : t.keyFailed });
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: Provider) {
    setBusy(p);
    try {
      const res = await fetch(`/api/seo/v1/ai-keys?provider=${p}`, { method: "DELETE" });
      if (res.ok) {
        setStatus((s) => (s ? { ...s, [p]: { set: false, createdAt: null, lastUsedAt: null } } : s));
        setNote({ provider: p, text: t.keyRemoved });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-gray-900">{t.keysTitle}</h2>
        <p className="text-sm text-gray-500">{t.keysHelp}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {(["openai", "gemini"] as const).map((p) => {
          const s = status?.[p];
          return (
            <div key={p} className="space-y-2">
              <p className="text-sm font-medium text-gray-900">{NAMES[p]}</p>
              <p className="text-xs text-gray-500">
                {s?.set && s.createdAt ? t.keySet(date(s.createdAt)) : t.keyNotSet}
                {s?.lastUsedAt ? ` ${t.keyLastUsed(date(s.lastUsedAt))}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  className="w-80"
                  aria-label={`${NAMES[p]} — ${t.keyPlaceholder}`}
                  placeholder={t.keyPlaceholder}
                  value={draft[p]}
                  onChange={(e) => setDraft((d) => ({ ...d, [p]: e.target.value }))}
                />
                <Button size="sm" disabled={busy !== null || !draft[p].trim()} onClick={() => void save(p)}>
                  {s?.set ? t.keyReplace : t.keySave}
                </Button>
                {s?.set && (
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void remove(p)}>
                    {t.keyRemove}
                  </Button>
                )}
              </div>
              {note?.provider === p && <p role="status" className="text-xs text-gray-600">{note.text}</p>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
