/**
 * Seed the two standalone-Watcher prices into a Stripe SANDBOX.
 *
 * REFUSES A LIVE KEY, AND THAT IS THE POINT OF THE FILE. This box's only
 * configured STRIPE_SECRET_KEY is `sk_live_`; running a seeder here without a
 * guard would create products and prices in the real account, which is not
 * something a `git revert` undoes. The key must start with `sk_test_` and be
 * passed deliberately — the script never reads STRIPE_SECRET_KEY, so there is
 * no environment in which it can pick the live key up by accident.
 *
 *   STRIPE_TEST_SECRET_KEY=sk_test_... npx tsx scripts/seed-watcher-prices.ts
 *   STRIPE_TEST_SECRET_KEY=sk_test_... npx tsx scripts/seed-watcher-prices.ts --apply
 *
 * IDEMPOTENT. Both the product and the prices are looked up first — by
 * metadata and by lookup key — and an existing price is reused rather than
 * duplicated. Stripe prices are immutable, so a second run that created a
 * second $9 price would leave two active prices sharing one lookup key, and
 * `prices.list({lookup_keys})` would then return whichever Stripe felt like.
 * The previous seeding attempt in this project had no idempotency; this one
 * does.
 */
import Stripe from "stripe";
import { WATCHER_LOOKUP_KEYS, WATCHER_PRICES_CENTS } from "@/lib/plan-config";

const PRODUCT_METADATA = { app: "echorank", product: "watcher" } as const;

/** Fixed so idempotency does not depend on Stripe's eventually-consistent search. */
const PRODUCT_ID = "echorank_watcher";

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
      `Refusing to run: STRIPE_TEST_SECRET_KEY does not start with "sk_test_" (got "${key.slice(0, 8)}…"). ` +
        "Seeding prices into a live account is not reversible.",
    );
  }
  return key;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const stripe = new Stripe(requireTestKey());

  // Belt and braces: ask Stripe itself whether this is livemode rather than
  // trusting the key prefix alone. Every Stripe response carries `livemode`,
  // and a balance read is the cheapest one that does.
  const balance = await stripe.balance.retrieve();
  if (balance.livemode === true) {
    throw new Error("Refusing to run: the key resolves to a livemode account.");
  }
  console.log("connected to a test-mode account");

  // ── product, by DETERMINISTIC ID ──
  //
  // NOT products.search. The first run of this script created the product
  // twice, because Stripe's search index is eventually consistent and a
  // second --apply seconds later could not see what the first had just
  // written. A fixed id is strongly consistent: retrieve tells the truth
  // immediately, and a create that races loses with a clean duplicate error
  // rather than silently making a second product. The prices were unaffected
  // because lookup-key reads are strongly consistent, which is why only the
  // product duplicated.
  let product: Stripe.Product | undefined;
  try {
    product = await stripe.products.retrieve(PRODUCT_ID);
    console.log(`product exists: ${product.id} (${product.name})`);
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode !== 404) throw err;
    if (apply) {
      product = await stripe.products.create({
        id: PRODUCT_ID,
        name: "Echorank Watcher",
        description: "AI Search monitoring for one brand.",
        metadata: { ...PRODUCT_METADATA },
      });
      console.log(`product created: ${product.id}`);
    } else {
      console.log(`product would be created: ${PRODUCT_ID}`);
    }
  }

  // ── prices, by lookup key ──
  for (const [interval, lookupKey] of [
    ["month", WATCHER_LOOKUP_KEYS.monthly],
    ["year", WATCHER_LOOKUP_KEYS.annual],
  ] as const) {
    const amount = interval === "month" ? WATCHER_PRICES_CENTS.monthly : WATCHER_PRICES_CENTS.annual;
    const found = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 2 });

    if (found.data.length > 1) {
      // The failure the idempotency exists to prevent, reported rather than
      // compounded: two active prices on one lookup key makes resolution
      // non-deterministic.
      console.error(`  ${lookupKey}: ${found.data.length} ACTIVE PRICES share this key — fix by hand`);
      continue;
    }
    if (found.data[0]) {
      const price = found.data[0];
      const matches = price.unit_amount === amount && price.currency === "usd";
      console.log(
        `  ${lookupKey}: exists ${price.id} ${price.unit_amount} ${price.currency}` +
          (matches ? "" : `  ** MISMATCH, expected ${amount} usd — prices are immutable, fix by hand **`),
      );
      continue;
    }
    if (!apply) {
      console.log(`  ${lookupKey}: would create ${amount} usd / ${interval}`);
      continue;
    }
    if (!product) throw new Error("cannot create a price without a product");
    // transfer_lookup_key because Stripe RESERVES a lookup key even on an
    // ARCHIVED price, and the search above deliberately only considers active
    // ones. Reaching here therefore means no live price holds the key and any
    // holder is retired, so moving it is safe — whereas without this a single
    // archived price makes the seeder permanently unable to re-create its own
    // key, which is exactly what happened on the first run.
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: amount,
      recurring: { interval },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      metadata: { ...PRODUCT_METADATA },
    });
    console.log(`  ${lookupKey}: created ${price.id} ${amount} usd / ${interval}`);
  }

  console.log(apply ? "done" : "DRY RUN — pass --apply to write");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
