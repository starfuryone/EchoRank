import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { IntelligencePageClient } from "./page-client";

export default async function IntelligencePage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <IntelligencePageClient locale={locale} />;
}
