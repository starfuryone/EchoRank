/**
 * Create the three credit-pack products and prices in Stripe.
 *
 *   # sandbox (the "Echorank Dome" account)
 *   set -a && . /opt/echorank/.stripe-sandbox && set +a
 *   STRIPE_SECRET_KEY="$STRIPE_API_KEY" npx tsx scripts/seed-credit-packs.ts
 *   STRIPE_SECRET_KEY="$STRIPE_API_KEY" npx tsx scripts/seed-credit-packs.ts --apply
 *
 *   # live — ONLY after a human has read the printed plan and said yes
 *   npx tsx scripts/seed-credit-packs.ts --live            # prints the plan
 *   npx tsx scripts/seed-credit-packs.ts --live --apply
 *
 * ── THE 2026-08-01 INCIDENT SHAPES THIS WHOLE FILE ──────────────────────────
 * The live Stripe account is shared by seven or more products. An unscoped
 * lookup_key sweep once archived AgoraIQ and AI Membership Hub prices — another
 * team's revenue, taken down by a query that was only meant to touch ours. So:
 *
 *   - THIS SCRIPT NEVER ARCHIVES, UPDATES OR DELETES ANYTHING. It creates, and
 *     that is the entire vocabulary. The incident class is not mitigated here,
 *     it is absent — there is no destructive call to get wrong.
 *   - Every object it creates carries metadata[app]=echorank, so the next
 *     person's scoped query can see ours and skip it.
 *   - Every read it makes is scoped, and reads are by lookup key, which is
 *     exact rather than a prefix match.
 *   - A live key is refused unless --live is passed explicitly. Sandbox is the
 *     default because the default should be the safe one.
 *   - Dry run is the default. --apply is the only thing that writes.
 *
 * ── IT IS IDEMPOTENT, unlike seed-plan-prices-usd.ts ────────────────────────
 * The documented rule for that older seeder is "no idempotency, never re-run
 * against live", which makes a half-finished run unrecoverable: you cannot
 * safely repeat it and you cannot tell what it got through. This one checks each
 * lookup key first and skips what already exists, so a run interrupted at pack
 * two is fixed by running it again. That check is a scoped, read-only
 * prices.list by exact lookup key — the safe half of the operation that caused
 * the incident, never the sweep.
 */
import "dotenv/config";
import Stripe from "stripe";
import {
  CREDIT_PACKS,
  CREDIT_PRODUCT_ID,
  allCreditPackLookupKeys,
  creditPackLookupKey,
  unitUsdFor,
  type CreditPack,
} from "@/lib/credit-packs";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const LIVE = args.includes("--live");

/**
 * USD per pack, supplied on the command line.
 *
 * NOT read from credit-packs.ts, because that file deliberately holds no
 * prices — Stripe is the source of truth and this script is the one thing that
 * writes to it. Passing them explicitly also means the live run states its own
 * amounts in the command, which is what a human is approving.
 *
 *   --price 100=8 --price 500=35 --price 2000=120
 */
const PRICES = new Map<number, number>();
for (let i = 0; i < args.length; i += 1) {
  if (args[i] !== "--price") continue;
  const [credits, usd] = (args[i + 1] ?? "").split("=");
  const c = Number.parseInt(credits ?? "", 10);
  const u = Number.parseFloat(usd ?? "");
  if (Number.isFinite(c) && Number.isFinite(u)) PRICES.set(c, u);
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  fail(
    "STRIPE_SECRET_KEY is not set.\n" +
      "  sandbox: set -a && . /opt/echorank/.stripe-sandbox && set +a\n" +
      '           then STRIPE_SECRET_KEY="$STRIPE_API_KEY" npx tsx scripts/seed-credit-packs.ts',
  );
}

// ── The key guard ───────────────────────────────────────────────────────────
// A live key without --live is the mistake this exists to stop: the sandbox
// command and the live command differ by one exported variable, and getting it
// wrong silently writes to the shared account.
const isTestKey = key.includes("test");
if (!isTestKey && !LIVE) {
  fail(
    "That is a LIVE key and --live was not passed.\n" +
      "  The live Stripe account is shared with 7+ products (see docs/agents/gotchas.md).\n" +
      "  Run against sandbox first, or pass --live deliberately.",
  );
}
if (isTestKey && LIVE) {
  fail("--live was passed but the key is a test key. Refusing, in case the wrong key is loaded.");
}

const MODE = isTestKey ? "SANDBOX" : "LIVE";
const stripe = new Stripe(key);

/** Stamped on every object, so the next team's scoped query can skip ours. */
const APP_METADATA = { app: "echorank" } as const;

/**
 * The active price for one key, if the catalogue has one.
 *
 * RETURNS THE PRICE, NOT JUST ITS ID, so a skip can report what the customer is
 * actually charged. An earlier version printed only "already exists (price_…)",
 * which answers "is it seeded" but not "is it seeded CORRECTLY" — and against
 * live those are different questions, with only the second one worth running a
 * verification pass for.
 *
 * Scoped and exact. A read by lookup key touches only the key named; it is not
 * a prefix sweep and cannot reach another product's catalogue.
 */
async function existingPrice(lookupKey: string): Promise<Stripe.Price | null> {
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return found.data[0] ?? null;
}

/**
 * The product all three prices hang off.
 *
 * ── RESOLVED FROM THE CATALOGUE FIRST, THE CONSTANT SECOND ──────────────────
 * A Stripe product id is per-account, so sandbox and live hold different ones
 * and CREDIT_PRODUCT_ID can only ever name one of them. Trusting it alone means
 * that whichever mode was seeded second makes the other unrunnable — the
 * constant points at a product this account has never heard of, and the seeder
 * offers to create a duplicate beside the packs that already exist.
 *
 * So the first question asked is the one that cannot be wrong in either mode:
 * does a credit-pack price already exist here, and what product is it on? Only
 * if nothing exists does the constant get a try, and only if that fails too is
 * a product created. A second run therefore never leaves two products competing
 * for the same three keys, in either account.
 */
