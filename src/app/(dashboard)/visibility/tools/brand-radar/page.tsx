import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { FeatureScaffold } from "@/components/scaffold/feature-scaffold";

// INTEGRATION POINT: brand mentions across search + AI platforms. AI-answer
// mention tracking already exists (TrackedPrompt + answer_track sidecar,
// surfaced at /visibility#prompts); search-side mention tracking does not.
// Paid-subscription gating is enforced by ../layout.tsx for all tool pages.
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <FeatureScaffold locale={locale} id="brand_radar" />;
}
