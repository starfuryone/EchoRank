// AI Share of Voice — how much of each engine's answers this brand owns.
//
// ── Gating: TWO gates, both server-side ─────────────────────────────────────
// 1. PAID, from ../layout.tsx, which wraps every /visibility/tools/* route and
//    renders UpgradeState for a tenant whose billing status is not active.
// 2. GROWTH+, here, via hasFeature(planType, "advanced_analytics").
//
// `advanced_analytics` IS the GROWTH+ line and is not a new flag invented for
// this page: PLAN_FEATURES in src/lib/feature-flags.ts grants it to GROWTH,
// AGENCY and ENTERPRISE and withholds it from STARTER (and from the retired
// AI_VISIBILITY tier, which aliases STARTER's set). Adding a `share_of_voice`
// feature key would have created a second name for the same line, and the two
// would have drifted the first time somebody moved a tier.
//
// hasFeature() rather than requireFeature(): requireFeature throws
// FeatureNotAvailableError, which enforcementErrorResponse maps to a 403 — the
// right shape for an API route and the wrong one for a page, where a STARTER
// tenant should read what the tool does and how to get it. Same choice
// rank-tracker makes for its own locked card, and the same one paid-plan.ts
// documents ("Pages that prefer a rendered upgrade state over an error should
// call hasPaidPlan() and branch instead").
//
// This tool spends nothing upstream. Every number comes from Watcher runs the
// checkup worker already paid for, so there is no costUsd to log and no quota
// to render.
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/feature-flags";
import { loadSovPageData, type SovPageData } from "@/lib/sov/read";
import { SOV_WINDOW_DAYS } from "@/lib/sov/store";
import { ShareOfVoiceClient } from "@/components/seo-tools/share-of-voice-client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ promptSet?: string; engine?: string }>;
}) {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();
  const params = await searchParams;

  const empty: SovPageData = {
    hasData: false,
    windowDays: SOV_WINDOW_DAYS,
    brandName: null,
    promptSets: [],
    selectedPromptSetId: null,
    engines: [],
    selectedEngine: null,
    latestDate: null,
    byEngine: [],
    trend: [],
    headline: { you: 0, topRival: null, delta: null, deltaSpanDays: null },
  };

  const unlocked =
    membership !== null && hasFeature(membership.tenant.planType, "advanced_analytics");

  // The read is skipped entirely when locked — not fetched and hidden. A locked
  // page that still runs the queries leaks nothing visually and everything in
  // the query log, and it costs a database round trip to show a lock icon.
  const data = unlocked && membership ? await loadSovPageData(membership.tenantId, {
    promptSetId: params.promptSet ?? null,
    engine: params.engine ?? null,
  }) : empty;

  return <ShareOfVoiceClient locale={locale} data={data} locked={!unlocked} />;
}
