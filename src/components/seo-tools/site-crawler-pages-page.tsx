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
import { CrawlerNav } from "./site-crawler-nav";
import { PagesView, extractionNamesOf } from "./site-crawler-pages";

export function CrawlPagesPage({ locale, crawlId }: { locale: DashLocale; crawlId: string }) {
  const t = SITE_CRAWLER_COPY[locale];
  const int = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : locale), [locale]);
  const rule = useSearchParams()?.get("rule") ?? "";
  const [crawl, setCrawl] = useState<CrawlDto | null>(null);
  const [segment, setSegment] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/${encodeURIComponent(crawlId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CrawlDto | null) => {
        if (!cancelled) setCrawl(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [crawlId]);

  const segmentNames = flag("crawl.segments") ? (crawl?.config?.segments ?? []).map((g) => g.name) : [];
  return (
    <div className="space-y-6">
      <CrawlerHeader t={t} locale={locale} quota={null} />
      <CrawlerNav current="results" t={t.ux} />
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
    </div>
  );
}
