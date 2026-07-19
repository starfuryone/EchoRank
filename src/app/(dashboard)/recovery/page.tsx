import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { RecoveryPageClient } from "./page-client";

export default async function RecoveryPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <RecoveryPageClient locale={locale} />;
}
