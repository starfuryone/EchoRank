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
 */
import "dotenv/config";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

type Interval = "month" | "year";
type Status = "created" | "reused" | "skipped" | "CONFLICT";

interface TierSpec {
  /** stripe_prices.plan_tier — lowercase, as src/lib/stripe/prices.ts expects. */
  planTier: string;
  /** Product name suffix. Branding is "Echorank360", never CamelCase. */
  label: string;
  monthlyCents: number;
  annualCents: number;
}

const CURRENCY = "USD";
const BRAND = "Echorank360";

// ENTERPRISE is deliberately absent: sales-led, no price rows, renders
// "Contact us" wherever tiers are compared.
const TIERS: TierSpec[] = [
  { planTier: "starter", label: "Starter", monthlyCents: 7_900, annualCents: 75_600 },
  { planTier: "growth", label: "Growth", monthlyCents: 19_900, annualCents: 190_800 },
  { planTier: "agency", label: "Agency", monthlyCents: 49_900, annualCents: 478_800 },
];

const EXPECTED_ROWS = TIERS.length * 2; // 3 tiers x 2 intervals = 6

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

function amountFor(spec: TierSpec, interval: Interval): number {
  return interval === "month" ? spec.monthlyCents : spec.annualCents;
}

function lookupKeyFor(spec: TierSpec, interval: Interval): string {
  return `echorank_${spec.planTier}_usd_${interval}`;
}

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
 * Upsert the catalog row for (tier, USD, interval). Existing rows are never
 * modified: a row pointing at a price with a different amount is reported as
 * CONFLICT for manual review. Non-USD rows are never touched — every query
 * here is filtered to currency = USD.
 */
async function upsertCatalogRow(
  stripe: Stripe,
  spec: TierSpec,
  interval: Interval,
  priceId: string,
  desiredCents: number
): Promise<{ status: Status; note?: string }> {
  const existing = await prisma.stripePrice.findFirst({
    where: { planTier: spec.planTier, currency: CURRENCY, interval },
    select: { id: true, stripePriceId: true },
  });

  if (!existing) {
    await prisma.stripePrice.create({
      data: {
        stripePriceId: priceId,
        planTier: spec.planTier,
        currency: CURRENCY,
        interval,
        active: true,
      },
    });
    return { status: "created" };
  }

  if (existing.stripePriceId === priceId) {
    return { status: "skipped", note: "row already correct" };
  }

  // Different price id: compare the amount on the price it points at. The
  // table stores no amount, so Stripe is the only source of truth here.
  let existingAmount: number | null = null;
  try {
    const p = await stripe.prices.retrieve(existing.stripePriceId);
    existingAmount = p.unit_amount;
  } catch {
    return {
      status: "CONFLICT",
      note: `existing row -> ${existing.stripePriceId} (not retrievable)`,
    };
  }

  if (existingAmount === desiredCents) {
    return {
      status: "skipped",
      note: `existing row -> ${existing.stripePriceId}, same amount`,
    };
  }

  return {
    status: "CONFLICT",
    note: `existing ${usd(existingAmount ?? 0)} vs desired ${usd(desiredCents)} — left untouched`,
  };
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

      const res = await upsertCatalogRow(stripe, spec, interval, price.id, desired);
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

  // Verification: count USD rows in the catalog.
  const usdCount = await prisma.stripePrice.count({ where: { currency: CURRENCY } });
  console.log(`\nUSD catalog rows: ${usdCount} (expected ${EXPECTED_ROWS})`);
  if (usdCount !== EXPECTED_ROWS) {
    console.error(
      `ASSERTION FAILED: expected ${EXPECTED_ROWS} USD rows, found ${usdCount}.`
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
