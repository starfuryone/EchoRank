// src/lib/bot-analytics/ip-ranges.ts
//
// Verifying a crawler's claim against the operator's published IP ranges.
//
// Why bother: "Googlebot" in a User-Agent is a string, and anything can send it.
// Scrapers impersonate Googlebot constantly because sites whitelist it. If we
// reported UA counts as fact, the headline "Googlebot crawled you 4,000 times"
// could be one scraper wearing a hat, and the tenant would draw exactly the wrong
// conclusion about their search coverage.
//
// Google and Microsoft both publish their ranges as JSON, so this is the cheap
// case the spec asks for. Nobody else does — OpenAI, Anthropic and Perplexity
// publish ranges irregularly or not at all — so every other crawler is counted on
// its User-Agent alone and the UI says so rather than implying the same
// confidence for all of them.
//
// Failure is not an error: if the range list cannot be fetched, every hit is
// reported unverified. Silently treating unverifiable hits as verified would
// erase the distinction this file exists to draw.

import { getRedisConnection } from "@/infrastructure/redis/connection";

/** Published range endpoints. Both are static JSON, no auth, no quota. */
const RANGE_SOURCES: Record<string, string> = {
  Googlebot: "https://developers.google.com/static/search/apis/ipranges/googlebot.json",
  Bingbot: "https://www.bing.com/toolbox/bingbot.json",
};

const CACHE_TTL_SECONDS = 24 * 60 * 60;
const FETCH_TIMEOUT_MS = 8_000;

function cacheKey(token: string): string {
  return `echorank:bot-analytics:ipranges:${token}`;
}

// ─── CIDR matching ──────────────────────────────────────────────────────────
//
// Addresses are compared as BINARY STRINGS: an IPv4 becomes 32 characters of
// "0"/"1", an IPv6 becomes 128, and "is this IP in this block" is a prefix
// comparison of the first N characters. BigInt would be the obvious tool, but
// this repo targets ES2017 where BigInt literals are unavailable, and changing
// the compile target of a production app to tidy one file is the wrong trade.
// String prefixes are also simply easier to read than shift-and-mask.
//
// Cost is fine at the scale this runs: the published lists are a few hundred
// prefixes, and the matcher memoizes per IP, so a log with a million Googlebot
// hits from fifty crawler addresses does fifty comparisons, not a million.

interface Cidr {
  /** The network's leading `prefix` bits, as a binary string. */
  networkBits: string;
  /** 32 for IPv4, 128 for IPv6 — an address of the other family never matches. */
  width: number;
}

function toBinary(value: number, bits: number): string {
  let out = value.toString(2);
  while (out.length < bits) out = `0${out}`;
  return out;
}

/** IPv4 → 32 binary chars. */
export function ipv4ToBits(ip: string): string | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = "";
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out += toBinary(n, 8);
  }
  return out;
}

