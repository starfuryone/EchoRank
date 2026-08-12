/**
 * The four watcher checkout paths, against the Stripe SANDBOX.
 *
 * No running app: the route handlers are functions, so they are called
 * directly, and webhook payloads are signed with the same secret the handler
 * verifies against. Subscriptions are REAL sandbox subscriptions — the point is
 * to exercise the webhook against objects Stripe actually produced, not against
 * a fixture of what we think it produces.
 *
 *   STRIPE_TEST_SECRET_KEY=sk_test_... npx tsx scripts/watcher-e2e.ts
 */
import "dotenv/config";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { WATCHER_LOOKUP_KEYS } from "@/lib/plan-config";

const WEBHOOK_SECRET = "whsec_e2e_local_only";
const SLUG = "watcher-e2e";

function key(): string {
  const k = process.env.STRIPE_TEST_SECRET_KEY?.trim();
  if (!k?.startsWith("sk_test_")) throw new Error("need a sk_test_ key");
  return k;
}

/**
 * POINT THE ROUTE AT THE SANDBOX TOO — not just this harness.
 *
 * The route builds its own client from STRIPE_SECRET_KEY, and `dotenv/config`
 * above loads .env, where that key is `sk_live_`. So until this line existed,
 * every run had the webhook handler calling the LIVE account with sandbox
 * object ids: the earlier logs show `No such subscription` coming back from a
 * `priority-tier: livemode` request, which is also why the trial notice warned
 * on every delivery.
 *
 * It made the results wrong — a checkout handler that now resolves product kind
 * by retrieving the subscription would fail closed on that 404 and never
 * activate anyone — and it pointed a mutating call (the upgrade path cancels
 * the old subscription) at the live account. Both stop here.
 */
process.env.STRIPE_SECRET_KEY = key();
if (!process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  throw new Error("refusing to run: the route would use a non-test key");
}

const stripe = new Stripe(key());
const results: { path: string; ok: boolean; detail: string }[] = [];
function check(path: string, ok: boolean, detail: string) {
  results.push({ path, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${path}  ${detail}`);
}

async function priceFor(lookupKey: string): Promise<string> {
  const list = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (!list.data[0]) throw new Error(`no active price for ${lookupKey}`);
  return list.data[0].id;
}

/** A real sandbox subscription on the given price, paid with a test card. */
async function makeSubscription(priceId: string, email: string): Promise<Stripe.Subscription> {
  const customer = await stripe.customers.create({
    email,
    payment_method: "pm_card_visa",
    invoice_settings: { default_payment_method: "pm_card_visa" },
  });
  return stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    expand: ["items.data.price"],
  });
}

/** Unique per event: the route's idempotency marker is a unique stripeEventId,
 *  and two events in the same millisecond would make the second a silent no-op. */
let eventSeq = 0;

/** Sign a payload the way Stripe does and hand it to the real route. */
async function post(event: Record<string, unknown>) {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  const payload = JSON.stringify({ id: `evt_${Date.now()}_${++eventSeq}`, object: "event", ...event });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
  const { POST } = await import("@/app/api/webhooks/route");
  return POST(
    new Request("https://local/api/webhooks", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body: payload,
    }) as never,
  );
}

/**
 * Event one: checkout.session.completed.
 *
 * client_reference_id, NOT customer metadata. The handler resolves a tenant by
 * client_reference_id first and stripeCustomerId second and never reads
 * metadata at all — a first harness stamped metadata, matched no tenant, wrote
 * no row, and every downstream assertion failed for that one reason while the
 * product code was never reached.
 */
async function deliverCheckout(subscription: Stripe.Subscription, tenantId: string) {
  return post({
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_${Date.now()}`,
        object: "checkout.session",
        client_reference_id: tenantId,
        customer: subscription.customer,
        subscription: subscription.id,
        mode: "subscription",
        status: "complete",
      },
    },
  });
}

