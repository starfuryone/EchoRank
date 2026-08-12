/**
 * The billing portal, end to end, against the Stripe SANDBOX.
 *
 * WHAT IT PROVES
 *   1. A portal session can be created at all — this is the check that fails
 *      when the portal is unconfigured, which is the whole reason item 4 of the
 *      brief exists. An unconfigured account rejects the create outright.
 *   2. The configuration's cancellation semantic really is at-period-end.
 *   3. Cancelling the way the portal cancels produces webhooks this app
 *      handles, and the watcher entitlement drops at the right MOMENT — not
 *      when the customer clicks, but when the period they paid for ends.
 *
 * WHAT IT DOES NOT PROVE: the click path through Stripe's hosted UI. No
 * browser is installed on this box, so the portal's own pages are not driven.
 * Everything on our side of that boundary is exercised with the same API calls
 * the portal issues, and the session URL is printed so a human can open it.
 *
 *   STRIPE_TEST_SECRET_KEY=sk_test_... npx tsx scripts/portal-e2e.ts
 */
import "dotenv/config";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { WATCHER_LOOKUP_KEYS } from "@/lib/plan-config";

const WEBHOOK_SECRET = "whsec_e2e_local_only";
const SLUG = "portal-e2e";

function key(): string {
  const k = process.env.STRIPE_TEST_SECRET_KEY?.trim();
  if (!k?.startsWith("sk_test_")) throw new Error("need a sk_test_ key");
  return k;
}

// The route builds its own client from STRIPE_SECRET_KEY, and dotenv above
// loads the LIVE key from .env. Same trap the watcher harness documents.
process.env.STRIPE_SECRET_KEY = key();
if (!process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  throw new Error("refusing to run: the route would use a non-test key");
}

const stripe = new Stripe(key());
const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

let seq = 0;
async function post(event: Record<string, unknown>) {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  const payload = JSON.stringify({ id: `evt_${Date.now()}_${++seq}`, object: "event", ...event });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const { POST } = await import("@/app/api/webhooks/route");
  return POST(
    new Request("https://local/api/webhooks", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body: payload,
    }) as never,
  );
}

async function state(tenantId: string, label: string) {
  const row = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { productKind: true, status: true, cancelAtPeriodEnd: true },
  });
  const { resolveShapeForTenant } = await import("@/lib/ai-monitor/limits");
  const shape = await resolveShapeForTenant(tenantId, "STARTER");
  console.log(
    `    ${label.padEnd(26)} row[${row ? `${row.productKind}/${row.status}` : "none"}` +
      `${row?.cancelAtPeriodEnd ? " cancelling" : ""}] entitlement=${shape.source}`,
  );
  return { row, shape };
}

async function main() {
  // ── the portal configuration ──
  const configs = await stripe.billingPortal.configurations.list({ limit: 100 });
  const def = configs.data.find((c) => c.is_default && c.active);
  check(
    "portal is configured (default, active)",
    !!def,
    def ? def.id : "NO DEFAULT CONFIGURATION — the portal would 500",
  );
  check(
    "cancellation semantic is at_period_end",
    def?.features.subscription_cancel?.enabled === true &&
      def?.features.subscription_cancel?.mode === "at_period_end",
    `enabled=${def?.features.subscription_cancel?.enabled} mode=${def?.features.subscription_cancel?.mode}`,
  );
  check(
    "plan switching stays in our checkout, not the portal",
    def?.features.subscription_update?.enabled === false,
    `subscription_update.enabled=${def?.features.subscription_update?.enabled}`,
  );

  // ── a watcher subscriber ──
  const existing = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true } });
  if (existing) await prisma.tenant.delete({ where: { id: existing.id } });
  const tenant = await prisma.tenant.create({
    data: { name: "Portal E2E", slug: SLUG, planType: "STARTER" },
    select: { id: true },
  });

  const price = await stripe.prices.list({
    lookup_keys: [WATCHER_LOOKUP_KEYS.monthly],
    active: true,
    limit: 1,
  });
  if (!price.data[0]) throw new Error("no active watcher price");
  const customer = await stripe.customers.create({
    email: "portal-e2e@example.test",
    payment_method: "pm_card_visa",
    invoice_settings: { default_payment_method: "pm_card_visa" },
  });
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.data[0].id }],
    expand: ["items.data.price"],
  });

  await post({
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${Date.now()}`,
        object: "checkout.session",
        client_reference_id: tenant.id,
        customer: customer.id,
        subscription: sub.id,
        mode: "subscription",
        status: "complete",
      },
    },
  });
  await post({ type: "customer.subscription.created", data: { object: sub } });
  const bought = await state(tenant.id, "after purchase");
  check(
    "watcher entitlement active",
    bought.row?.productKind === "WATCHER" && bought.shape.source === "watcher_solo",
    `row=${bought.row?.productKind} source=${bought.shape.source}`,
  );

  // ── the portal session the route would mint ──
  const portal = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: "https://echorank360.com/billing",
  });
  check("portal session created", !!portal.url, portal.url ? "url issued" : "no url");
  console.log(`    open by hand if you want the UI: ${portal.url}`);

  // ── cancel, the way the portal cancels ──
  const cancelling = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
  await post({ type: "customer.subscription.updated", data: { object: cancelling } });
  const during = await state(tenant.id, "after clicking cancel");
  check(
    "access SURVIVES until period end",
    during.row?.cancelAtPeriodEnd === true && during.shape.source === "watcher_solo",
    `cancelAtPeriodEnd=${during.row?.cancelAtPeriodEnd} source=${during.shape.source}`,
  );

  // ── the period actually ends ──
  //
  // Stripe fires customer.subscription.deleted when the paid period runs out.
  // Cancelling immediately here produces the same event with the same shape,
  // which is the only way to reach that moment without waiting a month.
  const ended = await stripe.subscriptions.cancel(sub.id);
  await post({ type: "customer.subscription.deleted", data: { object: ended } });
  const after = await state(tenant.id, "after period end");
  check(
    "entitlement DROPS at period end",
    after.row?.status === "CANCELED" && after.shape.source !== "watcher_solo",
    `row=${after.row?.status} source=${after.shape.source}`,
  );

  const { hasPaidPlan } = await import("@/lib/paid-plan");
  check(
    "cancelled watcher grants no paid plan",
    (await hasPaidPlan(tenant.id)) === false,
    `hasPaidPlan=${await hasPaidPlan(tenant.id)}`,
  );

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log("FAILED:");
    failed.forEach((f) => console.log(`  ${f.name}: ${f.detail}`));
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
    process.exit(process.exitCode ?? 0);
  });
