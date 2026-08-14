// AI Citation Finder — which sources the engines cite, and which of them have
// never once cited you.
//
// ── Gating: TWO gates, both server-side ─────────────────────────────────────
// 1. PAID, from ../layout.tsx, which wraps every /visibility/tools/* route and
//    renders UpgradeState for a tenant whose billing status is not active.
// 2. GROWTH+, here, via hasFeature(planType, "advanced_analytics").
//
// Same feature key Share of Voice uses, and for the same reason its page gives
// at length: `advanced_analytics` IS the GROWTH+ line in PLAN_FEATURES, and a
// `citation_finder` key would be a second name for the same line that drifts
// the first time somebody moves a tier.
//
// hasFeature() rather than requireFeature(): requireFeature throws
// FeatureNotAvailableError, which enforcementErrorResponse maps to a 403 — the
// right shape for an API route and the wrong one for a page, where a STARTER
// tenant should read what the tool does and how to get it.
//
// This tool spends nothing upstream. Every row comes from citations the checkup
// worker already paid for, so there is no costUsd to log and no quota to
// render.
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/feature-flags";
import {
  loadCitationPageData,
  CITATION_PAGE_SIZE,
  type CitationPageData,
} from "@/lib/citations/read";
import { CitationFinderClient } from "@/components/seo-tools/citation-finder-client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    brand?: string;
    preset?: string;
    kind?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();
  const params = await searchParams;

  const empty: CitationPageData = {
    hasData: false,
    brands: [],
    selectedBrandProfileId: null,
    brandName: null,
    rows: [],
    total: 0,
    page: 1,
    pageSize: CITATION_PAGE_SIZE,
    preset: "all",
    kind: null,
    sort: "seen",
    dir: "desc",
    opportunityCount: 0,
  };

  const unlocked =
    membership !== null && hasFeature(membership.tenant.planType, "advanced_analytics");

  // The read is skipped entirely when locked — not fetched and hidden. A locked
  // page that still runs the queries leaks nothing visually and everything in
  // the query log, and it costs four database round trips to show a lock icon.
  const data =
    unlocked && membership
      ? await loadCitationPageData(membership.tenantId, {
          brandProfileId: params.brand ?? null,
          preset: params.preset ?? null,
          kind: params.kind ?? null,
          sort: params.sort ?? null,
          dir: params.dir ?? null,
          // A junk ?page= falls back to 1 rather than NaN-ing the offset.
          page: Number.parseInt(params.page ?? "1", 10) || 1,
        })
      : empty;

  return <CitationFinderClient locale={locale} data={data} locked={!unlocked} />;
}
