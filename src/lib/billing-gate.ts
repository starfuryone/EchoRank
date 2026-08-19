// Where a tenant that has never subscribed is allowed to go.
//
// ── WHY THIS IS NOT IN src/proxy.ts ─────────────────────────────────────────
//
// The obvious home for "redirect this user" is the middleware, and it is the
// wrong one here. proxy.ts runs `auth()` on the edge, and src/lib/auth.ts puts
// exactly one thing in the JWT — `token.id`. There is no tenant on the token
// and no billing status, so the middleware would have to either:
//
//   • query Prisma from the edge runtime, which is not available there, or
//   • denormalise billingStatus into the session token, which then goes STALE
//     for the life of that token — and the tenant whose status just changed is,
//     by definition, the customer who has this second paid us. Bouncing a
//     paying customer back to /pricing until they sign out again is a worse
//     failure than anything this gate prevents.
//
// So enforcement lives on the server, in the layer that already reads the
// authoritative row per request: getBillingContext() in src/lib/paid-plan.ts.
// The gate and requirePaidPlan therefore cannot disagree — they are one query.
// The proxy keeps doing what it does today: authentication, never entitlement.
//
// ── THE EXEMPTIONS ARE THE INTERESTING PART ─────────────────────────────────
//
// A NONE tenant is a real, signed-in user of ours who simply has not bought
// anything. Locking them out of everything is how you strand someone who wants
// to close their account, or who needs to see what account they are even signed
// in as. Everything they can reach is listed below with the reason.
//
// Note what is NOT in this file: /pricing, /login, /register, /welcome, the
// NextAuth routes and /api/billing/checkout all live OUTSIDE the (dashboard)
// route group, so this gate never runs for them. That is also what keeps the
// redirect from looping — the destination is not a path this list has to
// exempt, because the gate has no opinion about it at all.

/**
 * Paths inside the (dashboard) group a NONE tenant may still reach.
 * Matched as prefixes against the pathname the proxy stamps on `x-pathname`.
 */
export const NONE_ALLOWED_DASHBOARD_PREFIXES: readonly string[] = [
  // Profile, workspace name, and the plan/billing-status readout that explains
  // WHY everything else redirected. A user who cannot see their own account
  // cannot act on it: cancelling and deleting both start from knowing what you
  // have. (Account erasure itself is POST /api/compliance/erase, an API route
  // this gate does not govern, so it stays reachable regardless.)
  "/settings/account",
] as const;

/**
 * Does this (dashboard) path stay open to a tenant with no subscription?
 *
 * Prefix matching, but only on a path BOUNDARY: "/settings/accountant" must not
 * inherit "/settings/account"'s exemption. Cheap to get wrong and invisible
 * when you do, which is why it is a function rather than a `.startsWith()` at
 * the call site.
 */
export function isNoneAllowedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return NONE_ALLOWED_DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
