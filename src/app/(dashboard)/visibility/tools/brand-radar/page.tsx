import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { BrandRadarClient } from "@/components/seo-tools/brand-radar-client";

// Real data page (replaced the scaffold): audits + prompt tracking + alerts.
// Paid-subscription gating is enforced by ../layout.tsx.
export default async function BrandRadarPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <BrandRadarClient locale={locale} />;
}
