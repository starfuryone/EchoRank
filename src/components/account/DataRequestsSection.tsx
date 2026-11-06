"use client";

// /settings/account → "Your data": export (GET /api/account/export) and
// deletion with a 14-day grace period (/api/account/deletion). The scope shown
// follows the role the API reports: an owner's deletion takes the workspace.

import { useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { DATA_REQUESTS_COPY } from "@/lib/i18n/data-requests";
import type { DashLocale } from "@/lib/i18n/dashboard";

type Pending = { id: string; scope: string; requestedAt: string; runAfter: string } | null;

export function DataRequestsSection({ locale }: { locale: DashLocale }) {
  const t = DATA_REQUESTS_COPY[locale];
  const [pending, setPending] = useState<Pending>(null);
  const [role, setRole] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/account/deletion")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d) return;
        setPending(d.pending);
        setRole(d.role);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const call = async (method: "POST" | "DELETE") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/deletion", {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ confirm }) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      setPending(method === "POST" ? d.pending : null);
      setConfirm("");
    } catch {
      setError(t.errGeneric);
    } finally {
      setBusy(false);
    }
  };

  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale === "de-CH" ? "de-CH" : locale, { dateStyle: "long" }).format(new Date(iso));

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-medium text-gray-100">{t.title}</h2>
        <p className="mt-1 text-xs text-gray-500">{t.lead}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6" data-testid="data-requests">
          <section>
            <h3 className="text-sm font-medium text-gray-200">{t.exportTitle}</h3>
            <p className="mt-1 text-xs text-gray-500">{t.exportBody}</p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file download from an API route, not a page */}
            <a
              href="/api/account/export"
              className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-amber-300 hover:text-amber-200"
              data-testid="export-link"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t.exportCta}
            </a>
          </section>

          <section>
            <h3 className="text-sm font-medium text-gray-200">{t.deleteTitle}</h3>
            <p className="mt-1 text-xs text-gray-500">{role === "OWNER" ? t.deleteBodyOwner : t.deleteBodyMember}</p>
            <p className="mt-1 text-xs text-gray-500">{t.deleteKept}</p>
            {pending ? (
              <div className="mt-3 flex flex-wrap items-center gap-3" data-testid="deletion-pending">
                <span className="text-sm text-amber-300">{t.pending(date(pending.runAfter))}</span>
                <Button size="sm" variant="outline" onClick={() => void call("DELETE")} disabled={busy}>
                  {t.cancelCta}
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="text-xs text-gray-400">
                  {t.deleteConfirmLabel}
                  <input
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="mt-1 block w-40 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                    autoComplete="off"
                  />
                </label>
                <Button size="sm" variant="outline" onClick={() => void call("POST")} disabled={busy || confirm !== "DELETE"}>
                  <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                  {t.deleteCta}
                </Button>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-2 text-xs text-red-400">
                {error}
              </p>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
