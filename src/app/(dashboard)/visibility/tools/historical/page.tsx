import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { loadHistoricalPageData } from "@/lib/historical/page-data";
import { HistoricalClient } from "@/components/seo-tools/historical-client";

// Real page — no FeatureScaffold. Paid gating is enforced by ../layout.tsx;
// there is no feature flag, because this tool monetizes history the tenant
// already generated on a paid plan.
//
// v1 makes NO DataForSEO call on load: SERP history is a Prisma read over
// SerpCheck rows that already exist. The optional keyword-history panel is the
// only paid path, it is opt-in behind a button, and it is hidden outright when
// credentials are absent.
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();

  const data = membership
    ? await loadHistoricalPageData(membership.tenantId)
    : { keywords: [], snapshotUrls: [], storageConfigured: false, keywordHistoryAvailable: false };

  return <HistoricalClient locale={locale} data={data} />;
}
