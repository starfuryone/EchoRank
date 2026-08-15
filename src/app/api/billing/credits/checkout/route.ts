// POST /api/billing/credits/checkout — buy a prepaid lookup pack.
//
// ── WHY THIS IS NOT ../checkout/route.ts ────────────────────────────────────
// That route is subscription-shaped at four levels and every one of them would
// have had to grow a branch: `mode: "subscription"` is hardcoded,
// `subscription_data.trial_period_days` is attached unconditionally, `tier` and
// `interval` are validated against the plan union before anything else runs,
// and the price comes out of the `echorank_<tier>_usd_<interval>` template,
// which a pack key does not fit. Four branches through one function, each one a
// chance for a one-time purchase to pick up subscription behaviour. A separate
// route with one mode is the smaller thing to keep correct.
//
// What IS shared, deliberately: getStripe(), resolve-the-price-live-by-lookup-key
// (this app never hardcodes a price id and never creates a price), the
// `client_reference_id = tenantId` stamp the webhook needs to find a tenant, and
// the `metadata.app = "echorank"` stamp the shared live account requires.
//
// ── CONSENT: no gate, but a log ─────────────────────────────────────────────
// No ConsentGate and no modal — this is a one-time payment rather than a
// subscription or a plan change, and the buy buttons carry a terms/privacy line
// instead. But §8.1 reads "before starting a trial or completing ANY purchase
// or plan change", and a literal reading covers this, so a ConsentEvent row IS
// written below recording what the buyer was shown. That satisfies the clause's
// wording at zero friction, and means nobody has to relitigate whether §8.1 is
// scoped to the subscription relationship it otherwise governs.
//
// If a gate is ever wanted after all, it is checkConsent() from
// ../../checkout/route.ts and it drops in above the auth branch.
//
// ── NO PLAN GATE, ON PURPOSE ────────────────────────────────────────────────
// Credits are spent by the Opportunity Scanner, which is AGENCY+. A sub-AGENCY
// tenant can still buy them, and both /credits and the confirm step say plainly
// that the lookups need an AGENCY plan to spend. Taking the money while hiding
// that would be the problem; refusing a customer who is about to upgrade is
// merely unhelpful. Money accepted, never misleading.

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { logger } from "@/infrastructure/observability/logger";
import { SITE_URL, normalizeLocale } from "@/lib/seo";
import { creditPackLookupKey, packForCredits } from "@/lib/credit-packs";
import { CONSENT_VERSION } from "@/lib/consent-config";

