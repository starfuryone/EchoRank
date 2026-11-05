import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AV_ICONS } from "@/lib/ai-visibility/brand";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { VisibilityPageClient } from "./page-client";

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
  return <VisibilityPageClient locale={locale} onboarding={onboarding === "1"} />;
}
