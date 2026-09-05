import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { seoQuotaUsage } from "@/lib/seo-quota";
import {
  SeoQuotaCounter,
  SeoQuotaExceededNotice,
} from "@/components/seo-tools/SeoQuotaNotice";
import { BacklinksClient } from "@/components/seo-tools/backlinks-client";
import { backlinksCapability } from "@/lib/backlinks/options";

// Real data page: live DataForSEO Backlinks calls behind
// /api/seo/v1/backlinks/analyze — summary, history, referring domains, anchors,
// most-linked pages and, on the Full tier, the individual-links table.
//
// CACHED 7 DAYS PER (target, scope), twice over: once in this tenant's own
// rows, and once in a cross-tenant Spaces object, because a link profile is a
// fact about the public web rather than about who asked. Both are checked
// before the allowance.
//
// TWO TIERS, ONE PAGE. The capability object below decides what renders; the
// SAME object is re-checked server-side in the service, because a component
// that declines to draw a control is not an authorization boundary. Paid
// gating is enforced by ../layout.tsx.
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
      <BacklinksClient
        locale={locale}
        capability={
          membership
            ? backlinksCapability(membership.tenant.planType)
            : backlinksCapability("STARTER")
        }
      />
    </div>
  );
}
