// City-scoped rank tracking: the location table, its search, and what
// actually reaches the provider.
//
// ── THE ASSERTION THAT MATTERS MOST IS ABOUT A CONTRACT, NOT A FEATURE ─────
// DataForSEO targets a COUNTRY by `location_code` and a sub-country place by
// `location_name`. They are not interchangeable, and a city's code is not
// accepted where a country's is. Get that wrong and the SERP task is posted,
// BILLED, and returns positions for the wrong place — plausible-looking
// numbers, so nobody notices until they check a ranking by hand.
//
// The second is about data nobody can invent. Every code and canonical name in
// the curated table comes from the provider's own free registry, via
// scripts/generate-locations.ts. This suite refuses anything that looks
// hand-written.

import { describe, expect, it, vi } from "vitest";

// ─── Mocks (for the task-post assertions) ───────────────────────────────────

const rankProject = { findUnique: vi.fn(), update: vi.fn() };
const rankSnapshot = { create: vi.fn() };
const tenant = { findUnique: vi.fn(async () => ({ planType: "AGENCY" })) };
vi.mock("@/lib/prisma", () => ({
  prisma: { rankProject, rankSnapshot, tenant },
}));

const seoMeteredCallResult = vi.fn();
vi.mock("@/lib/dataforseo/metering", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/metering")>()),
  seoMeteredCallResult: (...args: unknown[]) => seoMeteredCallResult(...args),
}));

// incrby/decrby, not incr/decr: the rank-tracker quota reserves a BATCH of
// checks in one call, and a stub missing them throws
// RankQuotaUnavailableError before the task post this file is about.
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => ({
    incrby: vi.fn(async () => 1),
    decrby: vi.fn(async () => 0),
    incr: vi.fn(async () => 1),
    decr: vi.fn(async () => 0),
    expire: vi.fn(async () => 1),
    get: vi.fn(async () => null),
  }),
}));

const { runProject } = await import("@/lib/rank-tracker/service");
const {
  CURATED_LOCATIONS,
  LOCATIONS_GENERATED_AT,
  hasLocalLocations,
  locationsAreStale,
} = await import("@/lib/locations/curated");
const {
  searchLocations,
  findLocationByName,
  findCountryByCode,
  availableCountries,
  MAX_INLINE_LOCATIONS,
} = await import("@/lib/locations/search");
const { serpTarget, formatLocationLabel, LOCATION_TYPES } = await import(
  "@/lib/locations/types"
);
const { SERP_LOCATION_CODES } = await import("@/lib/serp/options");
const { RANK_TRACKER_COPY } = await import("@/lib/i18n/dashboard");

const LOCALES = ["en", "fr", "de-CH"] as const;

// ─── 1. The provider contract ────────────────────────────────────────────────

describe("what actually reaches the provider", () => {
  it("sends a COUNTRY by code and everything narrower by name", () => {
    // The whole reason a keyword stores the canonical NAME. A city's code is
    // not a value the SERP endpoints accept, and sending one bills a task that
    // returns the wrong place's positions.
    expect(
      serpTarget({
        code: 2840,
        name: "United States",
        type: "Country",
        countryCode: "us",
        label: "United States",
      }),
    ).toEqual({ location_code: 2840 });

    expect(
      serpTarget({
        code: 1023191,
        name: "New York,New York,United States",
        type: "City",
        countryCode: "us",
        label: "New York, New York",
      }),
    ).toEqual({ location_name: "New York,New York,United States" });
  });

  it("posts location_name for a city-scoped keyword and location_code otherwise", async () => {
    rankProject.findUnique.mockResolvedValue({
      id: "p1",
      tenantId: "t1",
      domain: "example.com",
      locationCode: 2840,
      languageCode: "en",
      device: "desktop",
      frequency: "weekly",
      active: true,
      overCap: false,
      keywords: [
        { id: "k1", keyword: "plumber", locationName: null },
        { id: "k2", keyword: "plumber", locationName: "Enid,Oklahoma,United States" },
      ],
    });
    seoMeteredCallResult.mockResolvedValue({
      data: [],
      billing: { path: ["v3", "serp"], costUsd: 0.006 },
      taskId: "task_1",
    });

    await runProject("p1");

    const tasks = seoMeteredCallResult.mock.calls.map((c) => c[2] as Record<string, unknown>);
    const national = tasks.find((task) => !("location_name" in task));
    const local = tasks.find((task) => "location_name" in task);

    expect(national).toMatchObject({ location_code: 2840 });
    // And crucially the local one carries NO location_code: sending both is
    // ambiguous and the provider's behaviour there is not something to rely on.
    expect(local).toMatchObject({ location_name: "Enid,Oklahoma,United States" });
    expect(local).not.toHaveProperty("location_code");
  });

  it("bills the same either way — SERP pricing is per result page, not per place", async () => {
    rankProject.findUnique.mockResolvedValue({
      id: "p1",
      tenantId: "t1",
      domain: "example.com",
      locationCode: 2840,
      languageCode: "en",
      device: "desktop",
      frequency: "weekly",
      active: true,
      overCap: false,
      keywords: [{ id: "k1", keyword: "plumber", locationName: "Enid,Oklahoma,United States" }],
    });
    seoMeteredCallResult.mockResolvedValue({
      data: [],
      billing: { path: ["v3", "serp"], costUsd: 0.006 },
      taskId: "task_1",
    });
    const result = await runProject("p1");
    expect(result.costUsd).toBeCloseTo(0.006, 6);
  });
});

