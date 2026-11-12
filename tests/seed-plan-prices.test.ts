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
  products: [] as { id: string; name?: string; metadata: Record<string, string>; active: boolean }[],
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
      retrieve: async (id: string) => {
        const p = W.products.find((x) => x.id === id);
        if (!p) throw new Error("no such product");
        return { ...p, name: p.name ?? id };
      },
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
      update: async (id: string, u: { active?: boolean; metadata?: Record<string, string> }) => {
        W.writes.push(u.metadata ? `price.update ${id} metadata=${JSON.stringify(u.metadata)}` : `price.update ${id} active=${u.active}`);
        const p = W.prices.find((x) => x.id === id)!;
        if (u.active !== undefined) p.active = u.active;
        // Stripe merges metadata keys on update.
        if (u.metadata) p.metadata = { ...p.metadata, ...u.metadata };
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
    expect(text()).toContain("--adopt-legacy checks whether it is a legacy Echorank price");
    expect(W.writes).toEqual([]);
  });
});

// ── --adopt-legacy ───────────────────────────────────────────────────────────

/** The 2026-11-12 dry run's July prices: [tier, interval, July cents]. */
const JULY: [string, "month" | "year", number][] = [
  ["ai_visibility", "month", 2900],
  ["starter", "month", 7900],
  ["starter", "year", 75600],
  ["growth", "month", 19900],
  ["growth", "year", 190800],
  ["agency", "month", 49900],
  ["agency", "year", 478800],
];

/**
 * What the live account looks like: seven July prices (43e421e, before the
 * app tag) hold their keys without metadata[app], on July products named
 * "Echorank360 …" with no app metadata, and the catalog rows point at them.
 * AI Visibility's yearly key and Nosy Bat's two keys are ours, on old amounts.
 * Old subscriptions are cancelled ones only.
 */
function legacyWorld() {
  Object.assign(W, { products: [], prices: [], subs: [], rows: [], writes: [], seq: 0 });
  const julyProduct = (tier: string) => `prod_july_${tier}`;
  for (const s of PLAN_PRICE_SPECS) {
    const july = JULY.filter(([t]) => t === s.planTier);
    if (july.length) W.products.push({ id: julyProduct(s.planTier), name: `Echorank360 ${s.label}`, metadata: { tier: s.planTier }, active: true });
    for (const interval of ["month", "year"] as const) {
      const legacy = july.find(([, i]) => i === interval);
      let id: string;
      if (legacy) {
        id = `price_july_${s.planTier}_${interval}`;
        W.prices.push(price(id, julyProduct(s.planTier), legacy[2], interval, lookupKeyFor(s, interval)));
        W.subs.push({ price: id, status: "canceled" });
      } else {
        // Ours, on an old amount: AI Visibility yearly ($276), Nosy Bat ($22 / $211.20).
        const product = july.length ? julyProduct(s.planTier) : `prod_${s.planTier}`;
        if (!july.length && !W.products.some((p) => p.id === product)) W.products.push({ id: product, name: `Echorank360 ${s.label}`, metadata: OURS(s.planTier), active: true });
        const cents = s.plan === "NOSY_BAT" ? (interval === "month" ? 2200 : 21120) : 27600;
        id = `price_old_${s.planTier}_${interval}`;
        W.prices.push(price(id, product, cents, interval, lookupKeyFor(s, interval), true, OURS(s.planTier)));
      }
      W.rows.push({ id: ++W.seq, stripePriceId: id, planTier: s.planTier, currency: "USD", interval, active: true });
    }
  }
}

