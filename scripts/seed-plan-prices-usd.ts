/**
 * Seed USD plan prices: one Stripe Product per tier, monthly + annual Prices,
 * and the matching rows in the price catalog. Fully idempotent — rerunning
 * reuses existing Stripe objects via metadata/lookup_key and never duplicates.
 *
 *   npx tsx scripts/seed-plan-prices-usd.ts --dry-run
 *   npx tsx scripts/seed-plan-prices-usd.ts            # test key only
 *   npx tsx scripts/seed-plan-prices-usd.ts --live     # required for sk_live
 *
 * NOTE ON THE TABLE NAME: the spec calls this "PlanPrice". There is no
 * PlanPrice model in this schema — the catalog is `StripePrice`
 * (table `stripe_prices`), which is what src/lib/stripe/prices.ts resolves
 * against. This script writes there. That table has NO amount column, so an
 * amount mismatch cannot be detected from the database; CONFLICT is decided
 * by reading unit_amount back off the Stripe Price the row points at.
 *
 * Uses the project's generated client via @/lib/prisma (which imports from
 * @/generated/prisma, not @prisma/client). No Next.js APIs are involved.
 *
 * AMOUNTS FROM PLAN_CONFIGS (src/lib/stripe/plan-price-spec.ts), not typed
 * here. The Stripe prices themselves are made by the operator's scripts in
 * /opt/echorank/prompts (stripe-ai-visibility.sh, stripe-nosy-bat.sh, and for
 * the 2026-11-11 price change stripe-price-change.sh), which create each new
 * price with the existing lookup key and transfer_lookup_key=true. This seeder
 * then finds the price holding each key and checks its amount against config.
 *
 * ONE ACTIVE ROW PER (tier, interval), OLD ROWS KEPT. When the price holding a
 * lookup key is not the one a row points at (a price change), the new price
 * gets a row with active = true and the older rows for that tier and interval
 * get active = false. They are never deleted: subscribers and trialists stay on
 * the price they signed up at, and the webhook resolves their price id through
 * this table (resolvePlanFromPriceId has no active filter). `active` means "on
 * sale"; checkout itself resolves the lookup key live in Stripe.
 */
import "dotenv/config";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  EXPECTED_ACTIVE_ROWS,
  PLAN_PRICE_SPECS,
  amountFor,
  lookupKeyFor,
  type PlanPriceSpec,
  type PriceInterval,
} from "@/lib/stripe/plan-price-spec";

type Interval = PriceInterval;
type Status = "created" | "reused" | "skipped" | "CONFLICT";
type TierSpec = PlanPriceSpec;

const CURRENCY = "USD";
const BRAND = "Echorank360";

// ENTERPRISE is deliberately absent (plan-price-spec.ts): sales-led, no price
// rows, renders "Contact us" wherever tiers are compared. The AI Visibility
// and Nosy Bat rows are what put those plans on sale (src/lib/plan-launch.ts
// for Nosy Bat): until both of a plan's rows exist checkout refuses it.
const TIERS: readonly TierSpec[] = PLAN_PRICE_SPECS;

const EXPECTED_ROWS = EXPECTED_ACTIVE_ROWS; // 5 tiers x 2 intervals = 10 active rows

interface ResultRow {
  tier: string;
  interval: Interval;
  stripePriceId: string;
  status: Status;
  note?: string;
}

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const LIVE_OK = argv.includes("--live");

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Find the tier's product by metadata, else create it. */
async function ensureProduct(stripe: Stripe, spec: TierSpec): Promise<string> {
  const name = `${BRAND} ${spec.label}`;

  // products.search is the precise lookup; fall back to a list scan on
  // accounts where search is unavailable.
  try {
    const found = await stripe.products.search({
      query: `metadata['tier']:'${spec.planTier}'`,
      limit: 1,
    });
    if (found.data[0]) return found.data[0].id;
  } catch {
    const list = await stripe.products.list({ limit: 100, active: true });
    const hit = list.data.find((p) => p.metadata?.tier === spec.planTier);
    if (hit) return hit.id;
  }

  const created = await stripe.products.create({
    name,
    metadata: { tier: spec.planTier, brand: BRAND },
  });
  return created.id;
}

