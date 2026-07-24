import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { FeatureScaffold } from "@/components/scaffold/feature-scaffold";

// INTEGRATION POINT: web-traffic analytics ingestion (no existing
// service — /analytics is reputation/feedback analytics, a different
// product surface).
// Paid-subscription gating is enforced by ../layout.tsx for all tool pages.
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <FeatureScaffold locale={locale} id="web_analytics" />;
}
