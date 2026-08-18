// src/lib/billing/guest-signup.ts
//
// What a completed GUEST checkout does: build the account the buyer does not
// have yet, out of a Stripe session and nothing else.
//
// ── WHY THIS IS NOT IN THE ROUTE FILE ───────────────────────────────────────
// Same reason as credit-webhook.ts: Next's App Router validates the export
// surface of a `route.ts`, so exporting a handler beside POST fails the build.
// Keeping the logic here also keeps the route's three-way dispatch small enough
// to review at a glance, which is the point of the ordering below.
//
// ── THE DISPATCH ORDER IS A SAFETY PROPERTY, NOT A STYLE CHOICE ─────────────
// handleCheckoutCompleted decides whether to activate a tenant with:
//
//     if (subscriptionId ? productKind === "PLAN" : true)
//
// and reaches that line with a tenant it found by client_reference_id. A guest
// session has NO client_reference_id, so it would fall through to the
// "no tenant to attach" warning and provision nothing at all — the buyer pays
// and gets no account. This branch therefore returns before that code, exactly
// as the credit branch does, and for the mirror-image reason: credit_pack must
// not reach the ternary because it would wrongly activate, guest_signup must
// not reach it because it would wrongly do nothing.
//
// ── IDEMPOTENCY: THREE LAYERS, AND THE MIDDLE ONE IS THE INTERESTING ONE ────
// 1. ProcessedWebhook.stripeEventId makes a re-delivered event a no-op. But the
//    dispatcher DELETES that marker when a handler throws, so Stripe's retry
//    re-runs — which is precisely the window a half-built account could be
//    built twice.
// 2. ConsentEvent.stripeSessionId is UNIQUE and is written INSIDE the same
//    transaction as the user, tenant, membership and subscription. So the row
//    set is atomic: either the session has a ConsentEvent carrying a tenantId
//    and everything else exists, or none of it does. That single field is the
//    "already provisioned" answer, and it cannot lie.
// 3. User.email is UNIQUE underneath both. Two deliveries racing past step 2
//    both try to create the same user; the database picks one, the loser's
//    whole transaction rolls back, and the P2002 is resolved by re-reading
//    step 2 rather than by throwing — a unique-constraint 500 handed back to
//    Stripe is a retry storm over work that already succeeded.
//
// ── AN EXISTING ACCOUNT THAT CHECKS OUT AS A GUEST GETS A SECOND TENANT ─────
// Not a second user. TenantMember is many-to-many and the buyer has paid for a
// plan, so refusing to provision would take their money and give them nothing.
// They cannot set a password through /welcome — the password-set path requires
// passwordHash to still be NULL — so they log in with the credentials they
// already have and switch tenants. That is the correct outcome, and it falls
// out of the natural keys rather than needing a special case.

import "server-only";

import type Stripe from "stripe";
import type { PlanType, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe/client";
import { logger } from "@/infrastructure/observability/logger";
import { productKindFor } from "@/lib/ai-monitor/watcher-entitlement";
import { planTypeForLookupKey } from "@/lib/stripe/lookup-keys";
import { resolvePlanFromPriceId } from "@/lib/stripe/prices";
import { planQuotaDefaults } from "@/lib/plan-config";
import { slugify } from "@/lib/tenant";

const log = logger.child({ module: "guest-signup" });

/** The metadata value this module owns. One string, stamped at checkout. */
export const GUEST_SIGNUP_FLOW = "guest_signup";

/** True for a session this module owns. The route branches on it. */
export function isGuestSignupSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.flow === GUEST_SIGNUP_FLOW;
}

/** The same mapping the subscription handler uses, kept in one place. */
function mapStripeStatus(status: string): "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING" {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "CANCELED";
    default:
      // Never ACTIVE by default — PAST_DUE is the access-denying state, and it
      // is what src/app/api/webhooks/route.ts documents for the same reason.
      return "PAST_DUE";
  }
}

/**
 * A tenant name and slug for someone who never typed a business name.
 *
 * The slug suffix is derived from the session id rather than randomly, so a
 * retry after a partial failure computes the SAME slug and collides with its
 * own earlier attempt instead of quietly creating a second tenant.
 */
function tenantNameFor(session: Stripe.Checkout.Session, email: string): string {
  const given = session.customer_details?.name?.trim();
  if (given) return given.slice(0, 200);
  return email.split("@")[0].slice(0, 200);
}

async function uniqueSlug(
  tx: Prisma.TransactionClient,
  base: string,
  sessionId: string,
): Promise<string> {
  const root = slugify(base) || "workspace";
  if (!(await tx.tenant.findUnique({ where: { slug: root }, select: { id: true } }))) {
    return root;
  }
  return `${root}-${sessionId.slice(-8).toLowerCase()}`;
}

