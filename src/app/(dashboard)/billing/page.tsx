import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { BillingPageClient } from "./page-client";
import { creditBalance, creditHistory } from "@/lib/credits/store";

export default async function BillingPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);

  // Tenant.planType is read HERE, server-side, and passed down. The client
  // never infers the current tier: the billing GET it already makes is for
  // usage and period dates, and treating that payload as the authority on
  // which plan a tenant is on would put the answer on the wrong side of the
  // wire.
  const membership = await getCurrentTenant();

  // Credits are read server-side for the same reason planType is: the balance
  // is money, and a client that computed it from a list of ledger rows it
  // fetched could disagree with the server's SUM the moment a page is stale.
  // One authority, resolved here, passed down as a number.
  const [credits, history] = membership
    ? await Promise.all([
        creditBalance(membership.tenantId),
        creditHistory(membership.tenantId),
      ])
    : [0, []];

  return (
    <BillingPageClient
      locale={locale}
      currentPlan={membership?.tenant.planType ?? null}
      credits={credits}
      creditHistory={history}
    />
  );
}
