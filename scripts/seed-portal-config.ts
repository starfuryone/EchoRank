/**
 * Configure the Stripe Billing Portal in a SANDBOX.
 *
 * REFUSES A LIVE KEY, for the same reason scripts/seed-watcher-prices.ts does:
 * this box's STRIPE_SECRET_KEY is `sk_live_`, and a portal configuration is
 * customer-facing the moment it exists. The key must start with `sk_test_` and
 * be passed deliberately — the script never reads STRIPE_SECRET_KEY.
 *
 *   STRIPE_TEST_SECRET_KEY=sk_test_... npx tsx scripts/seed-portal-config.ts
 *   STRIPE_TEST_SECRET_KEY=sk_test_... npx tsx scripts/seed-portal-config.ts --apply
 *
 * WHAT IT ENCODES: cancel at period end. That is the promise in the
 * Subscription Agreement, and it lives here rather than in the route because
 * the portal is what the customer actually operates — a flag in our code could
 * disagree with the UI they are looking at, and the UI would win.
 *
 * IDEMPOTENT. The configuration is found by metadata and UPDATED in place, so
 * a second run does not leave two configurations, which would make the portal's
 * behaviour depend on which one Stripe considers default.
 */
import Stripe from "stripe";

const CONFIG_METADATA = { app: "echorank", config: "portal_v1" } as const;

function requireTestKey(): string {
  const key = process.env.STRIPE_TEST_SECRET_KEY?.trim();
  if (!key) {
    throw new Error(
      "STRIPE_TEST_SECRET_KEY is not set. This script never reads STRIPE_SECRET_KEY, " +
        "because that key on this box is a LIVE key.",
    );
  }
  if (!key.startsWith("sk_test_")) {
    throw new Error(
      `Refusing to run: STRIPE_TEST_SECRET_KEY does not start with "sk_test_" (got "${key.slice(0, 8)}…").`,
    );
  }
  return key;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const stripe = new Stripe(requireTestKey());

  // Belt and braces: ask Stripe whether this is livemode rather than trusting
  // the key prefix alone.
  const balance = await stripe.balance.retrieve();
  if (balance.livemode === true) {
    throw new Error("Refusing to run: the key resolves to a livemode account.");
  }
  console.log("connected to a test-mode account");

  const features: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
    // THE CANCELLATION SEMANTIC. `at_period_end` is what the Subscription
    // Agreement promises: the customer keeps what they paid for until the
    // period they paid for runs out. `immediately` would revoke access the
    // instant they click, which is both a worse deal and a different promise.
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      cancellation_reason: {
        enabled: true,
        options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
      },
    },
    // Read-only surfaces. Updating a subscription's PRICE from the portal is
    // deliberately off: plan changes go through our own checkout, which is
    // where consent is recorded and where the watcher/plan guard lives. Letting
    // the portal swap a $9 watcher for a tier would route around both.
    subscription_update: { enabled: false },
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    customer_update: {
      enabled: true,
      allowed_updates: ["email", "address", "tax_id"],
    },
  };

  const existing = await stripe.billingPortal.configurations.list({ limit: 100 });
  const mine = existing.data.find((c) => c.metadata?.config === CONFIG_METADATA.config);
  const active = existing.data.filter((c) => c.active);

  // MANAGE THE DEFAULT, DO NOT ADD BESIDE IT.
  //
  // /api/billing/portal creates sessions without naming a configuration, so
  // Stripe uses the account DEFAULT — and the API gives no way to promote a
  // configuration to default (only the first one ever created, or the Dashboard,
  // decides that). A first run of this script created a second configuration
  // that nothing could ever reach, which is the portal version of the duplicate
  // price the other seeder learned about the hard way. So: adopt the default,
  // update it in place, and stamp it so later runs recognise it.
  // THE DEFAULT WINS OVER OUR OWN METADATA. Getting this precedence backwards
  // is not hypothetical: `mine ?? default` re-selected the unreachable
  // configuration this script had just created, dutifully updated it, and left
  // the configuration customers actually get untouched — a green run that
  // changed nothing that matters.
  const target = active.find((c) => c.is_default) ?? mine;

  if (target) {
    const cancel = target.features.subscription_cancel;
    console.log(
      `configuration ${target.id} (default=${target.is_default}${mine ? ", ours" : ", adopting"})`,
    );
    console.log(`  cancel now: enabled=${cancel?.enabled} mode=${cancel?.mode}`);
    if (!apply) {
      console.log("DRY RUN — pass --apply to update it in place");
      return;
    }
    const updated = await stripe.billingPortal.configurations.update(target.id, {
      features,
      metadata: { ...CONFIG_METADATA },
    });
    console.log(
      `updated ${updated.id}: cancel enabled=${updated.features.subscription_cancel?.enabled} ` +
        `mode=${updated.features.subscription_cancel?.mode} default=${updated.is_default}`,
    );

    // Retire any configuration of ours that is NOT the default — it is
    // unreachable and only makes the account's behaviour ambiguous to read.
    for (const stray of active) {
      if (stray.id === updated.id || stray.is_default) continue;
      if (stray.metadata?.config !== CONFIG_METADATA.config) continue;
      await stripe.billingPortal.configurations.update(stray.id, { active: false });
      console.log(`  deactivated unreachable duplicate ${stray.id}`);
    }
    return;
  }

  if (!apply) {
    console.log("would CREATE a portal configuration with subscription_cancel mode=at_period_end");
    console.log("DRY RUN — pass --apply to write");
    return;
  }

  const created = await stripe.billingPortal.configurations.create({
    features,
    business_profile: {
      headline: "Echorank — manage your subscription",
    },
    metadata: { ...CONFIG_METADATA },
  });
  console.log(
    `created ${created.id}: cancel enabled=${created.features.subscription_cancel?.enabled} ` +
      `mode=${created.features.subscription_cancel?.mode} default=${created.is_default}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
