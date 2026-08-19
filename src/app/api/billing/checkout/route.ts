// POST /api/billing/checkout — create a Stripe Checkout Session.
//
// ONE FLOW: an account always exists first.
//
// The funnel is pricing card -> register -> checkout -> Stripe. By the time
// this route runs there is a signed-in tenant, so every session it creates
// carries client_reference_id (the tenant id) and metadata.flow="upgrade", and
// the webhook activates a tenant that is already there.
//
// THIS REVERSES THE CHECKOUT-FIRST INVERSION (345395c). Anonymous callers get
// a 401 again rather than a guest Checkout Session: there is no longer a path
// on which Stripe collects an email and the webhook provisions an account from
// a completed session. metadata.flow is still stamped on every session — the
// webhook and /welcome both read it, and credit_pack (stamped by the credits
// route, never reached here) still shares the field — but "upgrade" is now the
// only value this route can produce.
//
// THE 401 IS DELIBERATE, AND ITS SHAPE MATTERS. It carries tier and interval
// back so the pricing card can send the visitor to
// /register?plan=&interval=&checkout=1 and resume the very checkout they
// clicked. Leaving it to the proxy to redirect would not work: a redirect to
// /login is followed by fetch() and arrives as HTML with status 200, which the
// caller cannot distinguish from success, so the button would appear to do
// nothing. That is also why /api/billing/checkout sits in the proxy's
// publicExactPaths — so it can REFUSE anonymous callers itself.
//
// CONSENT MUST SURVIVE THE ROUND TRIP. The gate below runs BEFORE the auth
// branch, so the resumed call made from the register form after signup has to
// carry the consent the visitor gave on /pricing. If it does not, this route
// answers 400 consent_required, the register form falls through to its normal
// redirect, and a brand-new paying customer is silently dropped on a dashboard
// with no subscription. See register-form.tsx, which carries it through
// sessionStorage.
//
// THE CARD IS ALWAYS COLLECTED. Stripe's defaults do that, so this route
// deliberately sets neither payment_method_collection nor trial_settings:
// naming either one is what switches the trial to card-optional.
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
import {
  isWatcherLookupKey,
  watcherCheckoutBlock,
} from "@/lib/ai-monitor/watcher-entitlement";
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

  // CONSENT GATE — ABOVE THE AUTH BRANCH, AND THAT POSITION IS LOAD-BEARING.
  //
  // It applies to every caller of this route, signed in or not, present and
  // future: a check inside one branch is a check the other branch forgets.
  //
  // THE CONSEQUENCE IS THE FUNNEL'S SHARPEST EDGE. The register form's resumed
  // call arrives here after a full-page navigation, so it must carry the
  // consent given on /pricing — see src/lib/checkout-consent.ts. Without it
  // this returns 400 and a brand-new customer is dropped on a dashboard with
  // no subscription, silently at both ends. tests/checkout-funnel.test.ts pins
  // the ordering by asserting that an anonymous caller with no consent gets
  // consent_required rather than unauthenticated.
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

  // Who is asking. ANONYMOUS IS AN ERROR AGAIN — see the header. The 401 body
  // carries the plan back so the caller can resume it after registration
  // instead of making the visitor pick a plan a second time.
  //
  // A THROWN session lookup is treated as anonymous rather than as a 500. The
  // honest answer either way is "we do not know who you are", and answering
  // 401 gives the client a path forward (register, then resume) where a 500
  // gives it a dead end.
  const unauthenticated = () =>
    NextResponse.json(
      { error: "Sign in required.", reason: "unauthenticated", tier, interval },
      { status: 401 },
    );

  let tenantId: string;
  let customerId: string | null = null;
  let customerEmail: string | null = null;
  let userId: string | null = null;
  try {
    const [membership, session] = await Promise.all([getCurrentTenant(), auth()]);
    if (!membership) return unauthenticated();
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
    return unauthenticated();
  }

  // Stamped on every session this route creates. credit_pack comes from the
  // credits route and never reaches here; guest_signup no longer exists.
  const flow = "upgrade";

  const lookupKey = checkoutLookupKey(tier, interval);

  // The watcher's own gate. It no longer needs an anonymous branch — the 401
  // above covers every tier now — but the entitlement check is unchanged: its
  // question is "does this tenant's plan already include the watcher?", which
  // is why the SKU always required an existing tenant even when other tiers
  // did not.
  if (isWatcherLookupKey(lookupKey)) {
    // A tenant on a plan cannot buy the standalone watcher. Server-side because
    // hiding the button leaves the endpoint open, and the failure mode is a
    // customer paying twice for one capability — the plan row is the single
    // subscription row, so the purchase would also overwrite it.
    const existing = await prisma.subscription.findUnique({
      where: { tenantId },
      select: { productKind: true, status: true },
    });
    const guard = watcherCheckoutBlock(
      existing
        ? {
            productKind: existing.productKind,
            active: existing.status === "ACTIVE" || existing.status === "TRIALING",
          }
        : null,
    );
    if (guard.blocked) {
      return NextResponse.json({ error: guard.reason, reason: "plan_includes_watcher" }, { status: 400 });
    }
  }
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
  // Consent rides in the session metadata as well as the ConsentEvent row —
  // belt and braces, so the acceptance is recoverable from Stripe alone if the
  // row written below never landed.
  //
  // `flow` is stamped here rather than derived downstream. The webhook dispatch
  // and /welcome both read it, and a session whose flow has to be guessed from
  // the absence of client_reference_id is a session that guesses wrong for
  // anything Stripe did not create through this route.
  const metadata = {
    app: "echorank",
    flow,
    tier,
    // THE TENANT ID, ON THE SUBSCRIPTION ITSELF — NOT ONLY ON THE SESSION.
    //
    // client_reference_id below already tells checkout.session.completed which
    // tenant this is. It does NOT help customer.subscription.created, which
    // receives a Subscription object and had only one way to find a tenant:
    // matching stripeCustomerId. That column is written BY the checkout handler,
    // so the subscription handler depended on the other event having landed
    // first — and Stripe does not guarantee event order. When `created` won the
    // race it found no tenant, warned, returned 200, and Stripe never retried
    // (200 means handled), so the Subscription row was permanently absent for a
    // customer who had just paid. Observed 2026-08-19: `created` at
    // 08:33:45.453, `completed` at 08:33:45.753 — 300ms apart, wrong way round.
    //
    // Because this rides in subscription_data.metadata, Stripe copies it onto
    // the Subscription, where it persists for the life of that subscription and
    // is present on every later `updated` event too. The handler can then
    // resolve the tenant from the event it is actually holding, which removes
    // the ordering dependency rather than racing it.
    tenantId,
    interval,
    // Kept for the success/cancel urls and for support: the tenant already
    // carries a defaultLanguage, so nothing downstream provisions from this.
    locale: loc,
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
      // client_reference_id is how the webhook links a session to a tenant that
      // has no Stripe customer yet — which is every tenant until its first
      // completed checkout, so without this the very first activation never
      // finds its tenant. Unconditional now: this route has no anonymous path.
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
    //
    // tenantId is always set here now; ConsentEvent's columns stay nullable
    // because the credits route and the retired guest path both wrote rows
    // without one, and narrowing them would be a migration over existing
    // compliance records for no gain.
    //
    // A failure here must NOT fail the checkout: the buyer has a valid session
    // and the metadata above still carries the consent, so losing the row is a
    // compliance-log gap to alert on, not a reason to refuse a paying customer.
    // The webhook upserts rather than updates for exactly this reason.
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
          flow,
          consentedAt: consentPayload.timestamp ? new Date(consentPayload.timestamp) : null,
        },
      });
    } catch (err) {
      log.error({ err, sessionId: session.id, tenantId, flow }, "ConsentEvent write failed");
    }

    log.info({ tier, interval, tenantId, flow, sessionId: session.id }, "Checkout session created");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    log.error({ err, tier, interval }, "Stripe checkout session creation failed");
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
