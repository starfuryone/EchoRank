// tests/seed-plan-prices.test.ts
//
// scripts/seed-plan-prices-usd.ts, run on an in-memory Stripe and catalog: the
// dry run writes nothing and says what a run would do; a run creates the
// configured prices on the lookup keys (transfer_lookup_key), archives only
// our superseded prices that no live subscription uses, keeps every row, and a
// rerun changes nothing. No network: `stripe` and `@/lib/prisma` are fakes.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Price = {
  id: string;
  product: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string; interval_count: number };
  lookup_key: string | null;
  active: boolean;
  metadata: Record<string, string>;
  tax_behavior: string | null;
};
type Row = { id: number; stripePriceId: string; planTier: string; currency: string; interval: string; active: boolean };

const W = vi.hoisted(() => ({
  products: [] as { id: string; metadata: Record<string, string>; active: boolean }[],
  prices: [] as Price[],
  subs: [] as { price: string; status: string }[],
  rows: [] as Row[],
  writes: [] as string[],
  seq: 0,
}));

vi.mock("dotenv/config", () => ({}));

vi.mock("stripe", () => {
  const page = <T>(items: T[]) => ({
    data: items,
    async *[Symbol.asyncIterator]() {
      yield* items;
    },
  });
  const fake = {
    products: {
      search: async ({ query }: { query: string }) => {
        const tier = /metadata\['tier'\]:'([^']+)'/.exec(query)![1];
        return page(W.products.filter((p) => p.active && p.metadata.app === "echorank" && p.metadata.tier === tier));
      },
      list: () => page(W.products),
      create: async (p: { metadata: Record<string, string> }) => {
        W.writes.push("product.create");
        const prod = { id: `prod_new${++W.seq}`, metadata: p.metadata, active: true };
        W.products.push(prod);
        return prod;
      },
    },
    prices: {
      list: (q: { lookup_keys?: string[]; product?: string; active?: boolean; currency?: string }) =>
        page(
          W.prices.filter(
            (p) =>
              (!q.lookup_keys || (p.lookup_key !== null && q.lookup_keys.includes(p.lookup_key))) &&
              (!q.product || p.product === q.product) &&
              (q.active === undefined || p.active === q.active) &&
              (!q.currency || p.currency === q.currency),
          ),
        ),
      retrieve: async (id: string) => {
        const p = W.prices.find((x) => x.id === id);
        if (!p) throw new Error("no such price");
        return p;
      },
      create: async (p: Omit<Price, "id" | "active" | "recurring" | "tax_behavior"> & { recurring: { interval: string }; transfer_lookup_key?: boolean; tax_behavior?: string }) => {
        W.writes.push(`price.create ${p.lookup_key} ${p.unit_amount}`);
        if (p.transfer_lookup_key) for (const x of W.prices) if (x.lookup_key === p.lookup_key) x.lookup_key = null;
        const price: Price = {
          id: `price_new${++W.seq}`,
          product: p.product,
          unit_amount: p.unit_amount,
          currency: p.currency,
          recurring: { interval: p.recurring.interval, interval_count: 1 },
          lookup_key: p.lookup_key,
          active: true,
          metadata: p.metadata,
          tax_behavior: p.tax_behavior ?? null,
        };
        W.prices.push(price);
        return price;
      },
      update: async (id: string, u: { active: boolean }) => {
        W.writes.push(`price.update ${id} active=${u.active}`);
        const p = W.prices.find((x) => x.id === id)!;
        p.active = u.active;
        return p;
      },
    },
    subscriptions: {
      list: ({ price }: { price: string }) => page(W.subs.filter((s) => s.price === price).map((s) => ({ status: s.status }))),
    },
  };
  return { default: class { constructor() { return fake; } } };
});

