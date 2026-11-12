/**
 * The Stripe prices for every card plan, and the matching rows in the price
 * catalog (stripe_prices). Amounts come from PLAN_CONFIGS through
 * src/lib/stripe/plan-price-spec.ts; nothing is typed here.
 *
 *   npx tsx scripts/seed-plan-prices-usd.ts --dry-run   # read-only, any key
 *   npx tsx scripts/seed-plan-prices-usd.ts             # writes, test key
 *   npx tsx scripts/seed-plan-prices-usd.ts --live      # writes, required for a live key
 *
 * The key is STRIPE_API_KEY if set (what the Stripe CLI and the operator's
 * scripts read), else STRIPE_SECRET_KEY (the app's .env). It is never printed.
 * The database is DATABASE_URL, from .env unless DOTENV_CONFIG_PATH names
 * another file. A TEST key's write run requires DOTENV_CONFIG_PATH (the sandbox
 * env): with the app's .env it would write test price ids into the live
 * catalog.
 *
 * PER PLAN AND INTERVAL (lookup key echorank_<tier>_usd_<interval>):
 *   1. The price holding the lookup key. At the configured amount: kept.
 *      Otherwise, or if no price holds it: a NEW price on the same product, at
 *      the configured amount, with the lookup key and transfer_lookup_key=true
 *      (the key moves; the old price keeps its id and its subscribers). A
 *      Stripe price's amount is never edited.
 *   2. The catalog row for that price: created active, or set active; every
 *      other active USD row for the tier and interval set active=false. Rows
 *      are never deleted: subscribers and trialists stay on the price they
 *      signed up at, and the webhook resolves their price id through this
 *      table (resolvePlanFromPriceId has no active filter). A superseded
 *      price with no row gets one, inactive, for the same reason.
 *   3. Superseded prices (the plan's other active recurring USD prices of that
 *      interval, on its product or in its rows) are ARCHIVED in Stripe
 *      (active=false: no new checkout, existing subscriptions renew on it
 *      unchanged) only when no subscription that is not cancelled uses them.
 *      One that is in use is left active and reported. No subscription is
 *      ever read for more than its status, and none is ever updated.
 *
 * THE LIVE ACCOUNT IS SHARED with other products (docs/agents/gotchas.md): a
 * price or product is ours only when it carries metadata[app]=echorank, and
 * this script archives or reuses nothing else. A lookup key held by a price
 * without that metadata is a CONFLICT and nothing is done for it; a
 * superseded price without it is reported, never archived. Everything created
 * here carries metadata app, tier and brand.
 *
 * IDEMPOTENT: a rerun finds each key on the configured amount, each row in
 * place and each superseded price archived (or still in use), and changes
 * nothing. Creates carry an idempotency key, so a retried request cannot
 * duplicate a price. --dry-run reads Stripe and the catalog (no write to
 * either) and prints exactly what a run with the same key would do, plus the
 * subscriptions on every superseded price.
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
type TierSpec = PlanPriceSpec;

const CURRENCY = "USD";
const BRAND = "Echorank360";
const APP = "echorank";
const INTERVALS: readonly Interval[] = ["month", "year"];

// ENTERPRISE is deliberately absent (plan-price-spec.ts): sales-led, no price
// rows, renders "Contact us" wherever tiers are compared. The AI Visibility
// and Nosy Bat rows are what put those plans on sale (src/lib/plan-launch.ts
// for Nosy Bat): until both of a plan's rows exist checkout refuses it.
const TIERS: readonly TierSpec[] = PLAN_PRICE_SPECS;

const EXPECTED_ROWS = EXPECTED_ACTIVE_ROWS; // 5 tiers x 2 intervals = 10 active rows

/** Subscription statuses that still bill, or may again: a price in use. */
const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);


const money = (cents: number | null) => (cents === null ? "(no amount)" : `$${(cents / 100).toFixed(2)}`);
const ours = (m: Stripe.Metadata | null | undefined) => m?.app === APP;
const productIdOf = (p: Stripe.Price) => (typeof p.product === "string" ? p.product : p.product.id);

// ── Reading (dry run and real run alike) ─────────────────────────────────────

