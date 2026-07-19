import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { SettingsPageClient } from "./page-client";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <SettingsPageClient locale={locale} />;
}
