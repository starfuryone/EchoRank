// POST /api/billing/checkout — create a Stripe Checkout Session.
//
// AUTHENTICATION IS REQUIRED. An anonymous caller gets 401 and the client
// sends them to /register?plan=…, which resumes checkout once the account
// exists. The 401 is deliberate rather than leaving the proxy to redirect:
// a redirect to /login is followed by fetch() and arrives as HTML with a 200,
// which the caller cannot distinguish from success.
//
// Every session is stamped with client_reference_id (tenantId) — that is what
// lets the webhook find a tenant that has no Stripe customer yet, which is
// every tenant until its first checkout completes.
//
// The card is collected up front. Stripe's defaults do that, so this route
// deliberately sets neither payment_method_collection nor trial_settings:
// naming them is what switches the trial to card-optional.
//
// Prices are NOT defined here. The eight lookup keys already exist in Stripe
// and are resolved live — this app never creates or edits a price, and there
// is deliberately no second hardcoded price list (src/lib/seo/constants.ts
// drifted that way once and is now guarded by tests/seo-jsonld.test.ts).

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/prisma";
import {
  checkoutLookupKey,
  isBillingInterval,
  isCheckoutTier,
} from "@/lib/stripe/lookup-keys";
import { getCurrentTenant } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { logger } from "@/infrastructure/observability/logger";
import { SITE_URL, normalizeLocale } from "@/lib/seo";

const log = logger.child({ module: "billing-checkout" });

/** Trial length. Single source — see TRIAL_DAYS in src/lib/plan-config.ts. */
import { TRIAL_DAYS } from "@/lib/plan-config";
import { CONSENT_VERSION, checkConsent } from "@/lib/consent-config";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { tier, interval, locale, consent } = (body ?? {}) as {
    tier?: unknown;
    interval?: unknown;
    locale?: unknown;
    consent?: unknown;
  };

  // Enterprise is rejected by the type guard as well as by name: it is custom
  // priced, has no lookup key, and must stay a "contact us" conversation.
  if (tier === "enterprise") {
    return NextResponse.json(
      { error: "Enterprise is custom priced. Contact us instead." },
      { status: 400 },
    );
  }
  if (!isCheckoutTier(tier)) {
    return NextResponse.json({ error: "Unknown tier." }, { status: 400 });
  }
  if (!isBillingInterval(interval)) {
    return NextResponse.json({ error: "Interval must be month or year." }, { status: 400 });
  }

  // CONSENT GATE — before the auth branch, deliberately.
  //
  // Placing it here means it applies to every flow through this route, present
  // and future: the logged-in upgrade below, and the guest branch when that
  // lands. A check inside one branch is a check the other branch forgets.
  //
  // §8.1 of the Subscription Agreement requires explicit consent before any
  // purchase or plan change, so a request without it is refused outright rather
  // than defaulted. The client's own gate is a courtesy; this is the rule.
  const consentCheck = checkConsent(consent);
  if (!consentCheck.ok) {
    log.warn(
      { reason: consentCheck.reason, expected: CONSENT_VERSION },
      "checkout refused: consent invalid",
    );
    // One opaque code for every reason. A caller does not need to be told
    // which document it forgot, and the client already knows the full list.
    return NextResponse.json({ error: "consent_required" }, { status: 400 });
  }

  // Auth gate. 401 carries the tier back so the client can build the
  // /register?plan=… link without re-deriving it.
  let tenantId: string;
  let customerId: string | null = null;
  let customerEmail: string | null = null;
  let userId: string | null = null;
  try {
    const [membership, session] = await Promise.all([getCurrentTenant(), auth()]);
    if (!membership) {
      return NextResponse.json(
        { error: "Sign in required.", reason: "unauthenticated", tier, interval },
        { status: 401 },
      );
    }
    tenantId = membership.tenant.id;
    customerId = membership.tenant.stripeCustomerId ?? null;
    // The email comes from the session: getCurrentTenant returns the membership
    // and its tenant, not the user.
    customerEmail = session?.user?.email ?? null;
    // Recorded on the ConsentEvent: §8.2 names the user id as part of a
    // consent record, and the tenant id alone cannot say who clicked.
    userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  } catch {
    log.warn("Session lookup failed during checkout");
    return NextResponse.json(
      { error: "Sign in required.", reason: "unauthenticated", tier, interval },
      { status: 401 },
    );
  }


  const lookupKey = checkoutLookupKey(tier, interval);
  const loc = normalizeLocale(typeof locale === "string" ? locale : "en");

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    // Missing key is a deploy fault, not a client error.
    log.error("STRIPE_SECRET_KEY is not configured");
    return NextResponse.json({ error: "Billing is not configured." }, { status: 500 });
  }

  // Resolve the price live. A missing key means the catalog and the code
  // disagree, which is a 404 rather than a silent fallback to another price.
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const price = prices.data[0];
  if (!price) {
    log.error({ lookupKey }, "No active Stripe price for lookup key");
    return NextResponse.json({ error: "That plan is not available." }, { status: 404 });
  }

  const base = `${SITE_URL}/${loc}`;
  const consentPayload = consent as { timestamp?: string; version?: string; documents?: string[] };
  // Consent rides in the session metadata as well as the ConsentEvent row. On
  // the logged-in path the row is written below and the metadata is belt and
  // braces; when the guest branch lands it is the ONLY carrier, because there
  // is no tenant to attach a row to until the webhook provisions one.
  const metadata = {
    app: "echorank",
    tier,
    interval,
    consent_version: String(consentPayload.version ?? ""),
    consent_ts: String(consentPayload.timestamp ?? ""),
    consent_docs: (consentPayload.documents ?? []).join(","),
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      allow_promotion_codes: true,
      // No payment_method_collection and no trial_settings on purpose: Stripe's
      // defaults collect the card up front and charge automatically when the
      // trial ends. Setting either one is what makes the card optional.
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata,
      },
      metadata,
      // client_reference_id is how the webhook links a session to a tenant
      // that has no Stripe customer yet — which is every tenant today, since
      // no checkout has ever run in this app.
      client_reference_id: tenantId,
      ...(customerId
        ? { customer: customerId }
        : customerEmail
          ? { customer_email: customerEmail }
          : {}),
      success_url: `${base}/welcome?s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}#pricing`,
    });

    if (!session.url) {
      log.error({ sessionId: session.id }, "Checkout session created without a url");
      return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
    }

    // Record the consent now that the session exists, so the row can carry the
    // session id and be deduped against a webhook replay by the unique index.
    // A failure here must NOT fail the checkout: the buyer has a valid session
    // and the metadata above still carries the consent, so losing the row is a
    // compliance-log gap to alert on, not a reason to refuse a paying customer.
    try {
      await prisma.consentEvent.create({
        data: {
          tenantId,
          userId,
          email: customerEmail,
          stripeSessionId: session.id,
          version: CONSENT_VERSION,
          documents: consentPayload.documents ?? [],
          plan: tier,
          interval,
          flow: "upgrade",
          consentedAt: consentPayload.timestamp ? new Date(consentPayload.timestamp) : null,
        },
      });
    } catch (err) {
      log.error({ err, sessionId: session.id, tenantId }, "ConsentEvent write failed");
    }

    log.info({ tier, interval, tenantId, sessionId: session.id }, "Checkout session created");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    log.error({ err, tier, interval }, "Stripe checkout session creation failed");
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
