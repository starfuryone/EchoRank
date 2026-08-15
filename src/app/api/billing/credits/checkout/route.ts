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
// ── CONSENT ─────────────────────────────────────────────────────────────────
// No ConsentGate here, by explicit product decision: this is a one-time payment
// rather than a subscription or a plan change, and the buy buttons carry a
// terms/privacy line instead. Recorded because it is a judgement call and
// §8.1 of the Subscription Agreement reads "before starting a trial or
// completing ANY purchase or plan change" — a literal reading covers this. The
// decision was to treat §8.1 as scoped to the subscription relationship it
// governs. If that is revisited, the gate is checkConsent() from
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
import { getCurrentTenant } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { logger } from "@/infrastructure/observability/logger";
import { SITE_URL, normalizeLocale } from "@/lib/seo";
import { creditPackLookupKey, packForCredits } from "@/lib/credit-packs";

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
