import type { Metadata } from "next";
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { crawlerLocale, resultsMetadata } from "@/lib/site-crawler/page-metadata";
import { CrawlPagesPage } from "@/components/seo-tools/site-crawler-pages-page";

// The Pages view of one crawl (/crawler/[id]/pages): every crawled page with
// its status, findings and page score, searchable and sortable. ?rule=<id>
// filters it to that rule's pages (Issues › See all pages). Same data and
// tenant scoping as the Results page's Pages tab. Paid gating comes from
// ../../layout.tsx.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return resultsMetadata(await crawlerLocale(), id);
}

export default async function CrawlPagesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  return <CrawlPagesPage locale={dashboardLocale(cookieStore.get("echorank_locale")?.value)} crawlId={id} />;
}
