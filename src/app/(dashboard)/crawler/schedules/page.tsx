import type { Metadata } from "next";
import { cookies } from "next/headers";
import { dashboardLocale, SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { CrawlSchedulesView } from "@/components/seo-tools/site-crawler-schedules-view";

// Scheduled crawls (/crawler/schedules): the list and the editor. Paid gating
// comes from ../layout.tsx; the schedules API is tenant-scoped and flag-gated.
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const t = SITE_CRAWLER_COPY[dashboardLocale(cookieStore.get("echorank_locale")?.value)];
  return { title: { absolute: t.pageTitle } };
}

export default async function CrawlSchedulesPage() {
  const cookieStore = await cookies();
  return <CrawlSchedulesView locale={dashboardLocale(cookieStore.get("echorank_locale")?.value)} />;
}
