import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { LighthouseClient } from "@/components/seo-tools/lighthouse-client";

// Real data page (replaced the scaffold). Source is Google's PageSpeed
// Insights API v5 — NOT DataForSEO's on_page/lighthouse endpoint: PSI is free,
// it is Google's own Lighthouse runner, and it is the only source of CrUX
// field data. See src/lib/pagespeed/client.ts.
// Paid gating enforced by ../layout.tsx. There is no plan gate: PSI costs
// nothing, so the only limit is an hourly per-tenant cap protecting the shared
// Google quota.
export default async function LighthousePage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <LighthouseClient locale={locale} />;
}
