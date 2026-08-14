import { cookies } from "next/headers";
import { SITE_URL } from "@/lib/seo/constants";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import {
  ATTRIBUTION_WINDOW_DAYS,
  loadAttributionPageData,
  type AttributionPageData,
} from "@/lib/attribution/page-data";
import { AiAttributionClient } from "@/components/seo-tools/ai-attribution-client";

// Real page — no FeatureScaffold. The paid gate is ../layout.tsx, which wraps
// every /visibility/tools/* route; the two API routes behind this page enforce
// the same predicate independently via requirePaidPlan(), because a page gate
// is not an API gate.
//
// Phase 1: arrivals only. No conversions, no revenue — see the client component.
//
// This tool spends nothing upstream. Every number comes from ai_visits rows the
// collector already wrote, so there is no costUsd to log and no quota to show.
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();

  const empty: AttributionPageData = {
    installed: false,
    hasData: false,
    windowDays: ATTRIBUTION_WINDOW_DAYS,
    totalVisitors: 0,
    bySource: [],
    landingPages: [],
    trend: [],
  };

  const data = membership ? await loadAttributionPageData(membership.tenantId) : empty;

  // SITE_URL is read here, not in the client component: @/lib/seo/constants
  // pulls in the plan config, and none of that belongs in a client bundle for
  // one origin string.
  return <AiAttributionClient locale={locale} data={data} siteUrl={SITE_URL} />;
}