/** P2002 — a unique constraint refused the write. */
function isUniqueViolation(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

export async function handleGuestSignupCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  // Stripe's own collected address is authoritative. customer_email is only a
  // pre-fill and is null on this flow by construction, but it is read as a
  // fallback rather than assumed absent.
  const email = (session.customer_details?.email ?? session.customer_email ?? "")
    .toLowerCase()
    .trim();
  if (!email) {
    // Nothing can be provisioned without one, and inventing a placeholder would
    // create an account nobody can ever log into.
    log.error({ sessionId: session.id }, "guest signup session carries no email — cannot provision");
    return;
  }

  // Layer 2, read first. A tenantId on this session's ConsentEvent means the
  // whole transaction below already committed.
  const already = await prisma.consentEvent.findUnique({
    where: { stripeSessionId: session.id },
    select: { tenantId: true },
  });
  if (already?.tenantId) {
    log.info(
      { sessionId: session.id, tenantId: already.tenantId },
      "guest signup already provisioned — replay ignored",
    );
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!subscriptionId) {
    // A guest_signup session is created in mode=subscription. One without a
    // subscription is not something this branch can turn into a plan, and
    // guessing a tier would hand out whatever it guessed.
    log.error(
      { sessionId: session.id, email },
      "guest signup session has no subscription — nothing provisioned",
    );
    return;
  }

  // Thrown, not swallowed: the dispatcher rolls the idempotency marker back and
  // Stripe retries. A network blip must not cost the buyer the account they
  // just paid for.
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  const item = subscription.items?.data?.[0];
  const price = item?.price as { id?: string; lookup_key?: string | null } | undefined;
  const lookupKey = price?.lookup_key;

  // The tier comes from OUR lookup key, not from the session metadata: metadata
  // is set by whoever created the session, the lookup key is the price Stripe
  // actually charged. Same argument credit-webhook.ts makes for its pack size.
  if (productKindFor(lookupKey) !== "PLAN") {
    log.error(
      { sessionId: session.id, email, lookupKey },
      "guest signup for a non-plan product — nothing provisioned",
    );
    return;
  }
  const planType: PlanType | null =
    planTypeForLookupKey(lookupKey) ??
    (price?.id ? (await resolvePlanFromPriceId(price.id))?.planType ?? null : null);
  if (!planType) {
    log.error(
      { sessionId: session.id, email, lookupKey, priceId: price?.id },
      "guest signup for a price that maps to no plan — nothing provisioned",
    );
    return;
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const status = mapStripeStatus(subscription.status);
  const periodStart = item?.current_period_start
    ? new Date(item.current_period_start * 1000)
    : null;
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;

  // Consent, as the checkout route stamped it. Read from the session so this
  // handler can rebuild the row from scratch if the checkout-time write failed —
  // the metadata is the carrier of last resort, which is why it is written at
  // all on a flow that also writes a row.
  const md = session.metadata ?? {};
  const consentDocs = String(md.consent_docs ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  const consentedAt = md.consent_ts ? new Date(md.consent_ts) : null;
  const locale = typeof md.locale === "string" ? md.locale : "en";

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Reuse an existing account rather than failing: see the header note on
      // what a second tenant means here.
      let user = await tx.user.findUnique({ where: { email }, select: { id: true } });
      const reusedUser = !!user;
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            name: session.customer_details?.name?.trim() || null,
            // NULL until /welcome. This is also the single-use marker for the
            // session id: the password can only be set while it is null.
            passwordHash: null,
            // §8.2 — the acceptance is recorded on the account it created.
            termsAcceptedAt: consentedAt ?? new Date(),
          },
          select: { id: true },
        });
      }

      const name = tenantNameFor(session, email);
      const tenant = await tx.tenant.create({
        data: {
          name,
          slug: await uniqueSlug(tx, name, session.id),
          planType,
          billingStatus: status,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          defaultLanguage: locale.startsWith("fr") ? "fr" : "en",
        },
        select: { id: true },
      });

      await tx.tenantMember.create({
        data: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
      });

      // Metered from day one, exactly as /api/auth/register does it. A tenant
      // with no quota row is a tenant the enforcer cannot bound.
      await tx.tenantQuota.create({
        data: { tenantId: tenant.id, ...planQuotaDefaults(planType) },
      });

      // THE ROW requirePaidPlan LOOKS FOR. TRIALING alone is the Prisma default
      // for every tenant ever created, so it is this row — written only because
      // Stripe said so — that distinguishes a real card-backed trial from the
      // column default. Without it the buyer lands on a paywall.
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planType,
          productKind: "PLAN",
          status,
          stripeSubscriptionId: subscription.id,
          stripePriceId: price?.id ?? undefined,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });

      // Backfill the row written at checkout with a null tenant/user/email —
      // one act of consent, one row. `upsert` rather than `update` because the
      // checkout-time write is explicitly allowed to fail without failing the
      // checkout, and a missing compliance record is not something to discover
      // during an audit.
      await tx.consentEvent.upsert({
        where: { stripeSessionId: session.id },
        update: { tenantId: tenant.id, userId: user.id, email },
        create: {
          tenantId: tenant.id,
          userId: user.id,
          email,
          stripeSessionId: session.id,
          version: String(md.consent_version ?? ""),
          documents: consentDocs,
          plan: String(md.tier ?? planType.toLowerCase()),
          interval: String(md.interval ?? item?.price?.recurring?.interval ?? "month"),
          flow: GUEST_SIGNUP_FLOW,
          consentedAt,
        },
      });

      return { userId: user.id, tenantId: tenant.id, reusedUser };
    });

    log.info(
      {
        sessionId: session.id,
        tenantId: result.tenantId,
        userId: result.userId,
        planType,
        status,
        reusedUser: result.reusedUser,
      },
      "guest signup provisioned",
    );
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;

    // Layer 3. Re-read layer 2 rather than assuming: a P2002 means SOMETHING
    // was already there, and only the ConsentEvent can say whether it was a
    // concurrent delivery finishing this exact session (fine, stay quiet) or an
    // unrelated collision (not fine — rethrow so Stripe retries and an operator
    // sees it).
    const settled = await prisma.consentEvent.findUnique({
      where: { stripeSessionId: session.id },
      select: { tenantId: true },
    });
    if (settled?.tenantId) {
      log.info(
        { sessionId: session.id, tenantId: settled.tenantId },
        "guest signup lost the provisioning race — the winner's account stands",
      );
      return;
    }
    log.error(
      { err, sessionId: session.id, email },
      "guest signup hit a unique constraint that was not this session's own",
    );
    throw err;
  }
}
