import type { Metadata } from "next";
import { cookies } from "next/headers";
import { dashboardLocale, SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { CrawlHistory } from "@/components/seo-tools/site-crawler-history";

// Every crawl the workspace has kept (/crawler/history). Paid gating comes
// from ../layout.tsx; the list is read through the tenant-scoped crawl API.
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const t = SITE_CRAWLER_COPY[dashboardLocale(cookieStore.get("echorank_locale")?.value)];
  return { title: { absolute: t.pageTitle } };
}

export default async function CrawlHistoryPage() {
  const cookieStore = await cookies();
  return <CrawlHistory locale={dashboardLocale(cookieStore.get("echorank_locale")?.value)} />;
}