// ─── 2. Table integrity ──────────────────────────────────────────────────────

describe("the curated table", () => {
  it("has no duplicate canonical names", () => {
    // A name is the key a stored selection is resolved by. Two rows sharing one
    // would make the picker's choice ambiguous.
    const names = CURATED_LOCATIONS.map((location) => location.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("carries only real, positive codes and known types", () => {
    for (const location of CURATED_LOCATIONS) {
      expect(Number.isInteger(location.code), location.name).toBe(true);
      expect(location.code, location.name).toBeGreaterThan(0);
      expect(LOCATION_TYPES, location.name).toContain(location.type);
      expect(location.countryCode, location.name).toMatch(/^[a-z]{2}$/);
      expect(location.label.length, location.name).toBeGreaterThan(0);
      // The label is DERIVED from the canonical name, never typed separately —
      // otherwise the two drift and the picker shows one place while sending
      // another.
      expect(location.label, location.name).toBe(
        formatLocationLabel(location.name, 2),
      );
    }
  });

  it("covers every market the SERP Checker and Rank Tracker offer", () => {
    // A country in the picker with no entry here would leave the location
    // control empty for the market a customer actually selected.
    for (const code of SERP_LOCATION_CODES) {
      expect(findCountryByCode(code), String(code)).not.toBeNull();
    }
    expect(availableCountries().length).toBeGreaterThanOrEqual(SERP_LOCATION_CODES.length);
  });

  it("stays small enough to search in the browser", () => {
    // The picker filters this array synchronously. Past the tripwire it wants
    // a server search route instead — and the day that happens should be a
    // failing test, not a janky combobox.
    expect(CURATED_LOCATIONS.length).toBeLessThanOrEqual(MAX_INLINE_LOCATIONS);
  });

  it("reports honestly whether it has been generated", () => {
    // The whole feature ships with countries only until someone runs the
    // generator, and the UI branches on exactly this. Whichever state the
    // table is in, the two answers must agree.
    if (LOCATIONS_GENERATED_AT === null) {
      expect(hasLocalLocations()).toBe(false);
      expect(locationsAreStale()).toBe(true);
    } else {
      expect(hasLocalLocations()).toBe(true);
      expect(Number.isNaN(Date.parse(LOCATIONS_GENERATED_AT))).toBe(false);
    }
  });

  it("calls a table older than a quarter stale", () => {
    // Google refreshes its geotargets roughly quarterly.
    expect(locationsAreStale(new Date("2027-01-01"))).toBe(true);
  });
});

// ─── 3. Search ───────────────────────────────────────────────────────────────

describe("search", () => {
  const table = [
    { code: 1, name: "Portland,Maine,United States", type: "DMA Region" as const, countryCode: "us", label: "Portland, Maine" },
    { code: 2, name: "Portland,Oregon,United States", type: "City" as const, countryCode: "us", label: "Portland, Oregon" },
    { code: 3, name: "Zürich,Zurich,Switzerland", type: "City" as const, countryCode: "ch", label: "Zürich, Zurich" },
    { code: 4, name: "Sanford,Maine,United States", type: "City" as const, countryCode: "us", label: "Sanford, Maine" },
    { code: 5, name: "San Francisco,California,United States", type: "City" as const, countryCode: "us", label: "San Francisco, California" },
  ];

  it("ranks a City above a DMA Region of the same name", async () => {
    // The reference's own spec names this as its picker's weakest point:
    // searching "Portland" offers the Maine DMA before Portland, Oregon.
    // Ordering by type is most of the fix without a population table.
    vi.doMock("@/lib/locations/curated", () => ({
      CURATED_LOCATIONS: table,
      LOCATIONS_GENERATED_AT: "2026-09-01T00:00:00.000Z",
      hasLocalLocations: () => true,
      locationsAreStale: () => false,
    }));
    vi.resetModules();
    const { searchLocations: search } = await import("@/lib/locations/search");
    const results = search("Portland");
    expect(results[0].label).toBe("Portland, Oregon");
    vi.doUnmock("@/lib/locations/curated");
    vi.resetModules();
  });

  it("folds case and accents", async () => {
    vi.doMock("@/lib/locations/curated", () => ({
      CURATED_LOCATIONS: table,
      LOCATIONS_GENERATED_AT: "2026-09-01T00:00:00.000Z",
      hasLocalLocations: () => true,
      locationsAreStale: () => false,
    }));
    vi.resetModules();
    const { searchLocations: search } = await import("@/lib/locations/search");
    // A Swiss customer typing "zurich" must find "Zürich".
    expect(search("zurich").map((r) => r.label)).toContain("Zürich, Zurich");
    expect(search("SAN FRAN").map((r) => r.label)).toContain("San Francisco, California");
    vi.doUnmock("@/lib/locations/curated");
    vi.resetModules();
  });

  it("prefers a prefix match over a substring one", async () => {
    vi.doMock("@/lib/locations/curated", () => ({
      CURATED_LOCATIONS: table,
      LOCATIONS_GENERATED_AT: "2026-09-01T00:00:00.000Z",
      hasLocalLocations: () => true,
      locationsAreStale: () => false,
    }));
    vi.resetModules();
    const { searchLocations: search } = await import("@/lib/locations/search");
    // Someone typing "san" means San Francisco, not Sanford.
    expect(search("san", { countryCode: "us" })[0].label).toBe("San Francisco, California");
    vi.doUnmock("@/lib/locations/curated");
    vi.resetModules();
  });

  it("scopes to one country, so a picker cannot offer the wrong one", () => {
    for (const result of searchLocations("", { countryCode: "ca" })) {
      expect(result.countryCode).toBe("ca");
    }
  });

  it("returns something for an empty query rather than nothing", () => {
    // A picker that is blank until you type gives no hint it has anything in
    // it, which on a table this small is the wrong first impression.
    expect(searchLocations("", { countryCode: "us" }).length).toBeGreaterThan(0);
  });

  it("resolves a stored selection by its canonical name", () => {
    const country = availableCountries()[0];
    expect(findLocationByName(country.name)?.code).toBe(country.code);
    expect(findLocationByName("Nowhere,Nowhere,Nowhere")).toBeNull();
  });
});

// ─── 4. Copy ─────────────────────────────────────────────────────────────────

describe("copy", () => {
  it("covers the picker in all three catalogs", () => {
    for (const locale of LOCALES) {
      const t = RANK_TRACKER_COPY[locale];
      expect(t.locationLocalLabel.length).toBeGreaterThan(0);
      expect(t.locationLocalPlaceholder.length).toBeGreaterThan(0);
      expect(t.locationLocalHint.length).toBeGreaterThan(0);
      expect(t.locationLocalNone.length).toBeGreaterThan(0);
      expect(t.locationLocalNoMatch.length).toBeGreaterThan(0);
      expect(t.locationLocalSelected("Enid")).toContain("Enid");
      // The state this deployment is actually in until the generator runs.
      expect(t.locationLocalUnavailable.length).toBeGreaterThan(0);
    }
  });

  it("de-CH uses ss, never sz", () => {
    const t = RANK_TRACKER_COPY["de-CH"];
    for (const line of [
      t.locationLocalLabel,
      t.locationLocalHint,
      t.locationLocalNone,
      t.locationLocalUnavailable,
      t.locationLocalSelected("Zürich"),
    ]) {
      expect(line).not.toContain("ß");
    }
  });
});
