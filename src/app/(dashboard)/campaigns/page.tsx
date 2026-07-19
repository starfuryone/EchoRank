import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { CampaignsPageClient } from "./page-client";

export default async function CampaignsPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <CampaignsPageClient locale={locale} />;
}
