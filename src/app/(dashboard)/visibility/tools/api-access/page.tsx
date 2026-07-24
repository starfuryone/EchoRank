import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { ApiAccessClient } from "@/components/seo-tools/api-access-client";

// Tenant API keys for /api/public/v1/*. Paid gating enforced by ../layout.tsx.
export default async function ApiAccessPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <ApiAccessClient locale={locale} />;
}