const log = logger.child({ module: "credits-checkout" });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { credits, locale } = (body ?? {}) as { credits?: unknown; locale?: unknown };

  // The pack is resolved from OUR catalogue, never taken at face value. A
  // caller asking for 999,999 credits gets a 400, not a session — the price is
  // whatever this pack says it is, and an unknown size has no price.
  const size = typeof credits === "number" ? credits : Number.parseInt(String(credits), 10);
  const pack = Number.isFinite(size) ? packForCredits(size) : null;
  if (!pack) {
    return NextResponse.json({ error: "Unknown credit pack." }, { status: 400 });
  }

  // Auth gate. 401 carries the pack back so the client can build the
  // /login?next=/credits link and resume after sign-in.
  let tenantId: string;
  let customerId: string | null = null;
  let customerEmail: string | null = null;
  // §8.2 names the user id as part of a consent record; the tenant id alone
  // cannot say who clicked.
  let userId: string | null = null;
  try {
    const [membership, session] = await Promise.all([getCurrentTenant(), auth()]);
    if (!membership) {
      return NextResponse.json(
        { error: "Sign in required.", reason: "unauthenticated", credits: pack.credits },
        { status: 401 },
      );
    }
    tenantId = membership.tenant.id;
    customerId = membership.tenant.stripeCustomerId ?? null;
    customerEmail = session?.user?.email ?? null;
    userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  } catch {
    log.warn("Session lookup failed during credit checkout");
    return NextResponse.json(
      { error: "Sign in required.", reason: "unauthenticated", credits: pack.credits },
      { status: 401 },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    log.error("STRIPE_SECRET_KEY is not configured");
    return NextResponse.json({ error: "Billing is not configured." }, { status: 500 });
  }

  const lookupKey = creditPackLookupKey(pack.credits);

  // Resolved live. A missing key means the catalogue and this code disagree —
  // most likely scripts/seed-credit-packs.ts has not been run in this mode —
  // and that is a 404 rather than a silent fall back to some other price.
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const price = prices.data[0];
  if (!price) {
    log.error({ lookupKey }, "No active Stripe price for credit pack lookup key");
    return NextResponse.json({ error: "That pack is not available." }, { status: 404 });
  }

  const loc = normalizeLocale(typeof locale === "string" ? locale : "en");
  const base = `${SITE_URL}/${loc}`;

  // `flow` is what the webhook branches on, and it is the reason this metadata
  // exists at all: without it handleCheckoutCompleted treats a session with no
  // subscription as a plan activation and sets billingStatus = "ACTIVE".
  //
  // `credits` rides along as a hint for logging only. The webhook resolves the
  // real number from the price's lookup key, because metadata is caller-supplied
  // and a session's metadata is not proof of what was paid for.
  const metadata = {
    app: "echorank",
    flow: "credit_pack",
    credits: String(pack.credits),
    tenantId,
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: price.id, quantity: 1 }],
      metadata,
      // Same mechanism the plan checkout relies on: the webhook resolves the
      // tenant from here, because a tenant buying its first thing has no Stripe
      // customer id yet.
      client_reference_id: tenantId,
      ...(customerId
        ? { customer: customerId }
        : customerEmail
          ? { customer_email: customerEmail }
          : {}),
      success_url: `${base}/credits?purchased={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/credits`,
    });

    if (!session.url) {
      log.error({ sessionId: session.id }, "Credit checkout session created without a url");
      return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
    }

    // ── The compliance log, without the gate ────────────────────────────────
    //
    // §8.1 says consent is required before "any purchase or plan change", and a
    // literal reading covers a one-time pack. The product decision was that a
    // modal does not belong on a one-time payment — so this records WHAT the
    // buyer was shown, with no gate and no friction, and the argument about the
    // clause stops being one worth having.
    //
    // TWO DOCUMENTS, NOT FOUR. The plan checkout records all of
    // CONSENT_DOCUMENT_IDS because its modal presents all four. This page shows
    // Terms and Privacy under the buy buttons and nothing else, so recording
    // the Subscription Agreement here would assert the buyer was shown
    // something they were not — which is worse than a thinner log.
    //
    // consentedAt is NULL, deliberately: the column is documented as the
    // client-supplied moment of the click, and there is no client payload here
    // to supply one. `createdAt` carries the server's own timestamp, and the
    // two would differ by network latency anyway since this row is written in
    // the same request the click made.
    //
    // A FAILURE HERE MUST NOT FAIL THE CHECKOUT. The buyer has a valid session;
    // losing this row is a compliance-log gap to alert on, not a reason to
    // refuse a paying customer. Same rule the plan route states.
    try {
      await prisma.consentEvent.create({
        data: {
          tenantId,
          userId,
          email: customerEmail,
          // Unique, so a retried request cannot write a second row for one act.
          stripeSessionId: session.id,
          version: CONSENT_VERSION,
          documents: ["terms", "privacy"],
          // `plan` is non-null and means "what was bought". Naming the pack is
          // more use to an auditor than a bare "credits".
          plan: `credits_${pack.credits}`,
          // Non-null too. A one-time payment has no interval and saying so is
          // better than an empty string that reads as a missing value.
          interval: "one_time",
          flow: "credit_pack",
          consentedAt: null,
        },
      });
    } catch (err) {
      log.error({ err, sessionId: session.id, tenantId }, "ConsentEvent write failed");
    }

    log.info(
      { tenantId, credits: pack.credits, sessionId: session.id },
      "Credit pack checkout session created",
    );
    return NextResponse.json({ url: session.url });
  } catch (err) {
    log.error({ err, credits: pack.credits }, "Credit checkout session creation failed");
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