interface Superseded {
  price: Stripe.Price;
  subs: Record<string, number>;
  inUse: number;
  /** Why it stays active, if it does. */
  keep?: string;
}

interface Plan {
  spec: TierSpec;
  interval: Interval;
  lookupKey: string;
  desired: number;
  holder: Stripe.Price | null;
  /** The product a new price goes on; null = a product must be created. */
  productId: string | null;
  createPrice: boolean;
  superseded: Superseded[];
  /**
   * Nosy Bat only, for the report: its product's prices of this interval that
   * are already archived, and the subscriptions still on them.
   */
  archivedBefore: { price: Stripe.Price; subs: Record<string, number>; inUse: number }[];
  /** Superseded prices with no catalog row: given one, inactive. */
  missingRows: string[];
  conflict?: string;
}

async function findProduct(stripe: Stripe, spec: TierSpec): Promise<string | null> {
  // Scoped by metadata[app] as well as the tier: never another product's.
  try {
    const found = await stripe.products.search({
      query: `metadata['app']:'${APP}' AND metadata['tier']:'${spec.planTier}' AND active:'true'`,
      limit: 2,
    });
    return found.data[0]?.id ?? null;
  } catch {
    for await (const p of stripe.products.list({ active: true, limit: 100 })) {
      if (ours(p.metadata) && p.metadata.tier === spec.planTier) return p.id;
    }
    return null;
  }
}

async function subscriptionsOn(stripe: Stripe, priceId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for await (const s of stripe.subscriptions.list({ price: priceId, status: "all", limit: 100 })) {
    counts[s.status] = (counts[s.status] ?? 0) + 1;
  }
  return counts;
}

async function planFor(stripe: Stripe, spec: TierSpec, interval: Interval, productHint: string | null): Promise<Plan> {
  const lookupKey = lookupKeyFor(spec, interval);
  const desired = amountFor(spec, interval);
  const held = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const holder = held.data[0] ?? null;
  const plan: Plan = { spec, interval, lookupKey, desired, holder, productId: productHint, createPrice: false, superseded: [], archivedBefore: [], missingRows: [] };

  if (holder && !ours(holder.metadata)) {
    plan.conflict = `${holder.id} holds ${lookupKey} without metadata[app]=${APP}: not ours to move, nothing done`;
    return plan;
  }
  if (holder) plan.productId = productIdOf(holder);
  const current = holder && holder.unit_amount === desired && holder.currency === "usd" && holder.recurring?.interval === interval ? holder : null;
  plan.createPrice = !current;

  // The prices this plan's current price supersedes: active, recurring, USD,
  // same interval, on its product or in its catalog rows; never the price
  // that keeps the key.
  const candidates = new Map<string, Stripe.Price>();
  if (holder && !current) candidates.set(holder.id, holder);
  if (plan.productId) {
    for await (const p of stripe.prices.list({ product: plan.productId, active: true, currency: "usd", type: "recurring", limit: 100 })) {
      if (p.recurring?.interval === interval && p.id !== current?.id) candidates.set(p.id, p);
    }
  }
  const rows = await prisma.stripePrice.findMany({
    where: { planTier: spec.planTier, currency: CURRENCY, interval },
    select: { stripePriceId: true },
  });
  for (const r of rows) {
    if (r.stripePriceId === current?.id || candidates.has(r.stripePriceId)) continue;
    const p = await stripe.prices.retrieve(r.stripePriceId).catch(() => null);
    if (p?.active) candidates.set(p.id, p);
  }
  const rowIds = new Set(rows.map((r) => r.stripePriceId));

  const inUseOf = (subs: Record<string, number>) =>
    Object.entries(subs).filter(([s]) => LIVE_STATUSES.has(s)).reduce((n, [, c]) => n + c, 0);
  if (spec.plan === "NOSY_BAT" && plan.productId) {
    for await (const p of stripe.prices.list({ product: plan.productId, active: false, currency: "usd", type: "recurring", limit: 100 })) {
      if (p.recurring?.interval !== interval) continue;
      const subs = await subscriptionsOn(stripe, p.id);
      plan.archivedBefore.push({ price: p, subs, inUse: inUseOf(subs) });
    }
  }

  for (const price of candidates.values()) {
    const subs = await subscriptionsOn(stripe, price.id);
    const inUse = inUseOf(subs);
    let keep: string | undefined;
    if (!ours(price.metadata)) keep = `no metadata[app]=${APP}: not archived, check it by hand`;
    else if (price.lookup_key && price.lookup_key !== lookupKey) keep = `holds another lookup key (${price.lookup_key}): not archived`;
    else if (price.recurring?.interval_count !== 1) keep = "interval_count is not 1: not archived";
    else if (inUse > 0) keep = `${inUse} subscription(s) not cancelled use it: left active, nobody is moved`;
    plan.superseded.push({ price, subs, inUse, keep });
    if (!rowIds.has(price.id) && ours(price.metadata)) plan.missingRows.push(price.id);
  }
  return plan;
}

