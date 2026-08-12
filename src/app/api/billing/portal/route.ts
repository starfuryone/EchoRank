// POST /api/billing/portal — open the Stripe Billing Portal.
//
// REQUIRED BY THE SUBSCRIPTION AGREEMENT, which tells subscribers they can
// cancel through Stripe's portal. Until this route existed there was no portal
// code in the app at all, so that promise had no implementation behind it.
//
// NO PRODUCT-KIND BRANCHING. The portal manages whatever subscription the
// customer holds — a plan, the standalone watcher, whatever they hold next —
// because it is Stripe's UI over Stripe's own customer record, not ours over
// our Subscription row. A `productKind === "WATCHER"` branch here would be a
// second place that has to learn about every future SKU, and it would be wrong
// the moment a customer holds something this app has not been taught about.
//
// CANCELLATION SEMANTICS ARE CONFIG, NOT CODE. Cancel-at-period-end lives in
// the portal CONFIGURATION in Stripe (see scripts/seed-portal-config.ts), not
// in a flag here. Encoding it in code would mean the button and the portal
// could disagree, and the portal is what the customer actually operates.
//
// Auth matches /api/billing/checkout exactly: a POST carrying the session
// cookie, no separate CSRF token, 401 for an anonymous caller. It is a POST
// rather than a GET because it creates a Stripe object and because a GET would
// be prefetchable — a link the browser warms would mint portal sessions nobody
// asked for.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { getCurrentTenant } from "@/lib/tenant";
import { logger } from "@/infrastructure/observability/logger";
import { SITE_URL } from "@/lib/seo";

const log = logger.child({ module: "billing-portal" });

export async function POST() {
  let tenantId: string;
  let customerId: string | null;
  try {
    const membership = await getCurrentTenant();
    if (!membership) {
      return NextResponse.json(
        { error: "Sign in required.", reason: "unauthenticated" },
        { status: 401 },
      );
    }
    tenantId = membership.tenant.id;
    customerId = membership.tenant.stripeCustomerId ?? null;
  } catch {
    log.warn("Session lookup failed during portal open");
    return NextResponse.json(
      { error: "Sign in required.", reason: "unauthenticated" },
      { status: 401 },
    );
  }

  // No Stripe customer means this tenant has never completed a checkout, so
  // there is no billing relationship for the portal to show. 400 rather than
  // 404: the request is well-formed and the tenant is real, it just has
  // nothing to manage. The UI should not offer the button in this state, and
  // this is the server-side half of that.
  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account yet.", reason: "no_customer" },
      { status: 400 },
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      // Back to the dashboard's billing page — the surface that sent them and
      // the one that reflects whatever they just changed.
      return_url: `${SITE_URL}/billing`,
    });
    log.info({ tenantId, sessionId: session.id }, "Billing portal session created");
    // The URL, not a 30x. A fetch() caller follows a redirect transparently and
    // receives Stripe's HTML with a 200, which it cannot distinguish from its
    // own success — the same trap the checkout route documents for its 401.
    // The client navigates with this, exactly as it does for checkout.
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // The most likely cause in a fresh account is an unconfigured portal:
    // Stripe rejects the create until a configuration exists, which is a
    // deploy-time setup fault rather than anything the caller did.
    log.error({ err, tenantId }, "Stripe billing portal session creation failed");
    return NextResponse.json({ error: "Could not open the billing portal." }, { status: 502 });
  }
}
