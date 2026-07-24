// Paid-subscription gate for the ENTIRE SEO Tools hub: this layout wraps
// /visibility/tools and every /visibility/tools/* page, so the check lives in
// exactly one place. Unpaid tenants (billing status ≠ ACTIVE) get the
// localized upgrade state instead of the children — server-enforced, not just
// a hidden sidebar link. API routes enforce the same predicate separately via
// requirePaidPlan().
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { hasPaidPlan } from "@/lib/paid-plan";
import { UpgradeState } from "@/components/seo-tools/upgrade-state";

export default async function SeoToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getCurrentTenant();
  const paid = membership ? await hasPaidPlan(membership.tenantId) : false;

  if (!paid) {
    const cookieStore = await cookies();
    const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
    return <UpgradeState locale={locale} />;
  }

  return <>{children}</>;
}
