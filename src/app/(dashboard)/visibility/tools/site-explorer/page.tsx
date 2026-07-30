import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { seoQuotaUsage } from "@/lib/seo-quota";
import {
  SeoQuotaCounter,
  SeoQuotaExceededNotice,
} from "@/components/seo-tools/SeoQuotaNotice";
import { SiteExplorerClient } from "@/components/seo-tools/site-explorer-client";

// Real data page (replaced the scaffold): four live DataForSEO calls behind
// /api/seo/v1/site-explorer/analyze — domain overview, ranked keywords,
// competitors, and the backlink summary, cached 24 h per domain.
// Paid gating enforced by ../layout.tsx.
export default async function SiteExplorerPage() {
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
      <SiteExplorerClient locale={locale} />
    </div>
  );
}
