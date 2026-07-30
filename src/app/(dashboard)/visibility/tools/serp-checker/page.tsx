import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { seoQuotaUsage } from "@/lib/seo-quota";
import {
  SeoQuotaCounter,
  SeoQuotaExceededNotice,
} from "@/components/seo-tools/SeoQuotaNotice";
import { SerpCheckerClient } from "@/components/seo-tools/serp-checker-client";

// Real data page (replaced the scaffold): DataForSEO standard-queue SERP
// checks via /api/seo/v1/serp/check, completed by the serp-checks worker.
// Paid gating enforced by ../layout.tsx.
export default async function SerpCheckerPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  // Server-fetched so the counter is correct on first paint rather than
  // after a round trip — and so an exhausted tenant sees why before they
  // fill in the form.
  const membership = await getCurrentTenant();
  const quota = membership
    ? await seoQuotaUsage(membership.tenantId, membership.tenant.planType)
    : null;
  return (
    <div className="space-y-4">
      {quota && <SeoQuotaExceededNotice usage={quota} locale={locale} />}
      {quota && <SeoQuotaCounter usage={quota} locale={locale} />}
      <SerpCheckerClient locale={locale} />
    </div>
  );
}
