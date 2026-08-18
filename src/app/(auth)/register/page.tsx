// /register is no longer a front door.
//
// THE FUNNEL IS CHECKOUT-FIRST NOW: a visitor picks a plan on /pricing, enters
// a card at Stripe, and the webhook provisions the account. There is no longer
// such a thing as "make an account, decide later" — that state has no plan, no
// card and no trial, and every CTA that used to produce it now leads to
// /pricing instead. Bare /register therefore redirects there rather than
// rendering a form that creates an account the rest of the product cannot
// place. The plan-less "Create account" button on /pricing was deleted in the
// same commit, along with the test that used to require it.
//
// TWO EXEMPTIONS, BOTH REAL AND BOTH STILL LIVE:
//
//   ?invite=…  a team invitation. It is not a signup funnel at all — the User
//              row and the TenantMember already exist (see /api/team), and the
//              invitee is completing an account somebody else created. Sending
//              it to /pricing would ask a colleague to buy a second plan.
//   ?plan=…    the standalone Watcher's 401 fallback. /api/billing/checkout
//              still refuses that SKU to anonymous callers — it is an
//              entitlement gated on a tenant that already exists, not a tier —
//              so /watcher's card still needs somewhere to send a buyer.

import { redirect } from "next/navigation";
import { AUTH_CONTENT } from "@/lib/i18n/auth-content";
import { resolveRequestLocale } from "@/lib/i18n/resolve-request-locale";
import RegisterForm from "./register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    plan?: string;
    brand?: string;
    interval?: string;
    checkout?: string;
    invite?: string;
  }>;
}) {
  const locale = await resolveRequestLocale();
  const { plan, brand, interval, checkout, invite } = await searchParams;

  // Locale-prefixed so the proxy does not have to 308 a second time.
  if (!plan && !invite) redirect(`/${locale}/pricing`);

  return <RegisterForm
      c={AUTH_CONTENT[locale].register}
      plan={plan}
      brand={brand}
      locale={locale}
      interval={interval}
      resumeCheckout={checkout === "1"}
    />;
}
