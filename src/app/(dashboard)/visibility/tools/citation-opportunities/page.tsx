// Citation Opportunities — the sources worth getting listed on, in the order
// worth doing them.
//
// ── Gating: TWO gates, both server-side ─────────────────────────────────────
// 1. PAID, from ../layout.tsx, which wraps every /visibility/tools/* route and
//    renders UpgradeState for a tenant whose billing status is not active.
// 2. GROWTH+, here, via hasFeature(planType, "advanced_analytics").
//
// The same feature key Citation Finder and Share of Voice use, deliberately:
// `advanced_analytics` IS the GROWTH+ line in PLAN_FEATURES, and a
// `citation_opportunities` key would be a second name for the same line that
// drifts the first time somebody moves a tier. This tool is downstream of
// Citation Finder in every sense, so gating them differently would produce the
// worst possible state — a worklist a customer can read, built from a table
// they cannot.
//
// hasFeature() rather than requireFeature(): requireFeature throws
// FeatureNotAvailableError, which enforcementErrorResponse maps to a 403 — the
// right shape for the PATCH route and the wrong one for a page, where a STARTER
// tenant should read what the tool does and how to get it.
//
// SPENDING HAPPENS IN THE WORKER, NEVER HERE. The weekly job makes at most one
// metered DataForSEO call per tenant; this page renders rows that job already
// wrote. A page load costs three database round trips and nothing else, which
// is what makes it safe to leave open on a second monitor.
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/feature-flags";
import {
  loadOpportunityPageData,
  OPPORTUNITY_LIST_LIMIT,
  type OpportunityPageData,
} from "@/lib/citation-opportunities/read";
import { CitationOpportunitiesClient } from "@/components/seo-tools/citation-opportunities-client";

export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();

  const empty: OpportunityPageData = {
    hasData: false,
    rows: [],
    total: 0,
    openCount: 0,
    provenCount: 0,
    limit: OPPORTUNITY_LIST_LIMIT,
  };

  const unlocked =
    membership !== null && hasFeature(membership.tenant.planType, "advanced_analytics");

  // The read is skipped entirely when locked — not fetched and hidden. A locked
  // page that still runs the queries leaks nothing visually and everything in
  // the query log, and it costs three database round trips to show a lock icon.
  const data = unlocked && membership ? await loadOpportunityPageData(membership.tenantId) : empty;

  return <CitationOpportunitiesClient locale={locale} data={data} locked={!unlocked} />;
}
