import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { KeywordsPageClient } from "./page-client";

export default async function KeywordsPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <KeywordsPageClient locale={locale} />;
}
