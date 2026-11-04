"use client";

// /crawler/schedules (UX restructure): the scheduled crawls list and editor,
// moved out of the Start view's Configuration. A schedule runs with the
// site's saved defaults (the settings "Save as default" stores on New crawl),
// read here the same way the Start view pre-fills its form.

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { flag } from "@/lib/flags";
import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import type { CrawlConfigInput } from "@/lib/site-crawler/crawl-config";
import type { CrawlListResponse, CrawlQuotaDto, RenderMode } from "@/lib/site-crawler/types";
import { CrawlerHeader } from "./site-crawler-client";
import { fromView, toInput, type SiteInfo } from "./site-crawler-config";
import { CrawlerNav } from "./site-crawler-nav";
import { CrawlSchedules } from "./site-crawler-schedules";

const hostOf = (raw: string): string | null => {
  const v = raw.trim();
  if (!v) return null;
  try {
    return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
};

export function CrawlSchedulesView({ locale }: { locale: DashLocale }) {
  const t = SITE_CRAWLER_COPY[locale];
  const u = t.ux;
  const [quota, setQuota] = useState<CrawlQuotaDto | null>(null);
  const [url, setUrl] = useState("");
  const [renderMode, setRenderMode] = useState<RenderMode>("none");
  const [site, setSite] = useState<{ host: string; config: CrawlConfigInput | null } | null>(null);
  const host = useMemo(() => hostOf(url), [url]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/seo/v1/crawl")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CrawlListResponse | null) => {
        if (!cancelled && d) setQuota(d.quota);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // The host's saved defaults: what the schedule will run with.
  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetch(`/api/seo/v1/crawl/sites?host=${encodeURIComponent(host)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: SiteInfo | null) => {
          if (!cancelled) setSite({ host, config: d?.defaults ? toInput(fromView(d.defaults)) : null });
        })
        .catch(() => undefined);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [host]);

  const known = site && site.host === host ? site : null;

  return (
    <div className="space-y-6">
      <CrawlerHeader t={t} locale={locale} quota={quota} />
      <CrawlerNav current="schedules" t={u} />
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">{u.schedulesTitle}</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {!flag("crawl.schedule") ? null : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1 sm:min-w-[260px]">
                  <label htmlFor="schedule-url" className="mb-1 block text-sm font-medium text-gray-700">
                    {t.urlLabel}
                  </label>
                  <Input id="schedule-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t.urlPlaceholder} />
                </div>
                {quota && quota.renderCap > 0 && (
                  <div className="w-full sm:w-auto">
                    <Select
                      id="schedule-render"
                      label={t.renderLabel}
                      value={renderMode}
                      onChange={(e) => setRenderMode(e.target.value as RenderMode)}
                      options={[
                        { value: "none", label: t.renderNone },
                        { value: "thin", label: t.renderThin },
                        { value: "all", label: t.renderAll },
                      ]}
                    />
                  </div>
                )}
              </div>
              {known && (
                <p className="text-xs text-gray-600" data-testid="schedule-config">
                  {known.config ? u.schUsesDefaults(known.host) : u.schNoDefaults(known.host)}
                </p>
              )}
              {quota && (
                <CrawlSchedules
                  ux={u}
                  t={t.p4c}
                  locale={locale}
                  rootUrl={url}
                  renderMode={quota.renderCap > 0 ? renderMode : "none"}
                  config={known?.config ?? null}
                  cap={quota.scheduleCap ?? 0}
                  cadences={quota.scheduleCadences ?? []}
                  // Wait for the host's defaults before saving, so the schedule gets them.
                  disabled={Boolean(host) && !known}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
