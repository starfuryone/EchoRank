import type { Metadata } from "next";
import { cookies } from "next/headers";
import { crawlerLocale, crawlerMetadata } from "@/lib/site-crawler/page-metadata";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { CrawlHistory } from "@/components/seo-tools/site-crawler-history";

// Every crawl the workspace has kept (/crawler/history). Paid gating comes
// from ../layout.tsx; the list is read through the tenant-scoped crawl API.
export async function generateMetadata(): Promise<Metadata> {
  return crawlerMetadata(await crawlerLocale(), "history");
}

export default async function CrawlHistoryPage() {
  const cookieStore = await cookies();
  return <CrawlHistory locale={dashboardLocale(cookieStore.get("echorank_locale")?.value)} />;
}
