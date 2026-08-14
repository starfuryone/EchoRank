import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { NotificationsPageClient } from "./page-client";

// No plan gate and no requireFeature: every tier reaches this page. The
// (dashboard) layout already redirects an unauthenticated visitor to /login,
// and each API call underneath re-checks the tenant server-side.
export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <NotificationsPageClient locale={locale} />;
}
