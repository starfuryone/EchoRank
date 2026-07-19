"use client";

import { useCallback, useEffect, useState } from "react";
import { Puzzle, Plus, Copy, RotateCw, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ExtensionHelpButton } from "@/components/help/ExtensionHelpButton";
import { EXTENSION_COPY, type DashLocale, type ExtensionCopy } from "@/lib/i18n/dashboard";

interface TokenRow {
  id: string;
  label: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function statusBadge(
  t: TokenRow,
  copy: ExtensionCopy
): { variant: "success" | "danger" | "warning"; text: string } {
  if (t.revokedAt) return { variant: "danger", text: copy.statusRevoked };
  if (t.expiresAt && new Date(t.expiresAt).getTime() < Date.now())
    return { variant: "danger", text: copy.statusExpired };
  return { variant: "success", text: copy.statusActive };
}

export function ExtensionPageClient({ locale }: { locale: DashLocale }) {
  const t = EXTENSION_COPY[locale];
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/extension/token");
      const body = await res.json();
      setTokens(body.data ?? []);
    } catch {
      setError(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function issue() {
    if (!label.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/extension/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t.createFailed);
      setPlaintext(body.data.token);
      setLabel("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.createFailed);
    } finally {
      setCreating(false);
    }
  }

  async function mutate(tokenId: string, action: "rotate" | "revoke") {
    if (action === "revoke" && !confirm(t.revokeConfirm)) return;
    setError(null);
    try {
      const res = await fetch("/api/extension/token", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t.actionFailed);
      if (action === "rotate") setPlaintext(body.data.token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.actionFailed);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Puzzle className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold">{t.title}</h1>
            <p className="text-sm text-gray-500">{t.subtitle}</p>
          </div>
        </div>
        <ExtensionHelpButton locale={locale} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {plaintext && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent>
            <div className="flex items-start gap-3 py-2">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <p className="font-medium text-blue-900">{t.copyOnce}</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-white px-3 py-2 text-xs">{plaintext}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(plaintext)}
                  >
                    <Copy className="h-4 w-4" /> {t.copy}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-blue-800">{t.pasteHint}</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPlaintext(null)}>
                  {t.done}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-medium">{t.createTitle}</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-gray-600">{t.labelLabel}</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t.labelPlaceholder}
                maxLength={120}
              />
            </div>
            <Button onClick={issue} loading={creating} disabled={!label.trim()}>
              <Plus className="h-4 w-4" /> {t.createButton}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium">{t.yourTokens}</h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-center text-sm text-gray-400">{t.loading}</p>
          ) : tokens.length === 0 ? (
            <EmptyState
              icon={<Puzzle className="h-8 w-8" />}
              title={t.emptyTitle}
              description={t.emptyDescription}
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {tokens.map((row) => {
                const badge = statusBadge(row, t);
                const disabled = !!row.revokedAt;
                return (
                  <li key={row.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{row.label}</span>
                        <Badge variant={badge.variant}>{badge.text}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        er_ext_{row.prefix}… ·{" "}
                        {t.created(new Date(row.createdAt).toLocaleDateString(locale))}
                        {row.lastUsedAt
                          ? ` · ${t.lastUsed(new Date(row.lastUsedAt).toLocaleDateString(locale))}`
                          : ` · ${t.neverUsed}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() => mutate(row.id, "rotate")}
                      >
                        <RotateCw className="h-4 w-4" /> {t.rotate}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={disabled}
                        onClick={() => mutate(row.id, "revoke")}
                      >
                        <Trash2 className="h-4 w-4" /> {t.revoke}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400">{t.finePrint}</p>
    </div>
  );
}
