import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { MonitoringPageClient } from "./page-client";

export default async function MonitoringPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <MonitoringPageClient locale={locale} />;
}