describe("--adopt-legacy", () => {
  beforeEach(legacyWorld);

  it("without the flag, the seven July prices are CONFLICTs, as on the live account", async () => {
    await main(["--dry-run"]);
    expect(text()).toMatch(/Summary: \d+ price\(s\) to create, \d+ to archive, \d+ superseded left active, 7 CONFLICT\./);
  });

  it("--dry-run prints, per July price, its product, the four checks and WOULD adopt; plans 10 / 10 / 0 CONFLICT; writes nothing", async () => {
    const before = JSON.stringify([W.prices, W.rows]);
    await main(["--dry-run", "--adopt-legacy"]);
    expect(W.writes).toEqual([]);
    expect(JSON.stringify([W.prices, W.rows])).toBe(before);
    const t = text();
    for (const [tier, interval] of JULY) {
      const id = `price_july_${tier}_${interval}`;
      const block = t.slice(t.indexOf(`legacy price ${id}`));
      expect(block).toMatch(new RegExp(`^legacy price ${id} \\(no metadata\\[app\\]\\): product prod_july_${tier} "Echorank360 [^"]+"`));
      expect(block).toContain(`[ok] lookup_key starts with echorank_: echorank_${tier}_usd_${interval}`);
      expect(block).toContain(`[ok] product identifies Echorank (name or metadata): name "Echorank360`);
      expect(block).toContain(`[ok] product is the one the active ${tier} catalog rows point at: rows point at prod_july_${tier}`);
      expect(block).toContain("[ok] currency is usd: usd");
      expect(block).toMatch(/^[^\n]*\n(\s+\[ok\][^\n]*\n){4}\s+WOULD adopt \(set metadata\[app\]=echorank\)/);
      expect(t).toMatch(new RegExp(`superseded ${id} [^\\n]*; subscriptions: canceled 1\\n\\s+WOULD archive it`));
    }
    expect(t).toContain("Summary: 10 price(s) to create, 10 to archive, 0 superseded left active, 0 CONFLICT. 7 legacy price(s) to adopt, 0 refused.");
  });

  it("a live run adopts first, then reprices every key and archives the old prices; subscriptions untouched; a rerun changes nothing", async () => {
    await main(["--live", "--adopt-legacy"]);
    const t = text();
    expect(t).toContain("Assertion passed.");
    // The adoptions come before any other write, and set only the tag.
    const firstOther = W.writes.findIndex((w) => !w.includes("metadata="));
    expect(W.writes.slice(0, firstOther)).toEqual(JULY.map(([tier, interval]) => `price.update price_july_${tier}_${interval} metadata={"app":"echorank"}`));
    expect(W.writes.slice(firstOther).some((w) => w.includes("metadata="))).toBe(false);
    for (const [tier, interval, cents] of JULY) {
      const old = W.prices.find((p) => p.id === `price_july_${tier}_${interval}`)!;
      expect(old.metadata).toEqual({ app: "echorank" });
      expect([old.unit_amount, old.active, old.lookup_key]).toEqual([cents, false, null]);
      const spec = PLAN_PRICE_SPECS.find((s) => s.planTier === tier)!;
      const now = W.prices.find((p) => p.lookup_key === lookupKeyFor(spec, interval))!;
      expect([now.unit_amount, now.product, now.metadata.app]).toEqual([amountFor(spec, interval), `prod_july_${tier}`, "echorank"]);
    }
    expect(W.writes.filter((w) => w.startsWith("price.create"))).toHaveLength(10);
    expect(W.writes.filter((w) => w.endsWith("active=false"))).toHaveLength(10);
    expect(W.rows.filter((r) => r.active)).toHaveLength(10);
    expect(W.subs.every((s) => s.status === "canceled")).toBe(true);

    W.writes = [];
    await main(["--live", "--adopt-legacy"]);
    expect(W.writes).toEqual([]);
  });

  it("a July price still billing is adopted but left active, nobody moved", async () => {
    W.subs.push({ price: "price_july_starter_month", status: "active" });
    await main(["--dry-run", "--adopt-legacy"]);
    expect(text()).toMatch(/superseded price_july_starter_month [^\n]*active 1[^\n]*\n\s+left active: 1 subscription\(s\) not cancelled use it/);
    expect(text()).toContain("Summary: 10 price(s) to create, 9 to archive, 1 superseded left active, 0 CONFLICT.");
  });

  it.each([
    // The product is shared by both Growth prices, so both are refused.
    ["the product is not Echorank's", () => {
      const p = W.products.find((x) => x.id === "prod_july_growth")!;
      Object.assign(p, { name: "Other App Pro", metadata: {} });
    }, "product identifies Echorank (name or metadata)", 'name "Other App Pro", no Echorank metadata', 2],
    // The key holder sits on another product, and the catalog row sells a
    // price on the July product: not the product the app sells.
    ["the product is not the one the catalog rows point at", () => {
      W.products.push({ id: "prod_elsewhere", name: "Echorank360 Growth (copy)", metadata: {}, active: true });
      W.prices.find((x) => x.id === "price_july_growth_month")!.product = "prod_elsewhere";
      W.prices.push(price("price_july_growth_month_row", "prod_july_growth", 19900, "month", null));
      W.rows.find((r) => r.stripePriceId === "price_july_growth_month")!.stripePriceId = "price_july_growth_month_row";
    }, "product is the one the active growth catalog rows point at", "rows point at prod_july_growth", 1],
    ["the currency is not usd", () => {
      W.prices.find((x) => x.id === "price_july_growth_month")!.currency = "eur";
    }, "currency is usd", "eur", 1],
  ] as const)("REFUSES when %s: says why, stays a CONFLICT, and a run writes nothing", async (_l, change, label, detail, refused) => {
    change();
    await main(["--dry-run", "--adopt-legacy"]);
    const t = text();
    expect(t).toContain(`[FAIL] ${label}: ${detail}`);
    expect(t).toContain(`REFUSE: left as it is (${label})`);
    expect(t).toContain(`CONFLICT: price_july_growth_month holds echorank_growth_usd_month without metadata[app]=echorank, and is not adopted (failed: ${label})`);
    expect(t).toContain(`${refused} CONFLICT. ${7 - refused} legacy price(s) to adopt, ${refused} refused.`);

    out = [];
    await expect(main(["--live", "--adopt-legacy"])).rejects.toThrow("exit 1");
    expect(text()).toContain("CONFLICT: nothing written (no price adopted either)");
    expect(W.writes).toEqual([]);
  });
});
