import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { SerpCheckerClient } from "@/components/seo-tools/serp-checker-client";

// Real data page (replaced the scaffold): DataForSEO standard-queue SERP
// checks via /api/seo/v1/serp/check, completed by the serp-checks worker.
// Paid gating enforced by ../layout.tsx.
export default async function SerpCheckerPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <SerpCheckerClient locale={locale} />;
}
