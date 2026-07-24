import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { BotAnalyticsClient } from "@/components/seo-tools/bot-analytics-client";

// Real data page (replaced the scaffold): crawler access posture from the
// sidecar's robots.txt/sitemap/llms.txt evaluation. Honest labeling — no
// traffic numbers exist. Paid gating enforced by ../layout.tsx.
export default async function BotAnalyticsPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <BotAnalyticsClient locale={locale} />;
}
