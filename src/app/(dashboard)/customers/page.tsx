import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { CustomersPageClient } from "./page-client";

export default async function CustomersPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <CustomersPageClient locale={locale} />;
}
