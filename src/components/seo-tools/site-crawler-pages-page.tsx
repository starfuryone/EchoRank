"use client";

// /crawler/[id]/pages: the Pages view on its own page, with the crawler's
// header and nav strip. ?rule=<id> (Issues › See all pages) opens it filtered
// to that rule's pages. The crawl is read through the tenant-scoped API.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { flag } from "@/lib/flags";
import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { EMPTY_PAGE_FILTERS, type CrawlDto } from "@/lib/site-crawler/types";
import { CrawlerHeader } from "./site-crawler-client";
import { CrawlerNav, hostOfCrawl } from "./site-crawler-nav";
import { ArchivedPanel } from "./site-crawler-archived";
import { crawlDataState } from "@/lib/site-crawler/data-state";
import { PagesView, extractionNamesOf } from "./site-crawler-pages";

export function CrawlPagesPage({ locale, crawlId }: { locale: DashLocale; crawlId: string }) {
  const t = SITE_CRAWLER_COPY[locale];
  const int = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : locale), [locale]);
  const rule = useSearchParams()?.get("rule") ?? "";
  const [crawl, setCrawl] = useState<CrawlDto | null>(null);
  // The crawl first, so an archived one never asks for its pages.
  const [loaded, setLoaded] = useState(false);
  const [segment, setSegment] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/${encodeURIComponent(crawlId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CrawlDto | null) => {
        if (cancelled) return;
        setCrawl(d);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [crawlId]);

  const segmentNames = flag("crawl.segments") ? (crawl?.config?.segments ?? []).map((g) => g.name) : [];
  return (
    <div className="space-y-6">
      <CrawlerHeader t={t} locale={locale} quota={null} howto="pages" />
      <CrawlerNav current="results" t={t.ux} />
      {crawl && crawlDataState(crawl) === "archived" ? (
        <ArchivedPanel
          crawlId={crawl.id}
          storageState={crawl.storageState ?? "ARCHIVED"}
          host={hostOfCrawl(crawl.rootUrl)}
          a={t.archive}
          onRestored={() => setCrawl((c) => c && { ...c, storageState: "HOT" })}
        />
      ) : loaded && (
      <PagesView
        crawlId={crawlId}
        crawl={crawl}
        locale={locale}
        segmentNames={segmentNames}
        segment={segment}
        onSegment={setSegment}
        initialFilters={rule ? { ...EMPTY_PAGE_FILTERS, rule } : EMPTY_PAGE_FILTERS}
        searchNames={flag("crawl.extraction") ? (crawl?.config?.searches ?? []).map((s) => s.name) : []}
        extractionNames={extractionNamesOf(crawl?.config, t)}
        linksOn={flag("crawl.links") && Boolean(crawl) && !crawl?.dataPurgedAt}
        standalone
        t={t}
        int={int}
      />
      )}
    </div>
  );
}
