// Keyword Opportunity Finder — which commercial keywords answer without you.
//
// ── Gating: TWO gates, and they do different jobs ───────────────────────────
//
// 1. PAID, from ../layout.tsx, which wraps every /visibility/tools/* route and
//    renders UpgradeState for a tenant whose billing status is not active.
//    There is no additional TIER gate: every sellable tier carries a
//    domain-analysis allowance (keywordOpportunityAnalysesPerMonth), so a tier
//    check would only ever refuse a tenant who has one. The allowance is the
//    limit and it is shown rather than enforced by hiding the page.
//
// 2. ROLLOUT, here, via kofEnabledFor(). This decides LIVE OR DEMO, not
//    visible or hidden — which is unusual and deliberate. A tenant who is not
//    allowlisted gets the AcmeCRM worked example behind its preview notice:
//    a page that demonstrates the product honestly and says it is doing so.
//    Nothing regresses for them when the feature goes live for someone else.
//
//    The same gate is checked again in the API route. Rendering a demo is not
//    security, and without a server-side check a non-allowlisted tenant could
//    guess the endpoint and spend real money.
//
// ── The demo's `state` param does not exist in live mode ────────────────────
// It selects which of the seven fixture states to render, which is meaningless
// once the states come from a real row. Read only on the demo path.

import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { registrableDomain } from "@/lib/registrable-domain";
import { prisma } from "@/lib/prisma";
import { demoPageData, isDemoState } from "@/lib/keyword-opportunity/fixtures";
import { kofEnabledFor } from "@/lib/keyword-opportunity/rollout";
import { entitlementFor } from "@/lib/keyword-opportunity/store";
import { readLatestAnalysis } from "@/lib/keyword-opportunity/read";
import { KeywordOpportunitiesClient } from "@/components/seo-tools/keyword-opportunities-client";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const [cookieStore, params] = await Promise.all([cookies(), searchParams]);
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();

  const tenantId = membership?.tenant.id ?? null;

  if (membership && kofEnabledFor(tenantId)) {
    // The project a domain analysis hangs off. The first brand profile with a
    // usable website is the default; a picker is a later phase, and a tenant
    // with none falls through to the demo rather than to an error.
    const profile = await prisma.brandProfile.findFirst({
      where: { tenantId: membership.tenant.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, website: true },
    });
    const domain = profile?.website ? registrableDomain(profile.website) : "";

    if (profile && domain) {
      const [entitlement, analysis] = await Promise.all([
        entitlementFor(membership.tenant.id, membership.tenant.planType, domain),
        readLatestAnalysis(membership.tenant.id, profile.id),
      ]);

      return (
        <KeywordOpportunitiesClient
          locale={locale}
          live
          data={{
            brandProfileId: profile.id,
            brandName: profile.name,
            domain,
            entitlement,
            analysis,
          }}
        />
      );
    }
  }

  const state = isDemoState(params.state) ? params.state : "results";
  return <KeywordOpportunitiesClient locale={locale} data={demoPageData(state)} preview />;
}
