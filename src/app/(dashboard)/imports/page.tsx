import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { ImportsPageClient } from "./page-client";

export default async function ImportsPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <ImportsPageClient locale={locale} />;
}
