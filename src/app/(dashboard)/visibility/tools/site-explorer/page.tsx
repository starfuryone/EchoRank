import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { SiteExplorerClient } from "@/components/seo-tools/site-explorer-client";

// Real data page (replaced the scaffold): four live DataForSEO calls behind
// /api/seo/v1/site-explorer/analyze — domain overview, ranked keywords,
// competitors, and the backlink summary, cached 24 h per domain.
// Paid gating enforced by ../layout.tsx.
export default async function SiteExplorerPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <SiteExplorerClient locale={locale} />;
}
