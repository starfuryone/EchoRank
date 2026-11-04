"use client";

// Settings → Integrations → Google Analytics 4 (Phase 4d, crawl.ga4): connect
// Analytics on the shared Google connection, then pick the property the Site
// Crawler joins. The list comes from the tenant's own connection; the route
// re-checks the pick against it.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { IntegrationsCopy } from "@/lib/i18n/integrations";

type Listing =
  | { connected: true; properties: { id: string; name: string; account: string }[]; selected: { id: string; name: string | null } | null }
  | { connected: false; connectHref: string };

export function Ga4Integration({ t }: { t: IntegrationsCopy }) {
  const [data, setData] = useState<Listing | null>(null);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/seo/v1/ga4/properties")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Listing | null) => {
        if (cancelled || !d) return;
        setData(d);
        if (d.connected) setPick(d.selected?.id ?? "");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setMsg(null);
    const res = pick
      ? await fetch("/api/seo/v1/ga4/property", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ propertyId: pick }) })
      : await fetch("/api/seo/v1/ga4/property", { method: "DELETE" });
    setMsg(res.ok ? { ok: true, text: t.ga4Saved } : { ok: false, text: t.ga4Error });
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-gray-900">{t.title}</h2>
      </CardHeader>
      <CardContent className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">{t.ga4Title}</h3>
        <p className="text-sm text-gray-500">{t.ga4Help}</p>
        {!data ? (
          <p className="text-sm text-gray-500">{t.ga4Loading}</p>
        ) : !data.connected ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">{t.ga4NotConnected}</p>
            <a href={data.connectHref} className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
              {t.ga4Connect}
            </a>
          </div>
        ) : data.properties.length === 0 ? (
          <p className="text-sm text-gray-600">{t.ga4Empty}</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[280px] flex-1">
              <Select
                id="ga4-property"
                label={t.ga4Property}
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                options={[{ value: "", label: t.ga4None }, ...data.properties.map((p) => ({ value: p.id, label: `${p.name} — ${p.account}` }))]}
              />
            </div>
            <Button onClick={() => void save()}>{t.ga4Save}</Button>
          </div>
        )}
        {msg && <p className={msg.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}