async function resolveProductId(): Promise<string> {
  // 1. Ask the catalogue. Scoped to our own keys, and a read.
  try {
    const existing = await stripe.prices.list({
      lookup_keys: allCreditPackLookupKeys(),
      active: true,
      limit: 1,
    });
    const product = existing.data[0]?.product;
    const productId = typeof product === "string" ? product : product?.id;
    if (productId) {
      console.log(`  product ${productId} — resolved from the existing prices`);
      if (productId !== CREDIT_PRODUCT_ID) {
        console.log(
          `  note: CREDIT_PRODUCT_ID is ${CREDIT_PRODUCT_ID}, which is the other mode's id.`,
        );
      }
      return productId;
    }
  } catch {
    // Fall through to the constant.
  }

  // 2. The constant, for a mode with no packs yet but a product already made.
  try {
    const existing = await stripe.products.retrieve(CREDIT_PRODUCT_ID);
    if (!existing.deleted) {
      console.log(`  product ${CREDIT_PRODUCT_ID} — reusing`);
      return CREDIT_PRODUCT_ID;
    }
  } catch {
    // Not in this mode's catalogue. Expected the first time live is seeded:
    // product ids do not carry across from sandbox.
  }

  if (!APPLY) {
    console.log(`  product — would CREATE (${CREDIT_PRODUCT_ID} not in this account)`);
    return "(pending)";
  }

  const product = await stripe.products.create({
    name: "Echorank Prospect Lookups",
    description:
      "Google Business lookups for the Agency Opportunity Scanner. " +
      "One-time purchase, credits never expire.",
    metadata: APP_METADATA,
  });
  console.log(`  product ${product.id} — CREATED`);
  console.log(`  ⚠  update CREDIT_PRODUCT_ID in src/lib/credit-packs.ts to ${product.id}`);
  return product.id;
}

async function seedPack(pack: CreditPack, productId: string): Promise<"created" | "skipped"> {
  const lookupKey = creditPackLookupKey(pack.credits);

  const existing = await existingPrice(lookupKey);
  if (existing) {
    // unit_amount is null for tiered/metered prices — which a credit pack must
    // never be, so saying so is more useful than printing nothing.
    const amount =
      existing.unit_amount === null || existing.unit_amount === undefined
        ? "NO FLAT AMOUNT — not a one-time price!"
        : `$${existing.unit_amount / 100} ` +
          `($${unitUsdFor(pack.credits, existing.unit_amount / 100).toFixed(3)}/lookup)`;
    console.log(`  ${lookupKey.padEnd(32)} SKIP — exists at ${amount}`);

    // A --price that disagrees with what is live is the thing worth shouting
    // about: it means someone intended a change that this script will NOT make,
    // because it never updates an existing price.
    const intended = PRICES.get(pack.credits);
    if (
      intended !== undefined &&
      existing.unit_amount !== null &&
      existing.unit_amount !== undefined &&
      Math.round(intended * 100) !== existing.unit_amount
    ) {
      console.log(
        `  ⚠  ${lookupKey} is live at $${existing.unit_amount / 100} but --price said $${intended}.` +
          "\n     This script never updates a price. Create a new one in Stripe and archive the old.",
      );
    }
    return "skipped";
  }

  const usd = PRICES.get(pack.credits);
  if (usd === undefined) {
    // Refused rather than guessed. This script is the only writer of a price
    // and there is no default worth inventing for money.
    console.log(`  ${lookupKey.padEnd(32)} NO PRICE GIVEN — pass --price ${pack.credits}=<usd>`);
    return "skipped";
  }

  if (!APPLY) {
    console.log(
      `  ${lookupKey.padEnd(32)} would CREATE  $${usd}  ` +
        `($${unitUsdFor(pack.credits, usd).toFixed(3)}/lookup)`,
    );
    return "created";
  }

  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: Math.round(usd * 100),
    lookup_key: lookupKey,
    // No `recurring` — its absence is what makes this a one-time price, and a
    // one-time price is what mode=payment checkout requires.
    metadata: { ...APP_METADATA, credits: String(pack.credits) },
  });

  console.log(`  ${lookupKey.padEnd(32)} CREATED  ${price.id}  $${usd}`);
  return "created";
}

async function main(): Promise<void> {
  console.log(`\nCredit packs — ${MODE}${APPLY ? "" : "  (DRY RUN — nothing will be written)"}\n`);
  console.log("  Plan:");
  for (const pack of CREDIT_PACKS) {
    const usd = PRICES.get(pack.credits);
    console.log(
      `    ${String(pack.credits).padStart(5)} lookups  ` +
        (usd === undefined
          ? "no --price given"
          : `$${String(usd).padStart(4)}  ($${unitUsdFor(pack.credits, usd).toFixed(3)}/lookup)`) +
        `  ${creditPackLookupKey(pack.credits)}`,
    );
  }
  console.log("");

  const productId = await resolveProductId();

  let created = 0;
  let skipped = 0;
  for (const pack of CREDIT_PACKS) {
    const result = await seedPack(pack, productId);
    if (result === "created") created += 1;
    else skipped += 1;
  }

  console.log(
    `\n${APPLY ? "Done" : "Dry run complete"} — ${created} to create, ${skipped} already present.`,
  );

  if (!APPLY) {
    console.log(
      MODE === "LIVE"
        ? "\nThis is the LIVE create plan. Re-run with --live --apply ONLY with explicit human approval.\n"
        : "\nRe-run with --apply to write to sandbox.\n",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
