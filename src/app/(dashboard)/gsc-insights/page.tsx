import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { FeatureScaffold } from "@/components/scaffold/feature-scaffold";

// INTEGRATION POINT: Google Search Console OAuth + Search Analytics API
// ingestion (no existing service).
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <FeatureScaffold locale={locale} id="gsc_insights" />;
}