/** Find the price by lookup_key, else create it. Never duplicates. */
async function ensurePrice(
  stripe: Stripe,
  spec: TierSpec,
  interval: Interval,
  productId: string
): Promise<{ id: string; unitAmount: number | null; reused: boolean }> {
  const lookupKey = lookupKeyFor(spec, interval);

  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
  });
  if (existing.data[0]) {
    const p = existing.data[0];
    return { id: p.id, unitAmount: p.unit_amount, reused: true };
  }

  const created = await stripe.prices.create({
    product: productId,
    currency: CURRENCY.toLowerCase(),
    unit_amount: amountFor(spec, interval),
    recurring: { interval },
    lookup_key: lookupKey,
    metadata: { tier: spec.planTier, brand: BRAND },
  });
  return { id: created.id, unitAmount: created.unit_amount, reused: false };
}

/**
 * Make `priceId` (the price holding the lookup key, at the configured amount)
 * the one ACTIVE catalog row for (tier, USD, interval).
 *
 *   - its row exists and is active, no other active row → skipped
 *   - its row is missing → created, active
 *   - any OTHER active row for the same tier and interval → active = false,
 *     kept (a subscriber may be on that price; see the header)
 *
 * Nothing is deleted. Non-USD rows are never touched: every query here is
 * filtered to currency = USD.
 */
async function upsertCatalogRow(
  spec: TierSpec,
  interval: Interval,
  priceId: string,
): Promise<{ status: Status; note?: string }> {
  const own = await prisma.stripePrice.findFirst({
    where: { stripePriceId: priceId },
    select: { id: true, planTier: true, currency: true, interval: true, active: true },
  });

  if (own && (own.planTier !== spec.planTier || own.currency !== CURRENCY || own.interval !== interval)) {
    return {
      status: "CONFLICT",
      note: `row for ${priceId} says ${own.planTier}/${own.currency}/${own.interval} — left untouched`,
    };
  }

  let status: Status = "skipped";
  const notes: string[] = [];
  if (!own) {
    await prisma.stripePrice.create({
      data: { stripePriceId: priceId, planTier: spec.planTier, currency: CURRENCY, interval, active: true },
    });
    status = "created";
  } else if (!own.active) {
    await prisma.stripePrice.update({ where: { id: own.id }, data: { active: true } });
    status = "created";
    notes.push("row existed inactive; set active");
  }

  // The rows this price replaces: off sale, still resolvable by the webhook.
  const older = await prisma.stripePrice.findMany({
    where: { planTier: spec.planTier, currency: CURRENCY, interval, active: true, NOT: { stripePriceId: priceId } },
    select: { stripePriceId: true },
  });
  if (older.length) {
    await prisma.stripePrice.updateMany({
      where: { stripePriceId: { in: older.map((r) => r.stripePriceId) } },
      data: { active: false },
    });
    notes.push(`retired (active=false, kept): ${older.map((r) => r.stripePriceId).join(", ")}`);
  }
  if (status === "skipped" && !older.length) notes.push("row already correct");
  return { status, note: notes.join("; ") || undefined };
}

function printSummary(rows: ResultRow[], mode: string) {
  const w = [16, 9, 30, 9];
  const line = (a: string, b: string, c: string, d: string) =>
    `${a.padEnd(w[0])}${b.padEnd(w[1])}${c.padEnd(w[2])}${d}`;

  console.log(`\nMode: ${mode}`);
  console.log(line("TIER", "INTERVAL", "STRIPE PRICE ID", "STATUS"));
  console.log("-".repeat(w[0] + w[1] + w[2] + w[3]));
  for (const r of rows) {
    console.log(line(r.tier, r.interval, r.stripePriceId || "-", r.status));
    if (r.note) console.log(`${" ".repeat(w[0])}  ${r.note}`);
  }

  const conflicts = rows.filter((r) => r.status === "CONFLICT");
  console.log(
    `\n${rows.length} row(s) processed — ` +
      `${rows.filter((r) => r.status === "created").length} created, ` +
      `${rows.filter((r) => r.status === "reused").length} reused, ` +
      `${rows.filter((r) => r.status === "skipped").length} skipped, ` +
      `${conflicts.length} CONFLICT`
  );
  if (conflicts.length) {
    console.log("\nCONFLICTS need manual review — nothing was modified for these.");
  }
}

