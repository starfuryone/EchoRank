import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { VisibilityPageClient } from "./page-client";

export default async function VisibilityPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <VisibilityPageClient locale={locale} />;
}
