// Paid-subscription gate for the ENTIRE SEO Tools hub: this layout wraps
// /visibility/tools and every /visibility/tools/* page (and /crawler, which
// re-exports it), so the check lives in exactly one place. Unpaid tenants get
// the localized upgrade state instead of the children — server-enforced, not
// just a hidden sidebar link. API routes enforce the same predicate
// separately via requirePaidPlan().
//
// A plan that has ENDED (CANCELED) gets the same screen in its "your plan has
// ended — resubscribe" form: same gate, truer words (CANCEL-FAIR-PLAY).
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { getBillingContext, isPaidStatus } from "@/lib/paid-plan";
import { UpgradeState } from "@/components/seo-tools/upgrade-state";

export default async function SeoToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getCurrentTenant();
  const billing = membership ? await getBillingContext(membership.tenantId) : null;
  const paid = billing ? isPaidStatus(billing.status, billing.hasSubscriptionRow) : false;

  if (!paid) {
    const cookieStore = await cookies();
    const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
    return <UpgradeState locale={locale} ended={billing?.status === "CANCELED"} />;
  }

  return <>{children}</>;
}
