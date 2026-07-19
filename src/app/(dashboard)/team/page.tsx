import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { TeamPageClient } from "./page-client";

export default async function TeamPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <TeamPageClient locale={locale} />;
}
