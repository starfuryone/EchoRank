// White-Label Audit Funnels — the agency's config, embed snippet and leads.
//
// ── Gating: TWO gates, both server-side ─────────────────────────────────────
// 1. PAID, from ../layout.tsx, which wraps every /visibility/tools/* route and
//    renders UpgradeState for a tenant whose billing status is not active.
// 2. AGENCY+, here, via hasFeature(planType, "whitelabel").
//
// `whitelabel` IS the AGENCY+ line in PLAN_FEATURES and it is the honest key
// rather than a convenient one: the whole artifact is a widget wearing somebody
// else's brand. A dedicated `audit_funnels` key would be a second name for the
// same tier line, and it would drift the first time somebody moves a plan.
//
// hasFeature() rather than requireFeature(): requireFeature throws
// FeatureNotAvailableError, which enforcementErrorResponse maps to a 403 — the
// right shape for the API routes and the wrong one for a page, where a GROWTH
// tenant should read what the tool does and how to get it.
//
// ── This page loads nothing ─────────────────────────────────────────────────
// The funnel list, the quota line and the leads tables all come from
// /api/agency/funnels. Server-rendering a first copy would mean two code paths
// producing the same list, and the server's would be stale the moment an agency
// edits a funnel — the same call the Opportunity Scanner page makes next door.
//
// SITE_URL is passed down because the embed snippet the page renders has to be
// an absolute URL: it is pasted onto somebody else's domain, where a relative
// src would resolve against theirs.

import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/feature-flags";
import { SITE_URL } from "@/lib/seo/constants";
import { FunnelsClient } from "@/components/seo-tools/funnels-client";

export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();

  const unlocked =
    membership !== null && hasFeature(membership.tenant.planType, "whitelabel");

  return (
    <FunnelsClient
      locale={locale}
      locked={!unlocked}
      siteUrl={new URL(SITE_URL).origin}
    />
  );
}
