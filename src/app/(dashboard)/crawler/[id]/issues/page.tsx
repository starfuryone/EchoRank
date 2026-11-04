import type { Metadata } from "next";
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { crawlerLocale, resultsMetadata } from "@/lib/site-crawler/page-metadata";
import { CrawlIssuesPage } from "@/components/seo-tools/site-crawler-issues-page";

// The Issues view of one crawl (/crawler/[id]/issues): every rule that fired,
// by impact, with evidence and how to fix it. Same data and tenant scoping as
// the Results page's Issues tab. Paid gating comes from ../../layout.tsx.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return resultsMetadata(await crawlerLocale(), id);
}

export default async function CrawlIssuesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  return <CrawlIssuesPage locale={dashboardLocale(cookieStore.get("echorank_locale")?.value)} crawlId={id} />;
}