vi.mock("@/lib/prisma", () => {
  type Where = Record<string, unknown>;
  const match = (r: Row, w: Where = {}): boolean =>
    Object.entries(w).every(([k, v]) => {
      if (k === "NOT") return !match(r, v as Where);
      if (v && typeof v === "object" && "in" in v) return (v as { in: unknown[] }).in.includes(r[k as keyof Row]);
      return r[k as keyof Row] === v;
    });
  const stripePrice = {
    findFirst: async ({ where }: { where: Where }) => W.rows.find((r) => match(r, where)) ?? null,
    findMany: async ({ where }: { where: Where }) => W.rows.filter((r) => match(r, where)),
    count: async ({ where }: { where: Where }) => W.rows.filter((r) => match(r, where)).length,
    create: async ({ data }: { data: Omit<Row, "id"> }) => {
      W.writes.push(`row.create ${data.stripePriceId} active=${data.active}`);
      W.rows.push({ id: ++W.seq, ...data });
    },
    update: async ({ where, data }: { where: { id: number }; data: Partial<Row> }) => {
      W.writes.push(`row.update ${where.id}`);
      Object.assign(W.rows.find((r) => r.id === where.id)!, data);
    },
    updateMany: async ({ where, data }: { where: Where; data: Partial<Row> }) => {
      W.writes.push("row.updateMany");
      for (const r of W.rows.filter((x) => match(x, where))) Object.assign(r, data);
    },
  };
  return { prisma: { stripePrice, $disconnect: async () => {} } };
});

import { main } from "../scripts/seed-plan-prices-usd";
import { PLAN_PRICE_SPECS, amountFor, lookupKeyFor } from "@/lib/stripe/plan-price-spec";

const OURS = (tier: string) => ({ app: "echorank", tier, brand: "Echorank360" });

function price(id: string, product: string, cents: number, interval: string, key: string | null, active = true, metadata: Record<string, string> = {}): Price {
  return { id, product, unit_amount: cents, currency: "usd", recurring: { interval, interval_count: 1 }, lookup_key: key, active, metadata, tax_behavior: "exclusive" };
}

/**
 * Every key on its configured price, except Nosy Bat's, still on $22 / $211.20.
 * Old prices: Nosy Bat's first $22.40 (archived, one cancelled subscription),
 * Starter's $79 (active, two subscribers), and a price on Agency's product that
 * is not ours (no metadata[app]).
 */
function world() {
  Object.assign(W, { products: [], prices: [], subs: [], rows: [], writes: [], seq: 0 });
  for (const s of PLAN_PRICE_SPECS) {
    W.products.push({ id: `prod_${s.planTier}`, metadata: OURS(s.planTier), active: true });
    for (const interval of ["month", "year"] as const) {
      const old = s.plan === "NOSY_BAT";
      const cents = old ? (interval === "month" ? 2200 : 21120) : amountFor(s, interval);
      const id = `price_${s.planTier}_${interval}${old ? "_22" : ""}`;
      W.prices.push(price(id, `prod_${s.planTier}`, cents, interval, lookupKeyFor(s, interval), true, OURS(s.planTier)));
      W.rows.push({ id: ++W.seq, stripePriceId: id, planTier: s.planTier, currency: "USD", interval, active: true });
    }
  }
  W.prices.push(price("price_nosy_bat_month_2240", "prod_nosy_bat", 2240, "month", null, false, OURS("nosy_bat")));
  W.subs.push({ price: "price_nosy_bat_month_2240", status: "canceled" });
  W.prices.push(price("price_starter_month_79", "prod_starter", 7900, "month", null, true, OURS("starter")));
  W.rows.push({ id: ++W.seq, stripePriceId: "price_starter_month_79", planTier: "starter", currency: "USD", interval: "month", active: false });
  W.subs.push({ price: "price_starter_month_79", status: "active" }, { price: "price_starter_month_79", status: "trialing" });
  W.prices.push(price("price_foreign", "prod_agency", 9900, "month", null, true, {}));
}

let out: string[];
beforeEach(() => {
  world();
  out = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void out.push(a.join(" ")));
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void out.push(a.join(" ")));
  vi.spyOn(process, "exit").mockImplementation(((code: number) => {
    throw new Error(`exit ${code}`);
  }) as never);
  delete process.env.DOTENV_CONFIG_PATH;
  process.env.STRIPE_API_KEY = "sk_live_fake";
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.STRIPE_API_KEY;
});

const text = () => out.join("\n");
const nbKey = (interval: "month" | "year") => W.prices.find((p) => p.lookup_key === `echorank_nosy_bat_usd_${interval}`)!;

