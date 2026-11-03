"use client";

// Accepted words for the spell check (Phase 3c): brand, product and people's
// names the crawler should never report. A collapsed panel under the start
// form; the list is fetched when it is first opened.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import { MAX_ACCEPTED_WORDS, parseAcceptedWords } from "@/lib/site-crawler/accepted-words";

const ENDPOINT = "/api/seo/v1/crawl/accepted-words";

export function AcceptedWords({ t }: { t: SiteCrawlerCopy }) {
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function load() {
    if (loaded) return;
    setLoaded(true);
    const res = await fetch(ENDPOINT).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (data && Array.isArray(data.words)) setText(data.words.join("\n"));
  }

  async function save() {
    setState("saving");
    const res = await fetch(ENDPOINT, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ words: parseAcceptedWords(text) }),
    }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (!data) {
      setState("error");
      return;
    }
    setText((data.words as string[]).join("\n"));
    setState("saved");
  }

  return (
    <details
      className="mt-4 rounded-lg border border-gray-200 p-3"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) void load();
      }}
    >
      <summary className="cursor-pointer text-sm font-medium text-gray-700">{t.acceptedTitle}</summary>
      <p className="mt-2 text-xs text-gray-500">{t.acceptedHelp(MAX_ACCEPTED_WORDS)}</p>
      <label htmlFor="crawl-accepted-words" className="sr-only">
        {t.acceptedTitle}
      </label>
      <textarea
        id="crawl-accepted-words"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setState("idle");
        }}
        rows={5}
        className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button type="button" size="sm" variant="outline" onClick={save} disabled={state === "saving" || !loaded}>
          {state === "saving" ? t.acceptedSaving : t.acceptedSave}
        </Button>
        {state === "saved" && <span className="text-xs text-gray-500">{t.acceptedSaved}</span>}
        {state === "error" && <span className="text-xs text-red-600">{t.errGeneric}</span>}
      </div>
    </details>
  );
}
