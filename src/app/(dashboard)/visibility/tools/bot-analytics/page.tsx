import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { FeatureScaffold } from "@/components/scaffold/feature-scaffold";

// INTEGRATION POINT: continuous crawler-activity ingestion. A one-shot
// version already exists: the av-visibility sidecar POST /attribute
// parses access logs into AI-crawler hit deltas (surfaced on /visibility).
// Paid-subscription gating is enforced by ../layout.tsx for all tool pages.
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <FeatureScaffold locale={locale} id="bot_analytics" />;
}
