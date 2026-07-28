import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { RankTrackerClient } from "@/components/seo-tools/rank-tracker-client";

// Real data page (replaced the scaffold): tracking projects post their keywords
// to the DataForSEO standard queue on a schedule (rank-tracker worker), and the
// shared sweep in serp-check.worker.ts writes the positions back.
// Paid gating enforced by ../layout.tsx; plan gating (STARTER/AI_VISIBILITY see
// the locked card) is enforced server-side in the API and mirrored here.
export default async function RankTrackerPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <RankTrackerClient locale={locale} />;
}
