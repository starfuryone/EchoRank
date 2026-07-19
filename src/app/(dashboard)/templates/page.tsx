import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { TemplatesPageClient } from "./page-client";

export default async function TemplatesPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <TemplatesPageClient locale={locale} />;
}
