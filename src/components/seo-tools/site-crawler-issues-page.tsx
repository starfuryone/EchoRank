"use client";

// /crawler/[id]/issues: the Issues view on its own page, with the crawler's
// header and nav strip. The crawl is read through the tenant-scoped API;
// another workspace's id answers "not found" and the view stays empty.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { flag } from "@/lib/flags";
import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import type { CrawlDto } from "@/lib/site-crawler/types";
import { CrawlerHeader } from "./site-crawler-client";
import { IssuesView } from "./site-crawler-issues";
import { CrawlerNav } from "./site-crawler-nav";

export function CrawlIssuesPage({ locale, crawlId }: { locale: DashLocale; crawlId: string }) {
  const t = SITE_CRAWLER_COPY[locale];
  const int = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : locale), [locale]);
  const initialRule = useSearchParams()?.get("rule") ?? null;
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
      <CrawlerHeader t={t} locale={locale} quota={null} howto="issues" />
      <CrawlerNav current="results" t={t.ux} />
      <IssuesView
        crawlId={crawlId}
        crawl={crawl}
        locale={locale}
        segmentNames={segmentNames}
        segment={segment}
        onSegment={setSegment}
        initialRule={initialRule}
        standalone
        t={t}
        int={int}
      />
    </div>
  );
}
