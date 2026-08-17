// Keyword Opportunity Finder — which commercial keywords answer without you.
//
// ── Gating ──────────────────────────────────────────────────────────────────
// PAID ONLY, and that gate is inherited rather than repeated: ../layout.tsx
// wraps every /visibility/tools/* route and renders UpgradeState for a tenant
// whose billing status is not active. There is no second tier gate here,
// deliberately — every sellable tier carries a domain-analysis allowance (see
// keywordOpportunityAnalysesPerMonth in plan-config), so a tier check would
// only ever refuse a tenant who has one. The allowance itself is the limit, and
// it is shown rather than enforced by hiding the page.
//
// ── This page renders a fixture, and says so ────────────────────────────────
// Phase 2 ships the whole user-facing flow with no worker behind it. Rather
// than hide the tool until the pipeline lands, the page renders a worked
// example for acmecrm.com and labels it as one, in copy, at the top, in every
// locale. The alternative — shipping the card and quietly showing a stranger's
// keywords as if they were the tenant's — is the version of this that generates
// a support ticket.
//
// Every score in that example is computed by the live scoring code
// (lib/keyword-opportunity/score.ts) from fixture inputs, so what a customer
// sees here is the real formula's real output, not a mockup.
//
// The `state` search param selects which of the seven states the demo renders.
// It is read here rather than toggled in the UI because each of those is a
// state the Phase 3 worker genuinely produces, so the client branches now on
// exactly the data it will branch on later.

import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { demoPageData, isDemoState } from "@/lib/keyword-opportunity/fixtures";
import { KeywordOpportunitiesClient } from "@/components/seo-tools/keyword-opportunities-client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const [cookieStore, params] = await Promise.all([cookies(), searchParams]);
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);

  // Resolved but unused while the page is a fixture: Phase 3 reads the tenant's
  // plan for the allowance and its brand profiles for the domain picker. Kept
  // so the route already fails the same way for a session with no tenant.
  await getCurrentTenant();

  const state = isDemoState(params.state) ? params.state : "results";

  return <KeywordOpportunitiesClient locale={locale} data={demoPageData(state)} preview />;
}
