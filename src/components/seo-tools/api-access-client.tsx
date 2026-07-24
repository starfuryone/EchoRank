"use client";

// API access — tenant API keys for /api/public/v1/*. Mirrors the extension
// tokens page UX: key shown exactly once at creation, list with prefix only,
// instant revoke. The docs section lists the COMPLETE v1 surface — three GET
// endpoints — nothing aspirational.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, KeyRound, Plus, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import {
  API_ACCESS_COPY,
  SEO_TOOLS_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";

interface KeyRow {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

const ENDPOINTS: { path: string; descKey: "suggest" | "audit" | "summary" }[] = [
  { path: "GET /api/public/v1/keywords/suggest?url=example.com&depth=single", descKey: "suggest" },
  { path: "GET /api/public/v1/audit/latest", descKey: "audit" },
  { path: "GET /api/public/v1/visibility/summary", descKey: "summary" },
];

export function ApiAccessClient({ locale }: { locale: DashLocale }) {
  const t = API_ACCESS_COPY[locale];
  const it = SEO_TOOLS_COPY[locale].items.api_access;
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/ai/visibility/api-keys")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { keys: KeyRow[] }) => setKeys(d.keys))
      .catch(() => setError(t.loadFailed));
  }, [t]);

  useEffect(load, [load]);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/visibility/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const issued = (await res.json()) as { key: string };
      setFreshKey(issued.key);
      setLabel("");
      load();
    } catch {
      setError(t.actionFailed);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm(t.revokeConfirm)) return;
    try {
      const res = await fetch("/api/ai/visibility/api-keys/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      load();
    } catch {
      setError(t.actionFailed);
    }
  }

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {it.name}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{t.intro}</p>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {/* Fresh key — shown exactly once */}
      {freshKey && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">{t.keyOnce}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-3 py-2 font-mono text-xs text-gray-800">
              {freshKey}
            </code>
            <Button variant="outline" size="sm" onClick={() => copyText("fresh", freshKey)}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {copied === "fresh" ? t.copied : t.copy}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setFreshKey(null)}>
              {t.done}
            </Button>
          </div>
        </div>
      )}

      {/* Create */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.createTitle}</h3>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.labelPlaceholder}
            aria-label={t.labelLabel}
            className="sm:max-w-xs"
          />
          <Button onClick={create} disabled={creating}>
            <Plus className="mr-1.5 h-4 w-4" />
            {creating ? t.creating : t.createButton}
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.yourKeys}</h3>
        </CardHeader>
        <CardContent className="p-0">
          {!keys && !error && <p className="px-6 pb-5 text-sm text-gray-400">{t.loading}</p>}
          {keys && keys.length === 0 && (
            <p className="px-6 pb-5 text-sm text-gray-500">{t.emptyKeys}</p>
          )}
          {keys && keys.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <KeyRound className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                      {k.label}
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
                        er_api_{k.prefix}…
                      </code>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {t.createdLabel} {formatDate(k.createdAt, locale)} · {t.lastUsedLabel}{" "}
                      {k.lastUsedAt ? formatDate(k.lastUsedAt, locale) : t.neverUsed}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={k.revokedAt ? "default" : "success"}>
                      {k.revokedAt ? t.statusRevoked : t.statusActive}
                    </Badge>
                    {!k.revokedAt && (
                      <Button variant="outline" size="sm" onClick={() => revoke(k.id)}>
                        {t.revoke}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Docs — the complete v1 surface, nothing more */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.docsTitle}</h3>
          <p className="mt-1 text-sm text-gray-500">{t.docsIntro}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {ENDPOINTS.map((e) => (
            <div key={e.path} className="overflow-hidden rounded-lg border border-gray-200">
              <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-2">
                <code className="break-all font-mono text-xs text-gray-800">{e.path}</code>
                <Button variant="outline" size="sm" onClick={() => copyText(e.path, e.path)}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {copied === e.path ? t.copied : t.copy}
                </Button>
              </div>
              <p className="px-4 py-2.5 text-xs text-gray-500">{t.docsEndpoints[e.descKey]}</p>
            </div>
          ))}
          <p className="text-xs text-gray-400">
            {t.mcpHint}{" "}
            <Link href="/visibility/tools/mcp-server" className="font-medium text-blue-600 hover:text-blue-700">
              MCP →
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
