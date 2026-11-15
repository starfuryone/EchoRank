"use client";

// /settings/memory — the client half. Talks only to /api/account/memory; no
// tenant id is ever sent (the API takes it from the session).

import { useCallback, useEffect, useState } from "react";
import { Brain, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MEMORY_COPY, type MemoryCategoryKey } from "@/lib/i18n/memory";
import type { DashLocale } from "@/lib/i18n/dashboard";

interface Item {
  id: string;
  memory: string;
  created_at: string | null;
  surface: string | null;
  category: string;
}

interface State {
  included: boolean;
  enabled: boolean;
  total: number;
  items: Item[];
  nextCursor: number | null;
  allowance: { addsPerMonth: number | null; maxStored: number | null };
  addsUsed: number;
  canManage: boolean;
}

export function MemoryPageClient({ locale }: { locale: DashLocale }) {
  const t = MEMORY_COPY[locale];
  const nf = new Intl.NumberFormat(locale === "de-CH" ? "de-CH" : locale);
  const df = new Intl.DateTimeFormat(locale === "de-CH" ? "de-CH" : locale, { dateStyle: "medium" });
  const [state, setState] = useState<State | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  const load = useCallback(async (cursor = 0) => {
    const res = await fetch(`/api/account/memory?cursor=${cursor}`, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as State;
  }, []);

  useEffect(() => {
    let live = true;
    load()
      .then((s) => live && setState(s))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch {
      setError(t.errGeneric);
    } finally {
      setBusy(false);
    }
  };

  const toggle = () =>
    run(async () => {
      if (!state) return;
      const res = await fetch("/api/account/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !state.enabled }),
      });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as { enabled: boolean };
      setState({ ...state, enabled: d.enabled });
    });

  const removeOne = (id: string) =>
    run(async () => {
      const res = await fetch(`/api/account/memory/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error();
      setState((s) => (s ? { ...s, items: s.items.filter((i) => i.id !== id), total: Math.max(0, s.total - 1) } : s));
    });

  const removeAll = () =>
    run(async () => {
      const res = await fetch("/api/account/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      if (!res.ok) throw new Error();
      setConfirm("");
      setState((s) => (s ? { ...s, items: [], total: 0, nextCursor: null } : s));
      setNotice(t.deletedAll);
    });

  const more = () =>
    run(async () => {
      if (!state || state.nextCursor === null) return;
      const next = await load(state.nextCursor);
      setState({ ...state, items: [...state.items, ...next.items], nextCursor: next.nextCursor });
    });

  const category = (c: string) => t.categories[(c in t.categories ? c : "general") as MemoryCategoryKey];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-gray-700" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-gray-900">{t.title}</h1>
      </div>
      <p className="text-sm text-gray-600">{t.whatIsStored}</p>

      {failed && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{t.unavailable}</p>}
      {state && !state.included && <p className="rounded-md bg-gray-100 p-3 text-sm text-gray-700">{t.notIncluded}</p>}

      {state?.included && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{t.toggleLabel}</p>
                  <p className="text-xs text-gray-500">
                    {t.stored(nf.format(state.total), state.allowance.maxStored === null ? null : nf.format(state.allowance.maxStored))}
                    {" · "}
                    {t.addsUsed(nf.format(state.addsUsed), state.allowance.addsPerMonth === null ? null : nf.format(state.allowance.addsPerMonth))}
                  </p>
                </div>
                <Button
                  variant={state.enabled ? "primary" : "outline"}
                  onClick={toggle}
                  disabled={busy || !state.canManage}
                  aria-pressed={state.enabled}
                >
                  {state.enabled ? t.on : t.off}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!state.enabled && <p className="text-sm text-gray-600">{t.offNote}</p>}
              {!state.canManage && <p className="text-xs text-gray-500">{t.adminsOnly}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="font-medium text-gray-900">{t.listTitle}</p>
            </CardHeader>
            <CardContent>
              {state.items.length === 0 ? (
                <p className="text-sm text-gray-500">{t.empty}</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {state.items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900">{item.memory}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <Badge variant="info">{category(item.category)}</Badge>
                          {item.surface && <span>{t.from[item.surface] ?? item.surface}</span>}
                          {item.created_at && <span>{df.format(new Date(item.created_at))}</span>}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOne(item.id)}
                        disabled={busy}
                        aria-label={t.deleteItem}
                        title={t.deleteItem}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {state.nextCursor !== null && (
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={more} disabled={busy}>
                    {t.showMore}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {state.canManage && (
            <Card>
              <CardHeader>
                <p className="font-medium text-gray-900">{t.deleteAllTitle}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">{t.deleteAllBody}</p>
                <label className="block text-xs text-gray-600" htmlFor="memory-confirm">
                  {t.confirmLabel}
                </label>
                <input
                  id="memory-confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="off"
                  className="w-48 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
                <div>
                  <Button variant="danger" onClick={removeAll} disabled={busy || confirm !== "DELETE" || state.total === 0}>
                    {t.deleteAllCta}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}
    </div>
  );
}
