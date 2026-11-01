// /register is a step in the funnel, not a front door.
//
// THE FUNNEL IS pricing card -> register -> Stripe Checkout. A visitor picks a
// plan on /pricing, /api/billing/checkout answers 401 because nobody is signed
// in, and the card sends them here carrying the plan it already chose:
//
//     /register?plan=<tier>&interval=<month|year>&checkout=1
//
// register-form.tsx then registers, signs them in, and immediately creates the
// checkout session for THAT SAME plan — carrying the consent the visitor gave
// on /pricing, without which the checkout route refuses the resumed call. The
// account exists before Stripe is ever contacted.
//
// (This REPLACES the checkout-first inversion that briefly ran here, in which
// the card came first and a webhook provisioned the account from a completed
// session. Guest checkout, webhook provisioning and the session-as-credential
// welcome page are all gone; nothing in this funnel creates an account from a
// payment.)
//
// BARE /register STILL REDIRECTS TO /pricing, for a reason that survived the
// reversal: an account with no plan behind it is a state the product cannot
// place. It has no subscription, no card and no trial — billingStatus NONE —
// so every route it can reach sends it to /pricing anyway. Starting there is
// one hop shorter than starting here and being bounced. The plan-less "Create
// account" button on /pricing stays deleted for the same reason.
//
// TWO EXEMPTIONS, BOTH REAL AND BOTH STILL LIVE:
//
//   ?plan=…    the funnel above, and the standalone Watcher's 401 fallback.
//              /watcher's card sends a buyer to /register?plan=watcher_pro
//              &checkout=1 exactly as the plan cards do.
//   ?invite=…  a team invitation. It is not a signup funnel at all — the User
//              row and the TenantMember already exist (see /api/team), and the
//              invitee is completing an account somebody else created. Sending
//              it to /pricing would ask a colleague to buy a second plan, and
//              an invitee joins an EXISTING tenant, inheriting its billing
//              status rather than minting a NONE one.

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
