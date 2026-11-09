// /visibility/tools/link-authority — the Link Authority Checker, in-app
// (2026-11-09): one domain plus up to three competitors, the full report
// (Echorank Authority, link counts, the comparison, the top 10 referring
// domains) with no email gate.
//
// ON EVERY PAID PLAN, the AI-only one included: the plan allowlist
// (src/lib/plan-access.ts, area "link_authority") opens it there, and the
// tools layout (../layout.tsx) shows the upgrade screen to a tenant that is
// not paid (hasPaidPlan, the predicate requirePaidPlan enforces on the API).
//
// Usage is read on the server so the counter, and the "used this month's
// checks" panel, are right on first paint.

import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { linkAuthorityUsage } from "@/lib/authority-checker/quota";
import { LinkAuthorityClient } from "@/components/seo-tools/link-authority-client";

export default async function LinkAuthorityPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();
  const usage = membership ? await linkAuthorityUsage(membership.tenantId, membership.tenant.planType) : null;
  return <LinkAuthorityClient locale={locale} initialUsage={usage} />;
}