/** IPv6 (including the ::ffff:1.2.3.4 form) → 128 binary chars. */
export function ipv6ToBits(ip: string): string | null {
  let value = ip.trim().toLowerCase();
  // Zone index (fe80::1%eth0) is not part of the address.
  value = value.split("%")[0];

  // An IPv4-mapped tail becomes two hextets so the rest of the parse is uniform.
  const v4 = /^(.*:)((?:\d{1,3}\.){3}\d{1,3})$/.exec(value);
  if (v4) {
    const tail = ipv4ToBits(v4[2]);
    if (tail === null) return null;
    const high = parseInt(tail.slice(0, 16), 2).toString(16);
    const low = parseInt(tail.slice(16), 2).toString(16);
    value = `${v4[1]}${high}:${low}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (head.some((g) => g === "") || tail.some((g) => g === "")) return null;

  let groups: string[];
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    groups = head;
  } else {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...new Array<string>(fill).fill("0"), ...tail];
  }
  if (groups.length !== 8) return null;

  let out = "";
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out += toBinary(parseInt(g, 16), 16);
  }
  return out;
}

function ipToBits(ip: string): string | null {
  return ip.includes(":") ? ipv6ToBits(ip) : ipv4ToBits(ip);
}

/** Parses "1.2.3.0/24" or "2001:db8::/32". */
export function parseCidr(value: string): Cidr | null {
  const trimmed = (value ?? "").trim();
  const slash = trimmed.lastIndexOf("/");
  if (slash <= 0) return null;
  const addr = trimmed.slice(0, slash);
  const prefix = Number(trimmed.slice(slash + 1));
  if (!Number.isInteger(prefix) || prefix < 0) return null;

  const width = addr.includes(":") ? 128 : 32;
  if (prefix > width) return null;
  const bits = ipToBits(addr);
  if (bits === null) return null;
  return { networkBits: bits.slice(0, prefix), width };
}

export function ipInCidr(ip: string, cidr: Cidr): boolean {
  const width = ip.includes(":") ? 128 : 32;
  if (width !== cidr.width) return false;
  const bits = ipToBits(ip);
  if (bits === null) return false;
  return bits.slice(0, cidr.networkBits.length) === cidr.networkBits;
}

/** Builds a matcher over a set of CIDR strings, memoized per address. */
export function cidrMatcher(cidrs: string[]): (ip: string) => boolean {
  const parsed = cidrs.map(parseCidr).filter((c): c is Cidr => c !== null);
  const memo = new Map<string, boolean>();
  return (ip: string) => {
    if (!ip) return false;
    const cached = memo.get(ip);
    if (cached !== undefined) return cached;
    let hit = false;
    for (const c of parsed) {
      if (ipInCidr(ip, c)) {
        hit = true;
        break;
      }
    }
    // Unbounded growth would matter on a log with a million distinct addresses;
    // past the cap we stop caching but keep answering.
    if (memo.size < 50_000) memo.set(ip, hit);
    return hit;
  };
}

// ─── Fetch + cache ──────────────────────────────────────────────────────────

/** Both publishers use {"prefixes":[{"ipv4Prefix"|"ipv6Prefix": "..."}]}. */
function extractPrefixes(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const prefixes = (payload as { prefixes?: unknown }).prefixes;
  if (!Array.isArray(prefixes)) return [];
  const out: string[] = [];
  for (const entry of prefixes) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    for (const key of ["ipv4Prefix", "ipv6Prefix"]) {
      const v = e[key];
      if (typeof v === "string" && v.includes("/")) out.push(v);
    }
  }
  return out;
}

async function loadRanges(token: string): Promise<string[] | null> {
  const url = RANGE_SOURCES[token];
  if (!url) return null;

  const key = cacheKey(token);
  try {
    const cached = await getRedisConnection().get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as unknown;
      if (Array.isArray(parsed)) return parsed as string[];
    }
  } catch {
    // Cache miss or Redis down — fall through to the network.
  }

  let prefixes: string[] = [];
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    prefixes = extractPrefixes(await res.json());
  } catch {
    return null;
  }
  if (prefixes.length === 0) return null;

  try {
    await getRedisConnection().set(key, JSON.stringify(prefixes), "EX", CACHE_TTL_SECONDS);
  } catch {
    // Verification still works this run; the next one re-fetches.
  }
  return prefixes;
}

/**
 * Builds the verifier the parser's aggregate() takes.
 *
 * Returns `true`/`false` for the bots we can check, and `null` for everything
 * else — null meaning "not verifiable", which the aggregate counts as unverified
 * and the UI labels as a UA claim.
 */
export async function buildIpVerifier(): Promise<
  (token: string, ip: string) => boolean | null
> {
  const matchers = new Map<string, (ip: string) => boolean>();
  await Promise.all(
    Object.keys(RANGE_SOURCES).map(async (token) => {
      const ranges = await loadRanges(token);
      if (ranges) matchers.set(token, cidrMatcher(ranges));
    }),
  );

  return (token: string, ip: string) => {
    const matcher = matchers.get(token);
    if (!matcher) return null;
    return matcher(ip);
  };
}