/**
 * Event two: customer.subscription.created. THIS is what writes the row.
 *
 * A previous run of this harness sent only event one and read productKind
 * `undefined`, which looked like a product failure and was not: checkout.session
 * .completed never writes a Subscription row. Production always sends both, so
 * the harness must too, or paths (a) and (b) test half a purchase.
 *
 * It carries no client_reference_id — subscription events have no such field.
 * The handler matches on stripeCustomerId, which event one persisted, so
 * delivering these in order is also what proves that linkage holds.
 */
async function deliverSubscriptionCreated(subscription: Stripe.Subscription) {
  return post({
    type: "customer.subscription.created",
    data: { object: subscription },
  });
}

/** Everything the two events are supposed to move, read back from the DB. */
async function stateOf(tenantId: string, label: string) {
  const t = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { planType: true, billingStatus: true, stripeCustomerId: true },
  });
  const row = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { productKind: true, status: true, planType: true, stripeSubscriptionId: true, updatedAt: true },
  });
  const { hasPaidPlan } = await import("@/lib/paid-plan");
  const paid = await hasPaidPlan(tenantId);
  console.log(
    `    ${label.padEnd(22)} tenant[${t.planType}/${t.billingStatus}] ` +
      `row[${row ? `${row.productKind}/${row.status}` : "none"}] hasPaidPlan=${paid}`,
  );
  return { tenant: t, row, paid };
}

async function tenant(suffix: string, planType: "STARTER" | "GROWTH") {
  const slug = `${SLUG}-${suffix}`;
  const existing = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (existing) {
    await prisma.tenant.delete({ where: { id: existing.id } });
  }
  return prisma.tenant.create({
    data: { name: `E2E ${suffix}`, slug, planType },
    select: { id: true, stripeCustomerId: true },
  });
}