// ── Writing (real run only) ──────────────────────────────────────────────────

async function createProduct(stripe: Stripe, spec: TierSpec): Promise<string> {
  const created = await stripe.products.create(
    { name: `${BRAND} ${spec.label}`, metadata: { app: APP, tier: spec.planTier, brand: BRAND } },
    { idempotencyKey: `seed-product-${spec.planTier}` },
  );
  return created.id;
}

async function createPrice(stripe: Stripe, plan: Plan): Promise<Stripe.Price> {
  const taxBehavior = plan.holder?.tax_behavior;
  return stripe.prices.create(
    {
      product: plan.productId!,
      currency: "usd",
      unit_amount: plan.desired,
      recurring: { interval: plan.interval },
      lookup_key: plan.lookupKey,
      transfer_lookup_key: true,
      ...(taxBehavior && taxBehavior !== "unspecified" ? { tax_behavior: taxBehavior } : {}),
      metadata: { app: APP, tier: plan.spec.planTier, brand: BRAND },
    },
    { idempotencyKey: `seed-price-${plan.lookupKey}-${plan.desired}-${plan.holder?.id ?? "none"}` },
  );
}

/**
 * `priceId` becomes the one ACTIVE catalog row for (tier, USD, interval); any
 * other active row for the same tier and interval is set active = false and
 * kept. Nothing is deleted; non-USD rows are never touched.
 */
async function upsertCatalogRow(plan: Plan, priceId: string): Promise<string[]> {
  const { spec, interval } = plan;
  const notes: string[] = [];
  const own = await prisma.stripePrice.findFirst({
    where: { stripePriceId: priceId },
    select: { id: true, planTier: true, currency: true, interval: true, active: true },
  });
  if (own && (own.planTier !== spec.planTier || own.currency !== CURRENCY || own.interval !== interval)) {
    throw new Error(`row for ${priceId} says ${own.planTier}/${own.currency}/${own.interval}; left untouched, fix by hand`);
  }
  if (!own) {
    await prisma.stripePrice.create({
      data: { stripePriceId: priceId, planTier: spec.planTier, currency: CURRENCY, interval, active: true },
    });
    notes.push(`row created for ${priceId}`);
  } else if (!own.active) {
    await prisma.stripePrice.update({ where: { id: own.id }, data: { active: true } });
    notes.push(`row for ${priceId} set active`);
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
    notes.push(`rows retired (active=false, kept): ${older.map((r) => r.stripePriceId).join(", ")}`);
  }
  for (const id of plan.missingRows) {
    await prisma.stripePrice.create({
      data: { stripePriceId: id, planTier: spec.planTier, currency: CURRENCY, interval, active: false },
    });
    notes.push(`row created for superseded ${id}, inactive (the webhook can map it)`);
  }
  return notes;
}

// ── Output ───────────────────────────────────────────────────────────────────

