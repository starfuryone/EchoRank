// POST /api/billing/checkout — create a Stripe Checkout Session.
//
// TWO FLOWS, AND metadata.flow IS WHAT NAMES THEM. Everything downstream —
// the webhook's three-way dispatch, /welcome deciding whether a session id is
// a credential or a display hint — branches on that one string, so it is
// stamped on EVERY session this route creates, never left to be inferred:
//
//   flow=upgrade      a signed-in tenant buying or changing a plan. Carries
//                     client_reference_id (tenantId); the webhook activates
//                     the tenant that already exists.
//   flow=guest_signup nobody is signed in and no account exists yet. Carries
//                     NO client_reference_id — there is no tenant to point at.
//                     Stripe collects the email, and the webhook provisions
//                     user + tenant + membership + subscription from the
//                     completed session. This is the inversion: the card comes
//                     before the account.
//
// A third value, credit_pack, is stamped by the credits route and handled the
// same way; it never reaches here.
//
// ANONYMOUS IS NO LONGER AN ERROR — except for the standalone Watcher. That
// SKU is an add-on to a tenant, priced and gated against an existing
// subscription (watcherCheckoutBlock reads the tenant's Subscription row), and
// there is no tenant to read for a guest. It therefore keeps the old 401, and
// /watcher keeps its /register?plan=watcher_pro&checkout=1 fallback. The 401 is
// deliberate rather than leaving the proxy to redirect: a redirect to /login is
// followed by fetch() and arrives as HTML with a 200, which the caller cannot
// distinguish from success.
//
// THE CARD IS ALWAYS COLLECTED, ON BOTH FLOWS. Stripe's defaults do that, so
// this route deliberately sets neither payment_method_collection nor
// trial_settings: naming either one is what switches the trial to card-optional.
// It matters more on the guest flow than it ever did on the upgrade flow — a
// card-optional guest trial provisions an account for someone who has entered
// nothing, which is a free-account signup wearing a checkout's clothes.
// tests/guest-checkout.test.ts asserts the created session carries neither key.
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

  // Who is asking. A failed session lookup is treated as anonymous rather than
  // as an error: the guest flow is the anonymous flow now, so the fallback is a
  // working checkout instead of a dead end. Nothing below trusts `tenantId`
  // without checking it for null first.
  let tenantId: string | null = null;
  let customerId: string | null = null;
  let customerEmail: string | null = null;
  let userId: string | null = null;
  try {
    const [membership, session] = await Promise.all([getCurrentTenant(), auth()]);
    if (membership) {
      tenantId = membership.tenant.id;
      customerId = membership.tenant.stripeCustomerId ?? null;
      // The email comes from the session: getCurrentTenant returns the membership
      // and its tenant, not the user.
      customerEmail = session?.user?.email ?? null;
      // Recorded on the ConsentEvent: §8.2 names the user id as part of a
      // consent record, and the tenant id alone cannot say who clicked.
      userId = (session?.user as { id?: string } | undefined)?.id ?? null;
    }
  } catch {
    log.warn("Session lookup failed during checkout — continuing as guest");
  }

  const isGuest = tenantId === null;
  const flow = isGuest ? "guest_signup" : "upgrade";

  const lookupKey = checkoutLookupKey(tier, interval);

  // THE WATCHER IS THE ONE TIER A GUEST CANNOT BUY.
  //
  // Its whole gate is a question about a tenant that already exists — "does
  // this tenant's plan already include the watcher?" — and a guest has no
  // tenant to ask about. Provisioning one from a watcher session would also
  // give it no planType to be provisioned WITH: the watcher is an entitlement,
  // not a tier. So it keeps the pre-inversion contract exactly: 401, and
  // /watcher's client sends the buyer to /register?plan=watcher_pro&checkout=1.
  if (isWatcherLookupKey(lookupKey)) {
    // Checked as `tenantId === null` rather than via `isGuest` so the narrowing
    // reaches the findUnique below; they are the same condition.
    if (tenantId === null) {
      return NextResponse.json(
        { error: "Sign in required.", reason: "unauthenticated", tier, interval },
        { status: 401 },
      );
    }
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
  // Consent rides in the session metadata as well as the ConsentEvent row.
  // Belt and braces on the upgrade path; on the guest path the metadata is what
  // lets the webhook rebuild the row from the session alone, if the row written
  // below never landed.
  //
  // `flow` is stamped here rather than derived downstream. The webhook dispatch
  // and /welcome both read it, and a session whose flow has to be guessed from
  // the absence of client_reference_id is a session that guesses wrong for
  // anything Stripe did not create through this route.
  const metadata = {
    app: "echorank",
    flow,
    tier,
    interval,
    // Carried for the guest branch alone: the webhook provisions a tenant for
    // someone who never saw a settings page, and defaultLanguage has to come
    // from somewhere. The upgrade branch's tenant already has one.
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
      // has no Stripe customer yet. A guest has no tenant at all, so the key is
      // OMITTED rather than sent empty — the webhook's upgrade path keys off its
      // presence, and "" would send it looking for a tenant named "".
      //
      // The email is likewise left to Stripe on the guest path. Checkout already
      // collects it, and it is the address the account gets provisioned under,
      // so it must be the one the buyer actually typed on Stripe's page.
      ...(tenantId ? { client_reference_id: tenantId } : {}),
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
    // ON THE GUEST PATH tenantId, userId and email are all NULL here, and that
    // is the case ConsentEvent's columns were made nullable for: the consent
    // happened, provably, before anyone existed to attribute it to. The webhook
    // backfills all three onto THIS row when it provisions the account — same
    // row, found by stripeSessionId — so one act of consent stays one row.
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
