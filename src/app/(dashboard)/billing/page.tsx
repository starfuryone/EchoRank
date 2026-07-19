import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { BillingPageClient } from "./page-client";

export default async function BillingPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <BillingPageClient locale={locale} />;
}
