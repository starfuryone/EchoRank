"use client";

// "Export to Sheets" on a completed crawl (Phase 4c, crawl.sheets): the four
// tabs to a spreadsheet the tenant names or a new one. Not connected yet →
// a "Connect Google Sheets" link into the OAuth flow. The last spreadsheet
// used is remembered per browser (a convenience, not state).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SiteCrawler4cCopy } from "@/lib/i18n/site-crawler-4c";

const KEY = "crawler.sheets.last";
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export function SheetsExport({ crawlId, t, int, guideHref }: { crawlId: string; t: SiteCrawler4cCopy; int: Intl.NumberFormat; guideHref: string }) {
  const [target, setTarget] = useState(read);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ kind: "done"; url: string; pages: number } | { kind: "connect"; href: string } | { kind: "error"; text: string } | null>(null);
  const connected = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sheets") === "connected";

  async function run() {
    setBusy(true);
    setState(null);
    try {
      const res = await fetch(`/api/seo/v1/crawl/${crawlId}/sheets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(target.trim() ? { spreadsheet: target.trim() } : {}),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 409 && body?.connectHref) return setState({ kind: "connect", href: body.connectHref });
      if (!res.ok) return setState({ kind: "error", text: body?.code === "INVALID_REQUEST" ? t.shErrTarget : t.shErr });
      try {
        localStorage.setItem(KEY, body.url);
      } catch {
        /* private mode: nothing to remember */
      }
      setTarget(body.url);
      setState({ kind: "done", url: body.url, pages: body.pages });
    } catch {
      setState({ kind: "error", text: t.shErr });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-100 p-3">
      <p className="text-sm font-medium text-gray-900">{t.shTitle}</p>
      {connected && <p className="text-xs text-green-700">{t.shConnected}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label={t.shTarget} placeholder={t.shTarget} className="w-96 text-xs" value={target} onChange={(e) => setTarget(e.target.value)} />
        <Button variant="outline" size="sm" onClick={() => void run()} disabled={busy}>
          {busy ? t.shExporting : t.shExport}
        </Button>
      </div>
      {state?.kind === "done" && (
        <p className="text-xs text-gray-700">
          {t.shDone(int.format(state.pages))}{" "}
          <a className="text-blue-700 hover:underline" href={state.url} target="_blank" rel="noopener noreferrer">
            {t.shOpen}
          </a>
        </p>
      )}
      {state?.kind === "connect" && (
        <p className="text-xs text-gray-700">
          {t.shNeedConnect}{" "}
          <a className="font-medium text-blue-700 hover:underline" href={state.href}>
            {t.shConnect}
          </a>
        </p>
      )}
      {state?.kind === "error" && <p className="text-xs text-red-600">{state.text}</p>}
      <a className="text-xs text-blue-700 hover:underline" href={guideHref} target="_blank" rel="noopener noreferrer">
        {t.shGuide}
      </a>
    </div>
  );
}
