"use client";

// /crawler/schedules: hero, then two columns — "Create a crawl schedule"
// (left) and "Saved schedules" (right). A schedule runs with the site's saved
// defaults (the settings "Save as default" stores on New crawl), read here the
// same way the Start view pre-fills its form; the form says which it will use.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { flag } from "@/lib/flags";
import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import type { CrawlConfigInput } from "@/lib/site-crawler/crawl-config";
import type { CrawlListResponse, CrawlQuotaDto, RenderMode } from "@/lib/site-crawler/types";
import { CrawlerHeader } from "./site-crawler-client";
import { fromView, toInput, type SiteInfo } from "./site-crawler-config";
import { CRAWLER_ROUTES, CrawlerNav } from "./site-crawler-nav";
import { SavedSchedules, ScheduleForm, type ScheduleDto, type SchedulesResponse } from "./site-crawler-schedules";

const hostOf = (raw: string): string | null => {
  const v = raw.trim();
  if (!v) return null;
  try {
    return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
};

const CARD = "min-w-0 rounded-xl border border-gray-200 bg-white p-5";

export function CrawlSchedulesView({ locale }: { locale: DashLocale }) {
  const t = SITE_CRAWLER_COPY[locale];
  const u = t.ux;
  const [quota, setQuota] = useState<CrawlQuotaDto | null>(null);
  const [data, setData] = useState<SchedulesResponse | null>(null);
  const [url, setUrl] = useState("");
  const [renderMode, setRenderMode] = useState<RenderMode>("none");
  const [site, setSite] = useState<{ host: string; config: CrawlConfigInput | null } | null>(null);
  const [editing, setEditing] = useState<ScheduleDto | null>(null);
  const host = useMemo(() => hostOf(url), [url]);
  const on = flag("crawl.schedule");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/seo/v1/crawl")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CrawlListResponse | null) => {
        if (!cancelled && d) setQuota(d.quota);
      })
      .catch(() => undefined);
    if (on)
      void fetch("/api/seo/v1/crawl/schedules")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: SchedulesResponse | null) => {
          // Missing fields (an older response) read as none, never a crash.
          if (!cancelled) setData({ ...d, schedules: d?.schedules ?? [], cap: d?.cap ?? 0, cadences: d?.cadences ?? [] });
        })
        .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [on]);

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
  const renders = Boolean(quota && quota.renderCap > 0);
  const configLine = known ? (
    known.config ? (
      <p className="mt-1 text-xs text-gray-600" data-testid="schedule-config">
        {u.schUsesSaved} ·{" "}
        <Link
          href={CRAWLER_ROUTES.start}
          className="font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {u.schEditConfig}
        </Link>
      </p>
    ) : (
      <p className="mt-1 text-xs text-gray-600" data-testid="schedule-config">
        {u.schNoDefaults(known.host)}
      </p>
    )
  ) : null;

  return (
    <div className="space-y-6">
      <CrawlerHeader t={t} locale={locale} quota={quota} />
      <CrawlerNav current="schedules" t={u} />

      <header data-testid="schedules-hero">
        <p className="font-mono text-[11px] uppercase tracking-widest text-gray-600">{u.schEyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">{u.schH1}</h1>
        <p className="mt-1 text-sm text-gray-600">{u.schSubhead}</p>
      </header>

      {on && data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className={CARD}>
            <ScheduleForm
              key={editing?.id ?? "new"}
              t={t.p4c}
              ux={u}
              locale={locale}
              url={url}
              onUrl={setUrl}
              urlLabel={u.schSiteUrl}
              urlPlaceholder={t.urlPlaceholder}
              renderMode={renders ? renderMode : "none"}
              renderSelect={
                renders ? (
                  <div>
                    <label htmlFor="schedule-render" className="mb-1 block text-sm font-medium text-gray-700">
                      {t.renderLabel}
                    </label>
                    <select
                      id="schedule-render"
                      value={renderMode}
                      onChange={(e) => setRenderMode(e.target.value as RenderMode)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <option value="none">{t.renderNone}</option>
                      <option value="thin">{t.renderThin}</option>
                      <option value="all">{t.renderAll}</option>
                    </select>
                  </div>
                ) : undefined
              }
              config={known?.config ?? null}
              configLine={configLine}
              data={data}
              editing={editing}
              onCancelEdit={() => setEditing(null)}
              onSaved={(s, created) => {
                setData(
                  (d) =>
                    d && {
                      ...d,
                      schedules: created
                        ? [...d.schedules, s]
                        : d.schedules.map((x) => (x.id === s.id ? { ...x, ...s, lastHealth: x.lastHealth, prevHealth: x.prevHealth } : x)),
                    },
                );
                if (!created) setEditing(null);
              }}
              // Wait for the host's defaults before saving, so the schedule gets them.
              waiting={Boolean(host) && !known}
            />
          </div>
          <div className={CARD}>
            <SavedSchedules
              t={t.p4c}
              ux={u}
              locale={locale}
              data={data}
              editingId={editing?.id ?? null}
              onChange={(s) => setData((d) => d && { ...d, schedules: d.schedules.map((x) => (x.id === s.id ? s : x)) })}
              onRemove={(id) => {
                setData((d) => d && { ...d, schedules: d.schedules.filter((x) => x.id !== id) });
                if (editing?.id === id) setEditing(null);
              }}
              onEdit={(s) => setEditing(s)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
