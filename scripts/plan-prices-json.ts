/**
 * Print the Stripe amounts from PLAN_CONFIGS as JSON, one object per plan and
 * interval, for /opt/echorank/prompts/stripe-price-change.sh (bash cannot read
 * the config, and a second typed price list is exactly what drifts).
 *
 *   npx tsx scripts/plan-prices-json.ts
 *   [{"planTier":"starter","interval":"month","cents":7800,"lookupKey":"echorank_starter_usd_month","label":"Starter"}, ...]
 *
 * No Stripe call, no database, no .env: it reads plan-config.ts only.
 */
import { PLAN_PRICE_SPECS, amountFor, lookupKeyFor, type PriceInterval } from "@/lib/stripe/plan-price-spec";

const rows = PLAN_PRICE_SPECS.flatMap((spec) =>
  (["month", "year"] as PriceInterval[]).map((interval) => ({
    planTier: spec.planTier,
    interval,
    cents: amountFor(spec, interval),
    lookupKey: lookupKeyFor(spec, interval),
    label: spec.label,
  })),
);

process.stdout.write(`${JSON.stringify(rows)}\n`);
