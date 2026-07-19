import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { AnalyticsPageClient } from "./page-client";

export default async function AnalyticsPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <AnalyticsPageClient locale={locale} />;
}
