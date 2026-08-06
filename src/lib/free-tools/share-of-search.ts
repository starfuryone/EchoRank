// src/lib/free-tools/share-of-search.ts
//
// Share of Search: how much of a category's search demand each brand owns.
//
// CACHED PER BRAND, NOT PER BRAND-SET. Two visitors comparing
// {nike, adidas, puma} and {nike, adidas, reebok} share four of six lookups.
// Keying the cache on the set would have bought "nike" twice; keying it on the
// brand means the second run costs one call instead of three. This is the
// spendiest free tool, so the difference is the whole budget.
//
// The consequence worth stating: a partial cache hit still spends. The route
// therefore consults the cap whenever ANY brand is missing, and only skips the
// limiter when EVERY brand was already known.

import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import { ADS } from "@/lib/dataforseo/endpoints";
import { SEVEN_DAYS, cacheKey, readCache, writeCache } from "./cache";
import { FREE_TOOLS_TENANT_ID } from "./spend";

// Re-exported from public-constants.ts: the form component needs these, and
// importing them from here would pull the metering stack into the browser.
export { MIN_BRANDS, MAX_BRANDS } from "./public-constants";

export interface BrandVolume {
  brand: string;
  volume: number;
  /** Present when DataForSEO returned a 12-month series. */
  monthly: { year: number; month: number; volume: number }[] | null;
  cached: boolean;
}

export interface ShareOfSearchResult {
  brands: (BrandVolume & { share: number })[];
  total: number;
  /** True when nothing had to be bought. */
  fullyCached: boolean;
}

interface VolumeRow {
  keyword?: unknown;
  search_volume?: unknown;
  monthly_searches?: { year?: unknown; month?: unknown; search_volume?: unknown }[];
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Normalize a brand for both the cache key and the API lookup. */
export function normalizeBrand(brand: string): string {
  return brand.trim().toLowerCase().replace(/\s+/g, " ");
}

export function brandCacheKey(brand: string, locationCode: number): string {
  return cacheKey("sos", normalizeBrand(brand), locationCode);
}

/** Turn one API row into the shape we cache. */
export function parseVolumeRow(row: VolumeRow): Omit<BrandVolume, "brand" | "cached"> {
  const monthly = Array.isArray(row.monthly_searches)
    ? row.monthly_searches
        .map((m) => ({ year: num(m.year), month: num(m.month), volume: num(m.search_volume) }))
        .filter((m) => m.year > 0 && m.month > 0)
    : null;

  return {
    volume: num(row.search_volume),
    monthly: monthly && monthly.length > 0 ? monthly : null,
  };
}

/**
 * Fetch volumes for the brands that are not already cached.
 *
 * One API call for all missing brands — search_volume takes an array, so five
 * uncached brands cost one request, not five.
 */
export async function fetchMissingVolumes(
  missing: string[],
  locationCode: number,
): Promise<Map<string, Omit<BrandVolume, "brand" | "cached">>> {
  const out = new Map<string, Omit<BrandVolume, "brand" | "cached">>();
  if (missing.length === 0) return out;

  // seoMeteredCallResult writes the SeoApiCall row itself, against the sentinel
  // tenant — so free spend lands in the same ledger every paid call does, and
  // the tenant monthly cap acts as a second ceiling under our daily one.
  const result = await seoMeteredCallResult<VolumeRow[]>(
    FREE_TOOLS_TENANT_ID,
    ADS.searchVolume,
    { keywords: missing, location_code: locationCode, language_code: "en" },
  );

  for (const row of result.data ?? []) {
    const keyword = typeof row.keyword === "string" ? normalizeBrand(row.keyword) : "";
    if (!keyword) continue;
    out.set(keyword, parseVolumeRow(row));
  }

  // A brand the API knows nothing about is a real answer — zero volume — and is
  // cached so the next visitor does not buy the same silence.
  for (const brand of missing) {
    const key = normalizeBrand(brand);
    if (!out.has(key)) out.set(key, { volume: 0, monthly: null });
  }

  return out;
}

/** Percentage shares, rounded to one decimal and summing to ~100. */
export function computeShares(brands: BrandVolume[]): ShareOfSearchResult {
  const total = brands.reduce((sum, b) => sum + b.volume, 0);
  return {
    total,
    fullyCached: brands.every((b) => b.cached),
    brands: brands.map((b) => ({
      ...b,
      share: total > 0 ? Math.round((b.volume / total) * 1000) / 10 : 0,
    })),
  };
}

/** Read whatever is already cached; report which brands still need buying. */
export async function readCachedBrands(
  brands: string[],
  locationCode: number,
): Promise<{ known: Map<string, BrandVolume>; missing: string[] }> {
  const known = new Map<string, BrandVolume>();
  const missing: string[] = [];

  for (const brand of brands) {
    const key = brandCacheKey(brand, locationCode);
    const hit = await readCache<Omit<BrandVolume, "brand" | "cached">>(key);
    if (hit) {
      known.set(normalizeBrand(brand), { brand, cached: true, ...hit });
    } else {
      missing.push(brand);
    }
  }

  return { known, missing };
}

export async function cacheBrand(
  brand: string,
  locationCode: number,
  value: Omit<BrandVolume, "brand" | "cached">,
): Promise<void> {
  await writeCache(brandCacheKey(brand, locationCode), value, SEVEN_DAYS);
}

export { FREE_TOOLS_TENANT_ID };
