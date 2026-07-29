import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { WebAnalyticsClient } from "@/components/seo-tools/web-analytics-client";

// Real data page (replaced the scaffold): GA4 via Google's Analytics Data API,
// connected per tenant with its own OAuth token (see src/lib/ga/client.ts for
// the required Google Cloud Console setup).
//
// The unconnected state IS the page — a connect card, not a placeholder.
// Distinct from /analytics, which is Echorank360's own reputation analytics;
// the copy says so and links across.
// Paid gating enforced by ../layout.tsx. No plan gate beyond paid: this is the
// tenant's own data and the GA4 API is free.
export default async function WebAnalyticsPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <WebAnalyticsClient locale={locale} />;
}
