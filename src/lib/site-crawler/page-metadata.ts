// src/lib/site-crawler/page-metadata.ts
//
// <title>, description and robots for the crawler's four views (UX
// restructure). Every view is behind sign-in and noindex. The Results title
// names the crawl ("Crawl of <host>, <date>"), read tenant-scoped: another
// workspace's id, a signed-out request or a missing row gets the generic one.

import "server-only";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { dashboardLocale, SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { CRAWLER_BRAND } from "./brand";

export type CrawlerPage = "start" | "results" | "history" | "schedules";

export const NOINDEX: Metadata["robots"] = { index: false, follow: false };

/** The tab icon on every crawler view: the 32 px emblem (the root favicon.ico stays for the rest of the app). */
export const CRAWLER_ICONS: Metadata["icons"] = { icon: [{ url: CRAWLER_BRAND.favicon, type: "image/png", sizes: "32x32" }] };

export async function crawlerLocale(): Promise<DashLocale> {
  const cookieStore = await cookies();
  return dashboardLocale(cookieStore.get("echorank_locale")?.value);
}

/** "Crawl of shop.example, 1 Nov 2026" — the date in UTC, in the dashboard locale. */
export function resultsTitle(locale: DashLocale, rootUrl: string, createdAt: Date): string {
  let host = rootUrl;
  try {
    host = new URL(rootUrl).host;
  } catch {
    // keep the stored root
  }
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(createdAt);
  return SITE_CRAWLER_COPY[locale].ux.metaResultsTitle(host, date);
}

export function crawlerMetadata(locale: DashLocale, page: Exclude<CrawlerPage, "results">): Metadata {
  const u = SITE_CRAWLER_COPY[locale].ux;
  const [title, description] =
    page === "start" ? [u.metaStartTitle, u.metaStartDesc] : page === "history" ? [u.metaHistoryTitle, u.metaHistoryDesc] : [u.metaSchedulesTitle, u.metaSchedulesDesc];
  // Absolute: the title already carries the brand; the root template would repeat it.
  return { title: { absolute: title }, description, robots: NOINDEX, icons: CRAWLER_ICONS };
}

export async function resultsMetadata(locale: DashLocale, crawlId: string): Promise<Metadata> {
  const u = SITE_CRAWLER_COPY[locale].ux;
  let title = u.metaResultsFallback;
  try {
    const member = await getCurrentTenant();
    const crawl = member
      ? await prisma.crawlJob.findFirst({ where: { id: crawlId, tenantId: member.tenantId }, select: { rootUrl: true, createdAt: true } })
      : null;
    if (crawl) title = resultsTitle(locale, crawl.rootUrl, crawl.createdAt);
  } catch {
    // The title is never worth an error page.
  }
  return { title: { absolute: title }, description: u.metaResultsDesc, robots: NOINDEX, icons: CRAWLER_ICONS };
}