async function main() {
  const key = (process.env.STRIPE_SECRET_KEY || "").trim();

  if (!key) {
    console.error(
      "STRIPE_SECRET_KEY is empty in .env.\n" +
        "Set a TEST key (sk_test_...) and rerun. Use --dry-run to preview " +
        "without any Stripe or database access."
    );
    if (!DRY_RUN) process.exit(1);
  }

  const isLive = key.startsWith("sk_live");
  const mode = !key ? "DRY-RUN (no key)" : isLive ? "LIVE" : "TEST";

  if (isLive && !LIVE_OK) {
    console.error(
      "Refusing to run: STRIPE_SECRET_KEY is a LIVE key (sk_live_...).\n" +
        "The first run must be against a test key. If you really intend to " +
        "write to live Stripe, rerun with --live."
    );
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(`Mode: ${mode} — dry run, no Stripe calls, no database writes.\n`);
    const rows: ResultRow[] = [];
    for (const spec of TIERS) {
      for (const interval of ["month", "year"] as Interval[]) {
        const cents = amountFor(spec, interval);
        rows.push({
          tier: spec.planTier,
          interval,
          stripePriceId: `(would use lookup_key ${lookupKeyFor(spec, interval)})`,
          status: "created",
          note: `${BRAND} ${spec.label} — ${usd(cents)} / ${interval}`,
        });
      }
    }
    printSummary(rows, mode);
    console.log(
      `\nWould write ${rows.length} USD rows (expected ${EXPECTED_ROWS}).` +
        " ENTERPRISE excluded: sales-led, Contact us."
    );
    await prisma.$disconnect();
    return;
  }

  const stripe = new Stripe(key);
  console.log(`Mode: ${mode}\n`);

  const rows: ResultRow[] = [];
  for (const spec of TIERS) {
    const productId = await ensureProduct(stripe, spec);
    for (const interval of ["month", "year"] as Interval[]) {
      const desired = amountFor(spec, interval);
      const price = await ensurePrice(stripe, spec, interval, productId);

      // A reused price whose amount drifted from the spec is a conflict too.
      if (price.reused && price.unitAmount !== desired) {
        rows.push({
          tier: spec.planTier,
          interval,
          stripePriceId: price.id,
          status: "CONFLICT",
          note: `stripe price is ${usd(price.unitAmount ?? 0)}, spec says ${usd(desired)} — left untouched`,
        });
        continue;
      }

      const res = await upsertCatalogRow(spec, interval, price.id);
      rows.push({
        tier: spec.planTier,
        interval,
        stripePriceId: price.id,
        status: res.status === "created" && price.reused ? "reused" : res.status,
        note: res.note,
      });
    }
  }

  printSummary(rows, mode);

  // Verification: ACTIVE USD rows, one per tier and interval. Retired rows are
  // kept on purpose (the webhook resolves old subscribers' prices through
  // them) and counted separately.
  const usdCount = await prisma.stripePrice.count({ where: { currency: CURRENCY, active: true } });
  const retired = await prisma.stripePrice.count({ where: { currency: CURRENCY, active: false } });
  console.log(`\nActive USD catalog rows: ${usdCount} (expected ${EXPECTED_ROWS}); retired rows kept: ${retired}`);
  const conflicts = rows.filter((r) => r.status === "CONFLICT").length;
  if (usdCount !== EXPECTED_ROWS || conflicts > 0) {
    console.error(
      `ASSERTION FAILED: expected ${EXPECTED_ROWS} active USD rows and no CONFLICT, found ${usdCount} and ${conflicts}.`
    );
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log("Assertion passed.");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
