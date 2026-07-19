import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { VisibilityPageClient } from "./page-client";

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