function describePlan(plan: Plan, dry: boolean): string[] {
  const would = (s: string) => (dry ? `WOULD ${s}` : s.toUpperCase().slice(0, 1) + s.slice(1));
  const out: string[] = [];
  const h = plan.holder;
  out.push(`${plan.spec.label} / ${plan.interval}  ${plan.lookupKey}  config ${money(plan.desired)}`);
  out.push(`  key now on: ${h ? `${h.id} ${money(h.unit_amount)} ${h.currency}/${h.recurring?.interval} active=${h.active}` : "no price"}`);
  if (plan.conflict) {
    out.push(`  CONFLICT: ${plan.conflict}`);
    return out;
  }
  if (!plan.productId) out.push(`  ${would(`create product "${BRAND} ${plan.spec.label}" (metadata app=${APP}, tier=${plan.spec.planTier})`)}`);
  if (plan.createPrice) {
    out.push(`  ${would(`create price ${money(plan.desired)}/${plan.interval} on ${plan.productId ?? "the new product"}, lookup_key ${plan.lookupKey}, transfer_lookup_key=true${h ? ` (moves it off ${h.id})` : ""}`)}`);
  } else {
    out.push(`  keep ${h!.id}: already ${money(plan.desired)}`);
  }
  out.push(`  ${would(`make the catalog row for the ${plan.createPrice ? "new price" : h!.id} the one active ${plan.spec.planTier}/${plan.interval} row; other active rows set active=false, kept`)}`);
  for (const id of plan.missingRows) out.push(`  ${would(`add an inactive catalog row for superseded ${id}`)}`);
  for (const s of plan.superseded) {
    const subs = Object.entries(s.subs).map(([k, v]) => `${k} ${v}`).join(", ") || "none";
    const head = `superseded ${s.price.id} ${money(s.price.unit_amount)}/${s.price.recurring?.interval}; subscriptions: ${subs}`;
    out.push(s.keep ? `  ${head}\n    left active: ${s.keep}` : `  ${head}\n    ${would("archive it (Stripe active=false; existing subscriptions unaffected)")}`);
  }
  if (!plan.superseded.length) out.push("  nothing superseded");
  return out;
}