async function main() {
  const watcherPrice = await priceFor(WATCHER_LOOKUP_KEYS.monthly);
  console.log(`watcher price: ${watcherPrice}\n`);

  // ── (a) a guest buys the watcher ──
  console.log("── (a) a guest buys the watcher ──");
  const a = await tenant("a", "STARTER");
  const subA = await makeSubscription(watcherPrice, "e2e-a@example.test");

  await deliverCheckout(subA, a.id);
  const a1 = await stateOf(a.id, "after checkout");
  // THE WINDOW. No row exists yet, so the paid gate falls back to
  // tenant.billingStatus — which this handler used to set to ACTIVE for any
  // purchase at all. tests/watcher-checkout-window.test.ts pins the same state.
  check(
    "a: window — checkout alone does not activate",
    a1.paid === false && a1.tenant.billingStatus !== "ACTIVE",
    `billingStatus=${a1.tenant.billingStatus} hasPaidPlan=${a1.paid}`,
  );
  check(
    "a: window — customer id still recorded",
    a1.tenant.stripeCustomerId === subA.customer,
    `stripeCustomerId=${a1.tenant.stripeCustomerId}`,
  );

  await deliverSubscriptionCreated(subA);
  const a2 = await stateOf(a.id, "after subscription");

  check("a: productKind", a2.row?.productKind === "WATCHER", `got ${a2.row?.productKind}`);
  check("a: plan features locked", a2.paid === false, `hasPaidPlan=${a2.paid}`);

  const { resolveShapeForTenant } = await import("@/lib/ai-monitor/limits");
  const shapeA = await resolveShapeForTenant(a.id, "STARTER");
  check(
    "a: WATCHER_SOLO shape",
    shapeA.source === "watcher_solo" && shapeA.shape.repetitions === 3 && shapeA.shape.providers === 1,
    `source=${shapeA.source} reps=${shapeA.shape.repetitions} providers=${shapeA.shape.providers}`,
  );

  check(
    "a: planType not promoted",
    a2.tenant.planType === "STARTER",
    `planType=${a2.tenant.planType} billingStatus=${a2.tenant.billingStatus}`,
  );

  // ── (b) the watcher tenant upgrades to a plan ──
  console.log("\n── (b) the watcher tenant upgrades to a plan ──");
  const starterPrice = await priceFor("echorank_starter_usd_month");
  const subB = await makeSubscription(starterPrice, "e2e-b@example.test");

  await deliverCheckout(subB, a.id); // same tenant: this is the upgrade
  const b1 = await stateOf(a.id, "after checkout");
  check(
    "b: checkout activates a PLAN buyer",
    b1.tenant.billingStatus === "ACTIVE",
    `billingStatus=${b1.tenant.billingStatus}`,
  );
  check(
    "b: watcher row still standing before the subscription event",
    b1.row?.productKind === "WATCHER",
    `row=${b1.row?.productKind}`,
  );

  await deliverSubscriptionCreated(subB);
  const b2 = await stateOf(a.id, "after subscription");

  check("b: row flipped to PLAN", b2.row?.productKind === "PLAN", `got ${b2.row?.productKind}`);
  check(
    "b: row points at the new subscription",
    b2.row?.stripeSubscriptionId === subB.id,
    `row sub=${b2.row?.stripeSubscriptionId} expected ${subB.id}`,
  );
  check("b: plan features unlock", b2.paid === true, `hasPaidPlan=${b2.paid}`);

  // CANCEL BEFORE FLIP, evidenced by the clock rather than by reading the code:
  // Stripe's canceled_at is when the old watcher stopped billing and the row's
  // updatedAt is when it became a PLAN. The handler cancels first and flips only
  // if that succeeded, so cancel must not be LATER than the flip — the reverse
  // order is the double-bill window this ordering exists to prevent.
  const oldSub = await stripe.subscriptions.retrieve(subA.id);
  check(
    "b: old watcher cancelled (no double bill)",
    oldSub.status === "canceled",
    `old watcher status=${oldSub.status}`,
  );
  const cancelledAt = oldSub.canceled_at ? new Date(oldSub.canceled_at * 1000) : null;
  const flippedAt = b2.row?.updatedAt ?? null;
  check(
    "b: cancel happened before the flip",
    !!cancelledAt && !!flippedAt && cancelledAt.getTime() <= flippedAt.getTime(),
    `cancelled=${cancelledAt?.toISOString()} flipped=${flippedAt?.toISOString()}`,
  );

  // ── (c) a plan tenant attempts watcher checkout ──
  const { watcherCheckoutBlock } = await import("@/lib/ai-monitor/watcher-entitlement");
  const guard = watcherCheckoutBlock({ productKind: "PLAN", active: true });
  check("c: plan tenant blocked", guard.blocked, guard.reason ?? "");

  // ── (d) the consent gate applies to watcher checkout ──
  const route = await (await import("node:fs/promises")).readFile(
    "src/app/api/billing/checkout/route.ts",
    "utf8",
  );
  // Compare CALL SITES, not imports. The first version compared indexOf on the
  // bare identifiers, which found both in the import block at the top of the
  // file and reported the ordering backwards — the product was always right.
  const consentCall = route.indexOf("checkConsent(consent)");
  const guardCall = route.indexOf("watcherCheckoutBlock(");
  const consentBeforeGuard = consentCall > -1 && guardCall > -1 && consentCall < guardCall;
  check(
    "d: consent gate covers the watcher tier",
    route.includes("checkConsent") && consentBeforeGuard,
    consentBeforeGuard ? "consent checked before the watcher guard" : "ORDERING WRONG or absent",
  );

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log("FAILED:");
    failed.forEach((f) => console.log(`  ${f.path}: ${f.detail}`));
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("ERROR:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // Explicit, because resolveShapeForTenant reaches the queue layer and its
    // Redis connection holds the event loop open long after the last check has
    // printed. Without this the run only ends on a SIGTERM, which looks like a
    // hung test rather than a finished one.
    process.exit(process.exitCode ?? 0);
  });
