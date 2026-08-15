// Agency Opportunity Scanner — bulk prospect grading, worst first.
//
// ── Gating: TWO gates, both server-side ─────────────────────────────────────
// 1. PAID, from ../layout.tsx, which wraps every /visibility/tools/* route and
//    renders UpgradeState for a tenant whose billing status is not active.
// 2. AGENCY+, here, via hasFeature(planType, "whitelabel").
//
// `whitelabel` IS the AGENCY+ line in PLAN_FEATURES, and it is the honest key
// rather than a convenient one: the artifact this tool exists to produce is a
// white-labeled outreach PDF, so a tenant who cannot white-label cannot use the
// output. A dedicated `agency_scanner` key would be a second name for the same
// tier line that drifts the first time somebody moves a plan.
//
// hasFeature() rather than requireFeature(): requireFeature throws
// FeatureNotAvailableError, which enforcementErrorResponse maps to a 403 — the
// right shape for the API routes and the wrong one for a page, where a GROWTH
// tenant should read what the tool does and how to get it.
//
// ── This page loads nothing ─────────────────────────────────────────────────
// Unlike its siblings, the initial render carries no data. The batch list, the
// quota line and the row tables all come from /api/agency/scan, because the
// client polls that endpoint anyway while a batch is running — server-rendering
// a first copy would mean two code paths producing the same list, and the
// server's would be stale within a second of a scan starting.
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/feature-flags";
import { MAX_BATCH_ROWS } from "@/lib/opportunity-scanner/parse";
import { OpportunityScannerClient } from "@/components/seo-tools/opportunity-scanner-client";

export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();

  const unlocked =
    membership !== null && hasFeature(membership.tenant.planType, "whitelabel");

  return (
    <OpportunityScannerClient
      locale={locale}
      locked={!unlocked}
      maxRows={MAX_BATCH_ROWS}
    />
  );
}
