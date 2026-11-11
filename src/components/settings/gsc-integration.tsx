"use client";

// Settings → Integrations → Google Search Console, for a plan without the GSC
// tool page (the crawler-only plan, 2026-11-10): connect Search Console, pick
// the property the Site Crawler joins, disconnect. The same routes and the
// same connection as the GSC tool (/api/ai/visibility/gsc/*, area
// "google_connections" in src/lib/plan-access.ts); the connect starts with
// ?from=settings so Google returns here. The routes re-check the pick
// against the tenant's own live site list.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { IntegrationsCopy } from "@/lib/i18n/integrations";

type Status =
  | { connected: false }
  | { connected: true; status: string; siteUrl: string | null; sites?: { siteUrl: string }[] };

export const GSC_SETTINGS_CONNECT = "/api/ai/visibility/gsc/connect?from=settings";

export function GscIntegration({ t }: { t: IntegrationsCopy }) {
  const [data, setData] = useState<Status | null>(null);
  const [pick, setPick] = useState("");
  const [error, setError] = useState(false);

  async function load() {
    const r = await fetch("/api/ai/visibility/gsc/status");
    const d = (r.ok ? await r.json() : null) as Status | null;
    if (d) setData(d);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/ai/visibility/gsc/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Status | null) => {
        if (!cancelled && d) setData(d);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function select() {
    setError(false);
    const res = await fetch("/api/ai/visibility/gsc/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ siteUrl: pick }) });
    if (!res.ok) return setError(true);
    await load();
  }

  async function disconnect() {
    setError(false);
    const res = await fetch("/api/ai/visibility/gsc/disconnect", { method: "POST" });
    if (!res.ok) return setError(true);
    setData({ connected: false });
  }

  const connectLink = (
    <a href={GSC_SETTINGS_CONNECT} className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
      {t.gscConnect}
    </a>
  );

  return (
    <Card data-testid="settings-gsc">
      <CardHeader>
        <h2 className="text-base font-semibold text-gray-900">{t.title}</h2>
      </CardHeader>
      <CardContent className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">{t.gscTitle}</h3>
        <p className="text-sm text-gray-500">{t.gscHelp}</p>
        {!data ? (
          <p className="text-sm text-gray-500">{t.ga4Loading}</p>
        ) : !data.connected ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">{t.gscNotConnected}</p>
            {connectLink}
          </div>
        ) : data.status === "NEEDS_REAUTH" ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">{t.gscReauth}</p>
            {connectLink}
          </div>
        ) : data.siteUrl ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-700">{t.gscConnected(data.siteUrl)}</p>
            <Button variant="outline" onClick={() => void disconnect()}>
              {t.gscDisconnect}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[280px] flex-1">
              <Select
                id="gsc-property"
                label={t.ga4Property}
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                options={[{ value: "", label: "—" }, ...(data.sites ?? []).map((s) => ({ value: s.siteUrl, label: s.siteUrl }))]}
              />
            </div>
            <Button onClick={() => void select()} disabled={!pick}>
              {t.ga4Save}
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{t.gscError}</p>}
      </CardContent>
    </Card>
  );
}
