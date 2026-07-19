import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardPageClient } from "./page-client";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <DashboardPageClient locale={locale} />;
}
