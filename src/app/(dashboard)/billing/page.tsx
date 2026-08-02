import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { BillingPageClient } from "./page-client";

export default async function BillingPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);

  // Tenant.planType is read HERE, server-side, and passed down. The client
  // never infers the current tier: the billing GET it already makes is for
  // usage and period dates, and treating that payload as the authority on
  // which plan a tenant is on would put the answer on the wrong side of the
  // wire.
  const membership = await getCurrentTenant();

  return (
    <BillingPageClient
      locale={locale}
      currentPlan={membership?.tenant.planType ?? null}
    />
  );
}
