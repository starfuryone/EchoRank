import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { FeatureScaffold } from "@/components/scaffold/feature-scaffold";

// INTEGRATION POINT: SERP rank-tracking backend (no existing service).
// Keyword discovery already exists: sidecar POST /keywords via
// /api/ai/visibility/keywords (see /visibility/keywords).
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <FeatureScaffold locale={locale} id="rank_tracker" />;
}
