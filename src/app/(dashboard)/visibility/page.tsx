import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AV_ICONS } from "@/lib/ai-visibility/brand";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { VisibilityPageClient } from "./page-client";
import { getCurrentTenant } from "@/lib/tenant";
import { planAllowsPage } from "@/lib/plan-access";

/** The AI Visibility emblem as the tab icon (the title stays the app's). */
export const metadata: Metadata = { icons: AV_ICONS };

export default async function VisibilityPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const { onboarding } = await searchParams;
  // The plan allowlist (src/lib/plan-access.ts): the Keywords Explorer link is
  // drawn only for a plan that includes it.
  const membership = await getCurrentTenant();
  const keywordsLink = planAllowsPage(membership?.tenant.planType, "/visibility/keywords");
  return <VisibilityPageClient locale={locale} onboarding={onboarding === "1"} keywordsLink={keywordsLink} />;
}
