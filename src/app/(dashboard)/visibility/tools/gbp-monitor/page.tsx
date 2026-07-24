import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { FeatureScaffold } from "@/components/scaffold/feature-scaffold";

// INTEGRATION POINT: Google Business Profile API connection. Existing
// adjacent surface: review monitoring (/monitoring, MonitoringSource).
// Paid-subscription gating is enforced by ../layout.tsx for all tool pages.
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <FeatureScaffold locale={locale} id="gbp_monitor" />;
}
