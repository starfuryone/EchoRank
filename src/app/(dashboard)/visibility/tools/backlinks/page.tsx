import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { seoQuotaUsage } from "@/lib/seo-quota";
import {
  SeoQuotaCounter,
  SeoQuotaExceededNotice,
} from "@/components/seo-tools/SeoQuotaNotice";
import { BacklinksClient } from "@/components/seo-tools/backlinks-client";

// Real data page (replaced the scaffold): five live DataForSEO Backlinks calls
// behind /api/seo/v1/backlinks/analyze — summary, history, referring domains,
// anchors and most-linked pages, cached 24 h per (target, mode).
// Paid gating enforced by ../layout.tsx; plan gating (STARTER sees
// the locked card) is enforced server-side in the API and mirrored in the client.
export default async function BacklinksPage() {
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
      <BacklinksClient locale={locale} />
    </div>
  );
}
