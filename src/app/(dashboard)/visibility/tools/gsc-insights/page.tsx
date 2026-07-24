import { Suspense } from "react";
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { GscInsightsClient } from "@/components/seo-tools/gsc-insights-client";

// Real data page (replaced the scaffold): per-tenant Google Search Console
// OAuth + performance. Paid gating enforced by ../layout.tsx. Suspense is
// required because the client reads callback query params (useSearchParams).
export default async function GscInsightsPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return (
    <Suspense fallback={null}>
      <GscInsightsClient locale={locale} />
    </Suspense>
  );
}
