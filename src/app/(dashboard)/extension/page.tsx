import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { ExtensionPageClient } from "./page-client";

export default async function ExtensionPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <ExtensionPageClient locale={locale} />;
}