/** Exported for tests/seed-plan-prices.test.ts, which runs it on fakes. */
export async function main(argv: readonly string[] = process.argv.slice(2)) {
  const DRY_RUN = argv.includes("--dry-run");
  const LIVE_OK = argv.includes("--live");
  const fromCli = (process.env.STRIPE_API_KEY || "").trim();
  const key = fromCli || (process.env.STRIPE_SECRET_KEY || "").trim();
  const keySource = fromCli ? "STRIPE_API_KEY" : "STRIPE_SECRET_KEY";

  if (!key) {
    console.error("No Stripe key: set STRIPE_API_KEY (or STRIPE_SECRET_KEY in .env).");
    if (!DRY_RUN) process.exit(1);
    console.log("Dry run without a key: the configured amounts only, no Stripe or database read.\n");
    for (const spec of TIERS) for (const interval of INTERVALS) {
      console.log(`${spec.label.padEnd(14)} ${interval.padEnd(6)} ${lookupKeyFor(spec, interval).padEnd(32)} ${money(amountFor(spec, interval))}`);
    }
    console.log(`\n${EXPECTED_ROWS} active USD rows expected. ENTERPRISE excluded: sales-led, Contact us.`);
    await prisma.$disconnect();
    return;
  }

  const isLive = /^(sk|rk)_live_/.test(key);
  const mode = isLive ? "LIVE" : "TEST";

  if (!DRY_RUN && isLive && !LIVE_OK) {
    console.error(`Refusing to write: ${keySource} is a LIVE key. Run --dry-run first, then rerun with --live.`);
    process.exit(1);
  }
  if (!DRY_RUN && !isLive && !process.env.DOTENV_CONFIG_PATH) {
    console.error(
      "Refusing to write: a TEST key with the app's .env would put test price ids in the live catalog.\n" +
        "Set DOTENV_CONFIG_PATH to the sandbox env (its DATABASE_URL), or use --dry-run.",
    );
    process.exit(1);
  }

  const stripe = new Stripe(key);
  console.log(`Mode: ${mode} (${keySource})${DRY_RUN ? " — DRY RUN: reads Stripe and the catalog, writes nothing" : ""}\n`);

  const plans: Plan[] = [];
  for (const spec of TIERS) {
    const product = await findProduct(stripe, spec);
    for (const interval of INTERVALS) plans.push(await planFor(stripe, spec, interval, product));
    // Both intervals go on one product: the month plan may have found it
    // through its key's holder when the search did not.
    const pair = plans.slice(-2);
    const found = pair.find((p) => p.productId)?.productId ?? null;
    for (const p of pair) p.productId ??= found;
  }

  const conflicts = plans.filter((p) => p.conflict);
  if (DRY_RUN) {
    for (const p of plans) console.log(describePlan(p, true).join("\n") + "\n");
    const creates = plans.filter((p) => p.createPrice && !p.conflict).length;
    const archives = plans.flatMap((p) => p.superseded.filter((s) => !s.keep)).length;
    const kept = plans.flatMap((p) => p.superseded.filter((s) => s.keep)).length;
    console.log(`Summary: ${creates} price(s) to create, ${archives} to archive, ${kept} superseded left active, ${conflicts.length} CONFLICT.`);
    reportNosyBat(plans);
    await prisma.$disconnect();
    return;
  }

  if (conflicts.length) {
    for (const p of conflicts) console.error(describePlan(p, false).join("\n"));
    console.error("\nCONFLICT: nothing written. Resolve the above by hand and rerun.");
    await prisma.$disconnect();
    process.exit(1);
  }

  for (const spec of TIERS) {
    const pair = plans.filter((p) => p.spec === spec);
    if (pair.some((p) => !p.productId)) {
      const id = await createProduct(stripe, spec);
      for (const p of pair) p.productId = id;
    }
  }

  for (const plan of plans) {
    for (const line of describePlan(plan, false)) console.log(line);
    const priceId = plan.createPrice ? (await createPrice(stripe, plan)).id : plan.holder!.id;
    if (plan.createPrice) console.log(`  created ${priceId}`);
    for (const note of await upsertCatalogRow(plan, priceId)) console.log(`  ${note}`);
    for (const s of plan.superseded.filter((x) => !x.keep)) {
      await stripe.prices.update(s.price.id, { active: false });
      console.log(`  archived ${s.price.id}`);
    }
    console.log("");
  }

  // Verification: every key on its configured amount, one ACTIVE USD row per
  // tier and interval. Retired rows are kept on purpose and counted apart.
  let drift = 0;
  for (const plan of plans) {
    const now = (await stripe.prices.list({ lookup_keys: [plan.lookupKey], limit: 1 })).data[0];
    if (now?.unit_amount !== plan.desired) {
      drift++;
      console.error(`${plan.lookupKey} is on ${now?.id ?? "nothing"} ${money(now?.unit_amount ?? null)}, config says ${money(plan.desired)}`);
    }
  }
  const usdCount = await prisma.stripePrice.count({ where: { currency: CURRENCY, active: true } });
  const retired = await prisma.stripePrice.count({ where: { currency: CURRENCY, active: false } });
  console.log(`Active USD catalog rows: ${usdCount} (expected ${EXPECTED_ROWS}); retired rows kept: ${retired}`);
  if (usdCount !== EXPECTED_ROWS || drift > 0) {
    console.error(`ASSERTION FAILED: expected ${EXPECTED_ROWS} active USD rows and every key on its amount; found ${usdCount} rows and ${drift} key(s) off.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log("Assertion passed.");
  reportNosyBat(plans);
  await prisma.$disconnect();
}

/** The crawler-only plan's old prices and who is on them (counts only). */
function reportNosyBat(plans: Plan[]) {
  const nb = plans.filter((p) => p.spec.plan === "NOSY_BAT");
  const rows = nb.flatMap((p) => [
    ...p.superseded.map((s) => ({ interval: p.interval, state: "superseded now", ...s })),
    ...p.archivedBefore.map((s) => ({ interval: p.interval, state: "archived before", ...s })),
  ]);
  console.log("\nNosy Bat, subscriptions on its old prices (counts by status, no customer data):");
  if (!rows.length) console.log("  no old prices");
  for (const r of rows) {
    const subs = Object.entries(r.subs).map(([k, v]) => `${k} ${v}`).join(", ") || "none";
    console.log(`  ${r.interval.padEnd(6)} ${r.price.id} ${money(r.price.unit_amount)} (${r.state}): ${subs}${r.inUse ? `  <- ${r.inUse} still billing on it` : ""}`);
  }
}

// Run when invoked as a script, not when a test imports it.
if (/seed-plan-prices-usd\.ts$/.test(process.argv[1] ?? "")) {
  main().catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
}
