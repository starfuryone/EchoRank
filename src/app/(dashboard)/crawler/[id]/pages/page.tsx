import type { Metadata } from "next";
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { crawlerLocale, resultsMetadata } from "@/lib/site-crawler/page-metadata";
import { SiteCrawlerClient } from "@/components/seo-tools/site-crawler-client";

// The Pages view of one crawl (/crawler/[id]/pages): the Results page opened
// on Pages. ?rule=<id> filters it to pages with a finding of that rule (the
// Issues view's "See all pages"). Paid gating comes from ../../layout.tsx.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return resultsMetadata(await crawlerLocale(), id);
}

export default async function CrawlPagesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  return <SiteCrawlerClient locale={dashboardLocale(cookieStore.get("echorank_locale")?.value)} view="results" crawlId={id} initialTab="pages" />;
}
