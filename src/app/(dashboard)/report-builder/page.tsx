import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { FeatureScaffold } from "@/components/scaffold/feature-scaffold";

// INTEGRATION POINT: custom report composition. PDF rendering already
// exists in the sidecar (pdf_report.py: /report, /monitoring-report,
// /intelligence-report) — a builder would assemble payloads for it.
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <FeatureScaffold locale={locale} id="report_builder" />;
}