describe("--dry-run", () => {
  it("writes nothing, and prints exactly what a live run would create and archive", async () => {
    const before = JSON.stringify([W.prices, W.rows]);
    await main(["--dry-run"]);
    expect(W.writes).toEqual([]);
    expect(JSON.stringify([W.prices, W.rows])).toBe(before);
    const t = text();
    expect(t).toContain("Mode: LIVE (STRIPE_API_KEY) — DRY RUN");
    expect(t).toContain("WOULD create price $15.00/month on prod_nosy_bat, lookup_key echorank_nosy_bat_usd_month, transfer_lookup_key=true (moves it off price_nosy_bat_month_22)");
    expect(t).toContain("WOULD create price $144.00/year on prod_nosy_bat, lookup_key echorank_nosy_bat_usd_year, transfer_lookup_key=true (moves it off price_nosy_bat_year_22)");
    expect(t).toMatch(/superseded price_nosy_bat_month_22 \$22\.00\/month; subscriptions: none\n\s+WOULD archive it/);
    expect(t).toMatch(/superseded price_starter_month_79 \$79\.00\/month; subscriptions: active 1, trialing 1\n\s+left active: 2 subscription\(s\) not cancelled use it/);
    expect(t).toMatch(/superseded price_foreign .*\n\s+left active: no metadata\[app\]=echorank/);
    expect(t).toContain("Summary: 2 price(s) to create, 2 to archive, 2 superseded left active, 0 CONFLICT.");
    // The Nosy Bat subscriptions report, old prices included.
    expect(t).toContain("price_nosy_bat_month_2240 $22.40 (archived before): canceled 1");
    expect(t).toContain("price_nosy_bat_month_22 $22.00 (superseded now): none");
  });
});

describe("a live run", () => {
  it("moves Nosy Bat's keys to $15 / $144, archives the unused $22 prices, keeps every row, and is idempotent", async () => {
    await main(["--live"]);
    expect([nbKey("month").unit_amount, nbKey("year").unit_amount]).toEqual([1500, 14400]);
    expect(nbKey("month").metadata).toEqual(OURS("nosy_bat"));
    expect(nbKey("month").tax_behavior).toBe("exclusive");
    const old = W.prices.find((p) => p.id === "price_nosy_bat_month_22")!;
    expect([old.active, old.lookup_key]).toEqual([false, null]);
    // In use, or not ours: left active.
    expect(W.prices.find((p) => p.id === "price_starter_month_79")!.active).toBe(true);
    expect(W.prices.find((p) => p.id === "price_foreign")!.active).toBe(true);
    // Rows: the new prices active, the $22 rows kept inactive, ten active.
    expect(W.rows.find((r) => r.stripePriceId === nbKey("month").id)!.active).toBe(true);
    expect(W.rows.find((r) => r.stripePriceId === "price_nosy_bat_month_22")!.active).toBe(false);
    expect(W.rows.filter((r) => r.active)).toHaveLength(10);
    expect(text()).toContain("Assertion passed.");
    expect(W.writes.filter((w) => w.startsWith("price.create"))).toEqual(["price.create echorank_nosy_bat_usd_month 1500", "price.create echorank_nosy_bat_usd_year 14400"]);

    W.writes = [];
    await main(["--live"]);
    expect(W.writes).toEqual([]);
    expect(text()).toContain("Assertion passed.");
  });

  it("never writes on a live key without --live", async () => {
    await expect(main([])).rejects.toThrow("exit 1");
    expect(W.writes).toEqual([]);
  });

  it("refuses a test key's write run against the app's .env", async () => {
    process.env.STRIPE_API_KEY = "sk_test_fake";
    await expect(main([])).rejects.toThrow("exit 1");
    expect(text()).toContain("test price ids in the live catalog");
    expect(W.writes).toEqual([]);
  });

  it("a key held by a price that is not ours is a CONFLICT: nothing is written", async () => {
    W.prices.find((p) => p.id === "price_growth_month")!.metadata = {};
    await expect(main(["--live"])).rejects.toThrow("exit 1");
    expect(text()).toContain("CONFLICT: price_growth_month holds echorank_growth_usd_month without metadata[app]=echorank");
    expect(W.writes).toEqual([]);
  });
});
