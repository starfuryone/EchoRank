import type { Metadata } from "next";
import { cookies } from "next/headers";
import { dashboardLocale, SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { SiteCrawlerClient } from "@/components/seo-tools/site-crawler-client";

// The Site Crawler (CRAWLER_BRAND) — our own BFS crawl of a tenant's site, no
// external API. The worker fetches and parses raw HTML in-process, respects
// robots.txt, and stays under 2 requests a second; render mode (Phase 3b)
// sends the pages it picks through the av-service sidecar's headless Chromium.
//
// NOT Site Audit, which buys a technical crawl from DataForSEO and is priced
// per page. This one is first-party and capped by URLs per plan.
//
// The crawl outlives the page view (up to an hour), so everything here is
// built for leaving and coming back — the client polls a row the worker owns.
// Paid gating is enforced by ./layout.tsx (the SEO Tools hub gate, reused);
// the per-tier lock is in the client. The old /visibility/tools/site-crawler
// path 308s here.
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const t = SITE_CRAWLER_COPY[dashboardLocale(cookieStore.get("echorank_locale")?.value)];
  // Absolute: the page title already ends in the brand, so the root template's
  // "| Echorank360" would say it twice.
  return { title: { absolute: t.pageTitle } };
}

export default async function SiteCrawlerPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <SiteCrawlerClient locale={locale} />;
}
