// Carrying a checkout consent across the registration hop.
//
// THE PROBLEM THIS EXISTS FOR. /api/billing/checkout validates consent BEFORE
// its auth branch (a165a4f), so the call the register form makes after signing
// a new user in has to present the same consent the visitor gave on /pricing.
// Without it that call answers 400 consent_required, the form falls through to
// its ordinary redirect, and someone who just typed their details and clicked a
// plan lands on a page with no subscription and no explanation. The failure is
// silent on both sides, which is what makes it worth a module of its own.
//
// WHY sessionStorage AND NOT THE URL. The payload carries a timestamp, a
// version and the document list — none of it secret, but all of it noise that
// would end up in access logs, in the Referer sent to Stripe, and in any
// bookmark or shared link of the register page. sessionStorage is scoped to the
// tab making the journey, dies with it, and survives the one full-page
// navigation (/pricing -> /register) that the flow actually performs.
//
// IT IS NOT AN AUTHORIZATION TOKEN. The server re-validates every field against
// CONSENT_DOCUMENTS and CONSENT_VERSION; this only moves an answer the visitor
// already gave from one page to the next. A tampered or hand-written value buys
// nothing a caller could not have POSTed directly.
//
// THE TIMESTAMP IS NOT REFRESHED on the way out. It records when the box was
// ticked, which was on /pricing, not when the resumed call happened to fire.
// A consent version bumped mid-journey therefore fails checkConsent's
// stale_version rule and the resume is refused — correct, and the reason
// takeCheckoutConsent's caller must have a fallback rather than assuming.

import type { ConsentPayload } from "@/lib/consent-config";

const KEY = "echorank:checkout-consent";

/** Stash the acceptance before navigating to /register. Never throws: a
 *  browser with storage disabled loses the resume, not the registration. */
export function stashCheckoutConsent(payload: ConsentPayload): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private mode, quota, or storage disabled. The resumed checkout will be
    // refused for missing consent and the caller falls back; nothing breaks.
  }
}

/**
 * Read it back and remove it in one step.
 *
 * SINGLE USE, deliberately. The payload is spent by the checkout it was
 * carried for; leaving it behind would let an unrelated later checkout in the
 * same tab inherit an acceptance the visitor gave for a different purchase.
 * Returns null when there is nothing valid to resume with.
 */
export function takeCheckoutConsent(): ConsentPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    // Shape check only. The server does the real validation; this just avoids
    // sending obvious rubbish and calling it a consent.
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as ConsentPayload).accepted === true &&
      typeof (parsed as ConsentPayload).version === "string" &&
      Array.isArray((parsed as ConsentPayload).documents)
    ) {
      return parsed as ConsentPayload;
    }
    return null;
  } catch {
    return null;
  }
}
