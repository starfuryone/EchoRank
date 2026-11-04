"use client";

// The crawler's secondary navigation and the Start view's recent crawls (UX
// restructure). The sidebar keeps one entry (the crawler → /crawler); this strip
// moves between the task views: New crawl, History, Schedules (and Results
// when a crawl is open).

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { flag } from "@/lib/flags";
import type { DashLocale, SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import type { SiteCrawlerUxCopy } from "@/lib/i18n/site-crawler-ux";
import type { CrawlDto } from "@/lib/site-crawler/types";

export type CrawlerNavItem = "start" | "results" | "history" | "schedules";

export const CRAWLER_ROUTES = {
  start: "/crawler",
  history: "/crawler/history",
  schedules: "/crawler/schedules",
  results: (id: string) => `/crawler/${encodeURIComponent(id)}`,
} as const;

export function CrawlerNav({ current, t }: { current: CrawlerNavItem; t: SiteCrawlerUxCopy }) {
  const items: { id: CrawlerNavItem; href: string; label: string }[] = [
    { id: "start", href: CRAWLER_ROUTES.start, label: t.navStart },
    { id: "history", href: CRAWLER_ROUTES.history, label: t.navHistory },
    ...(flag("crawl.schedule") ? [{ id: "schedules" as const, href: CRAWLER_ROUTES.schedules, label: t.navSchedules }] : []),
  ];
  return (
    <nav aria-label={t.navLabel} className="-mt-2">
      <ul className="flex flex-wrap gap-1 border-b border-gray-200">
        {current === "results" && (
          <li>
            <span aria-current="page" className="-mb-px inline-block border-b-2 border-blue-600 px-3 py-2 text-sm font-medium text-blue-700">
              {t.navResults}
            </span>
          </li>
        )}
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={it.href}
              aria-current={current === it.id ? "page" : undefined}
              className={
                current === it.id
                  ? "-mb-px inline-block border-b-2 border-blue-600 px-3 py-2 text-sm font-medium text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  : "-mb-px inline-block border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              }
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function statusLabel(status: string, t: SiteCrawlerCopy): string {
  switch (status) {
    case "QUEUED":
      return t.statusQueued;
    case "RUNNING":
      return t.statusRunning;
    case "COMPLETED":
      return t.statusCompleted;
    case "FAILED":
      return t.statusFailed;
    default:
      return t.statusCancelled;
  }
}

export const hostOfCrawl = (rootUrl: string) => {
  try {
    return new URL(rootUrl).host;
  } catch {
    return rootUrl;
  }
};

/** The Start view's last five crawls, each a link to its results. */
export function RecentCrawls({ crawls, locale, t, int }: { crawls: CrawlDto[]; locale: DashLocale; t: SiteCrawlerCopy; int: Intl.NumberFormat }) {
  const u = t.ux;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{u.recentTitle}</h2>
          <Link href={CRAWLER_ROUTES.history} className="text-sm font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {u.allHistory}
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {crawls.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">{u.recentEmpty}</p>
        ) : (
          <ul className="divide-y divide-gray-100" data-testid="recent-crawls">
            {crawls.map((c) => {
              const host = hostOfCrawl(c.rootUrl);
              return (
                <li key={c.id}>
                  <Link
                    href={CRAWLER_ROUTES.results(c.id)}
                    aria-label={u.openCrawl(host)}
                    className="grid grid-cols-2 items-center gap-x-3 gap-y-1 py-3 text-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_auto_auto]"
                  >
                    <span className="col-span-2 truncate font-medium text-gray-900 sm:col-span-1">{host}</span>
                    <span className="text-xs text-gray-600">{date.format(new Date(c.createdAt))}</span>
                    <span className="text-xs tabular-nums text-gray-700">
                      <span className="sr-only">{u.colPages}: </span>
                      {int.format(c.pagesCrawled)}
                    </span>
                    <span className="text-xs tabular-nums text-gray-700" data-health>
                      <span className="sr-only">{u.colHealth}: </span>
                      {c.health === null || c.health === undefined ? u.healthNone : int.format(c.health)}
                    </span>
                    <span>
                      <Badge variant={c.status === "FAILED" ? "danger" : "default"}>{statusLabel(c.status, t)}</Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
