"use client";

import { useCallback, useEffect, useState } from "react";
import { Puzzle, Plus, Copy, RotateCw, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ExtensionHelpButton } from "@/components/help/ExtensionHelpButton";

interface TokenRow {
  id: string;
  label: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function statusBadge(t: TokenRow): { variant: "success" | "danger" | "warning"; text: string } {
  if (t.revokedAt) return { variant: "danger", text: "Revoked" };
  if (t.expiresAt && new Date(t.expiresAt).getTime() < Date.now())
    return { variant: "danger", text: "Expired" };
  return { variant: "success", text: "Active" };
}

export default function ExtensionPage() {
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
      setError("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, []);

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
      if (!res.ok) throw new Error(body.error ?? "Failed to create token");
      setPlaintext(body.data.token);
      setLabel("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create token");
    } finally {
      setCreating(false);
    }
  }

  async function mutate(tokenId: string, action: "rotate" | "revoke") {
    if (action === "revoke" && !confirm("Revoke this token? The extension using it will stop working immediately.")) return;
    setError(null);
    try {
      const res = await fetch("/api/extension/token", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Action failed");
      if (action === "rotate") setPlaintext(body.data.token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Puzzle className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold">Browser Extension</h1>
            <p className="text-sm text-gray-500">
              Import reviews from Google, Facebook, and Trustpilot pages directly into EchoRank.
            </p>
          </div>
        </div>
        <ExtensionHelpButton />
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
                <p className="font-medium text-blue-900">Copy your token now — it is shown only once.</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-white px-3 py-2 text-xs">{plaintext}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(plaintext)}
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                </div>
                <p className="mt-2 text-xs text-blue-800">
                  Paste it into the extension popup → Settings. Then visit a review page and click Scan.
                </p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPlaintext(null)}>
                  Done
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-medium">Create an extension token</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-gray-600">Label</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Chrome on work laptop"
                maxLength={120}
              />
            </div>
            <Button onClick={issue} loading={creating} disabled={!label.trim()}>
              <Plus className="h-4 w-4" /> Create token
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Your tokens</h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
          ) : tokens.length === 0 ? (
            <EmptyState
              icon={<Puzzle className="h-8 w-8" />}
              title="No tokens yet"
              description="Create a token above, then paste it into the extension to start importing reviews."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {tokens.map((t) => {
                const badge = statusBadge(t);
                const disabled = !!t.revokedAt;
                return (
                  <li key={t.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.label}</span>
                        <Badge variant={badge.variant}>{badge.text}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        er_ext_{t.prefix}… · created {new Date(t.createdAt).toLocaleDateString()}
                        {t.lastUsedAt
                          ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                          : " · never used"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() => mutate(t.id, "rotate")}
                      >
                        <RotateCw className="h-4 w-4" /> Rotate
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={disabled}
                        onClick={() => mutate(t.id, "revoke")}
                      >
                        <Trash2 className="h-4 w-4" /> Revoke
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400">
        Imported reviews appear under Monitoring and Data Sources, and are automatically analyzed
        for sentiment, themes, and reputation risk.
      </p>
    </div>
  );
}
