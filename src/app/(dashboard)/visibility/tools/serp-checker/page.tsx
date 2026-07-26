import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { FeatureScaffold } from "@/components/scaffold/feature-scaffold";

// INTEGRATION POINT: DataForSEO serp/google/organic/live/advanced (port spec Phase 4).
// Paid-subscription gating is enforced by ../layout.tsx for all tool pages.
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <FeatureScaffold locale={locale} id="serp_checker" />;
}
