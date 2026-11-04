import type { Metadata } from "next";
import { cookies } from "next/headers";
import { dashboardLocale, SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { SiteCrawlerClient } from "@/components/seo-tools/site-crawler-client";

// Results of one crawl (/crawler/[id]): progress while it runs, then the
// report. The crawl is read through the tenant-scoped API like everything
// else on these pages; another workspace's id answers "not found". Paid
// gating comes from ../layout.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const t = SITE_CRAWLER_COPY[dashboardLocale(cookieStore.get("echorank_locale")?.value)];
  return { title: { absolute: t.pageTitle } };
}

export default async function CrawlResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <SiteCrawlerClient locale={locale} view="results" crawlId={id} />;
}
