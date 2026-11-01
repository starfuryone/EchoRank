import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { BillingPageClient } from "./page-client";
import { creditBalance, creditHistory } from "@/lib/credits/store";
import { getBillingContext } from "@/lib/paid-plan";

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
  const [credits, history, billing] = membership
    ? await Promise.all([
        creditBalance(membership.tenantId),
        creditHistory(membership.tenantId),
        getBillingContext(membership.tenantId),
      ])
    : [0, [], null];

  // STATUS FIRST, TIER SECOND. Tenant.planType defaults to STARTER for every
  // tenant whether or not anything was ever bought, so passing it alone would
  // put a "Current plan" badge on the Starter card of a tenant that has never
  // subscribed — and remove its buy button, because "current" is the one action
  // with nothing to click.
  //
  // DEFENCE IN DEPTH, not the gate. A never-subscribed tenant is redirected to
  // /pricing before this page renders (src/lib/billing-gate.ts), so today this
  // is always true here. It is passed anyway because the cards should be
  // correct on their own terms: the day /billing is added to the exemption
  // list, nothing here has to be remembered.
  const subscribed = billing ? !billing.needsPlanSelection : true;

  return (
    <BillingPageClient
      locale={locale}
      currentPlan={membership?.tenant.planType ?? null}
      subscribed={subscribed}
      credits={credits}
      creditHistory={history}
    />
  );
}
