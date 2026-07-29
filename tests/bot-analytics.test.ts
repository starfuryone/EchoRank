// Bot Analytics — the active access check.
//
// Covers the four things that can be wrong without anyone noticing in the UI:
//   1. verdict precedence, especially the two cases where robots.txt and the
//      probe disagree (that disagreement IS the product);
//   2. the SSRF guard, per rejection class;
//   3. the monthly cap, including the concurrent-click race and tenant
//      isolation of the Redis key;
//   4. the illustration convention, which the shared tool-help suite enforces
//      for the other ten tools.
//
// No network anywhere: the probe is represented by its outcome, which is the
// only thing the verdict logic is allowed to depend on.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHECK_TTL_MS,
  deriveVerdict,
  isCheckFresh,
  isProblem,
  verdictTone,
  type BotVerdict,
} from "@/lib/bot-analytics/verdict";
import {
  BOT_PROBE_SPECS,
  PROBEABLE_TOKENS,
  PROBE_DELAY_MS,
  PROBE_TIMEOUT_MS,
  probeSpec,
} from "@/lib/bot-analytics/user-agents";
import {
  guardCheckUrl,
  hostMatchesDomain,
  isPrivateIpv4,
} from "@/lib/bot-analytics/url-guard";
import { BOT_CATALOG } from "@/lib/bot-catalog";
import { BotAnalyticsArt } from "@/components/seo-tools/help-illustrations/bot-analytics";

// ─── Redis double, shared by the quota tests ────────────────────────────────
const redisStore = new Map<string, number>();
const redisFails = { incr: false };
const redis = {
  incr: vi.fn(async (key: string) => {
    if (redisFails.incr) throw new Error("redis down");
    const next = (redisStore.get(key) ?? 0) + 1;
    redisStore.set(key, next);
    return next;
  }),
  decr: vi.fn(async (key: string) => {
    const next = (redisStore.get(key) ?? 0) - 1;
    redisStore.set(key, next);
    return next;
  }),
  expire: vi.fn(async () => 1),
  get: vi.fn(async (key: string) => {
    const v = redisStore.get(key);
    return v === undefined ? null : String(v);
  }),
};
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => redis,
  getSubscriberConnection: () => redis,
}));

// Imported after the mock so the module picks it up.
const {
  BOT_CHECK_MONTHLY_LIMIT,
  BotCheckQuotaUnavailableError,
  botCheckMonthKey,
  botCheckQuotaKey,
  botChecksUsed,
  releaseBotCheck,
  reserveBotCheck,
} = await import("@/lib/bot-analytics/quota");

beforeEach(() => {
  redisStore.clear();
  redisFails.incr = false;
  vi.clearAllMocks();
});

// ─── 1. Verdict derivation ──────────────────────────────────────────────────
describe("deriveVerdict", () => {
  it("robots.txt disallow wins over a successful probe", () => {
    // The case that must not report green. A 200 only proves the origin serves
    // anyone who asks; a compliant crawler reads robots.txt and never asks.
    expect(deriveVerdict("BLOCKED", { httpStatus: 200 })).toBe("blocked_robots");
    expect(deriveVerdict("BLOCKED", { httpStatus: 403 })).toBe("blocked_robots");
    expect(deriveVerdict("BLOCKED", null)).toBe("blocked_robots");
  });

  it("robots.txt allow + refused probe is blocked_http — the case robots-only checkers miss", () => {
    for (const status of [401, 403, 407, 451]) {
      expect(deriveVerdict("ALLOWED", { httpStatus: status })).toBe("blocked_http");
    }
  });

  it("separates a challenge from a flat refusal", () => {
    // Different remedy: bot-management setting vs an explicit deny rule.
    expect(deriveVerdict("ALLOWED", { httpStatus: 429 })).toBe("challenged");
    expect(deriveVerdict("ALLOWED", { httpStatus: 503 })).toBe("challenged");
    expect(deriveVerdict("ALLOWED", { httpStatus: 403 })).not.toBe("challenged");
  });

  it("treats 2xx and 3xx as reachable", () => {
    for (const status of [200, 204, 301, 302, 308, 399]) {
      expect(deriveVerdict("ALLOWED", { httpStatus: status })).toBe("allowed");
    }
  });

  it("reports an unusable probe as unknown, never as blocked", () => {
    // "We could not tell" and "you are being refused" are different facts, and
    // a tenant acting on the second when it was the first hunts a WAF rule that
    // does not exist.
    expect(deriveVerdict("ALLOWED", { httpStatus: null, error: "timeout" })).toBe("unknown");
    expect(deriveVerdict("ALLOWED", { httpStatus: 500 })).toBe("unknown");
    expect(deriveVerdict("ALLOWED", { httpStatus: 404 })).toBe("unknown");
  });

  it("preference tokens resolve from robots.txt alone", () => {
    // Nothing fetches as Google-Extended, so a null probe is the correct input
    // and must not degrade the verdict.
    expect(deriveVerdict("ALLOWED", null)).toBe("allowed");
  });

  it("classifies severity and tone consistently", () => {
    expect(isProblem("allowed")).toBe(false);
    expect(isProblem("unknown")).toBe(false);
    for (const v of ["blocked_robots", "blocked_http", "challenged"] as BotVerdict[]) {
      expect(isProblem(v)).toBe(true);
    }
    expect(verdictTone("allowed")).toBe("good");
    expect(verdictTone("challenged")).toBe("warn");
    expect(verdictTone("blocked_http")).toBe("bad");
    expect(verdictTone("blocked_robots")).toBe("bad");
    expect(verdictTone("unknown")).toBe("muted");
  });
});

describe("isCheckFresh", () => {
  const at = new Date("2026-07-29T12:00:00Z");

  it("serves a check inside the 24h window and re-probes outside it", () => {
    expect(isCheckFresh(at, new Date(at.getTime() + 1_000))).toBe(true);
    expect(isCheckFresh(at, new Date(at.getTime() + CHECK_TTL_MS - 1))).toBe(true);
    expect(isCheckFresh(at, new Date(at.getTime() + CHECK_TTL_MS))).toBe(false);
  });

  it("treats a future-stamped row as stale rather than trusting it forever", () => {
    expect(isCheckFresh(at, new Date(at.getTime() - 60_000))).toBe(false);
  });
});

// ─── 2. Probe specs ─────────────────────────────────────────────────────────
describe("bot probe specs", () => {
  it("covers every catalog token exactly once, and adds none of its own", () => {
    const catalog = BOT_CATALOG.map((b) => b.token).sort();
    expect(Object.keys(BOT_PROBE_SPECS).sort()).toEqual(catalog);
  });

  it("marks the two robots.txt-only preference tokens unprobeable", () => {
    // Probing these would mean inventing a User-Agent nobody sends and
    // reporting the result as if it meant something.
    for (const token of ["Google-Extended", "Applebot-Extended"]) {
      const spec = probeSpec(token);
      expect(spec?.probeable).toBe(false);
    }
    expect(PROBEABLE_TOKENS).not.toContain("Google-Extended");
    expect(PROBEABLE_TOKENS).not.toContain("Applebot-Extended");
  });

  it("gives every probeable bot a non-empty UA containing its own token", () => {
    for (const token of PROBEABLE_TOKENS) {
      const spec = probeSpec(token);
      expect(spec?.probeable).toBe(true);
      if (spec?.probeable) {
        expect(spec.userAgent.length).toBeGreaterThan(0);
        // WAF rules match on the token, so a UA that lost it measures nothing.
        expect(spec.userAgent.toLowerCase()).toContain(token.toLowerCase());
      }
    }
  });

  it("paces the probe politely enough not to look like the flood it measures", () => {
    expect(PROBE_DELAY_MS).toBeGreaterThanOrEqual(1_000);
    expect(PROBE_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });
});

// ─── 3. SSRF guard ──────────────────────────────────────────────────────────
describe("guardCheckUrl", () => {
  it("accepts a normal public URL and a bare host", () => {
    expect(guardCheckUrl("https://echorank360.com").ok).toBe(true);
    expect(guardCheckUrl("echorank360.com").url).toBe("https://echorank360.com/");
    expect(guardCheckUrl("http://echorank360.com/pricing").ok).toBe(true);
  });

  it("strips query and fragment so the cache key does not vary for nothing", () => {
    expect(guardCheckUrl("https://echorank360.com/a?b=1#c").url).toBe(
      "https://echorank360.com/a",
    );
  });

  it("rejects non-http schemes", () => {
    for (const u of ["file:///etc/passwd", "gopher://x.com", "data:text/html,x", "ftp://x.com"]) {
      expect(guardCheckUrl(u).reason).toBe("bad_scheme");
    }
  });

  it("rejects the cloud metadata endpoint and every private range", () => {
    for (const host of [
      "169.254.169.254", // AWS/GCP/Azure metadata
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "255.255.255.255",
      "224.0.0.1",
    ]) {
      expect(isPrivateIpv4(host)).toBe(true);
      expect(guardCheckUrl(`http://${host}/`).ok).toBe(false);
    }
  });

  it("rejects public IP literals too, so there is only one private-range list", () => {
    expect(isPrivateIpv4("8.8.8.8")).toBe(false);
    expect(guardCheckUrl("http://8.8.8.8/").reason).toBe("ip_literal");
  });

  it("rejects IPv6 literals including the mapped-loopback form", () => {
    expect(guardCheckUrl("http://[::1]/").ok).toBe(false);
    expect(guardCheckUrl("http://[::ffff:127.0.0.1]/").ok).toBe(false);
  });

  it("rejects internal hostnames and single-label hosts", () => {
    for (const h of ["localhost", "router", "db.internal", "printer.local", "x.test"]) {
      expect(guardCheckUrl(`http://${h}/`).reason).toBe("private_host");
    }
  });

  it("rejects credentials in the URL and non-default ports", () => {
    expect(guardCheckUrl("https://user:pw@echorank360.com/").reason).toBe("has_credentials");
    expect(guardCheckUrl("http://echorank360.com:6379/").reason).toBe("bad_port");
    expect(guardCheckUrl("http://echorank360.com:80/").ok).toBe(true);
    expect(guardCheckUrl("https://echorank360.com:443/").ok).toBe(true);
  });

  it("does not rewrite the scheme of a URL it would reject", () => {
    // A bare host gets https://; anything with a scheme keeps it and is judged
    // on it, so file:// can never be laundered into https://file.
    expect(guardCheckUrl("file:///etc/passwd").reason).toBe("bad_scheme");
  });

  it("confines the check to the tenant's own domain", () => {
    expect(guardCheckUrl("https://echorank360.com/", "echorank360.com").ok).toBe(true);
    expect(guardCheckUrl("https://www.echorank360.com/", "echorank360.com").ok).toBe(true);
    expect(guardCheckUrl("https://blog.echorank360.com/", "echorank360.com").ok).toBe(true);
    expect(guardCheckUrl("https://competitor.com/", "echorank360.com").reason).toBe(
      "domain_mismatch",
    );
    // Suffix-confusion: must not match on a bare endsWith.
    expect(guardCheckUrl("https://notechorank360.com/", "echorank360.com").reason).toBe(
      "domain_mismatch",
    );
    expect(guardCheckUrl("https://echorank360.com.evil.tld/", "echorank360.com").reason).toBe(
      "domain_mismatch",
    );
  });

  it("normalizes a stored domain that carries a scheme, www or trailing slash", () => {
    for (const d of ["https://echorank360.com", "www.echorank360.com", "echorank360.com/"]) {
      expect(hostMatchesDomain("echorank360.com", d)).toBe(true);
    }
  });

  it("rejects empty and unparseable input", () => {
    expect(guardCheckUrl("").reason).toBe("not_a_url");
    expect(guardCheckUrl("   ").reason).toBe("not_a_url");
    expect(guardCheckUrl("http://").reason).toBe("not_a_url");
  });
});

// ─── 4. Monthly cap ─────────────────────────────────────────────────────────
describe("bot access-check quota", () => {
  it("allows exactly the monthly limit, then refuses", async () => {
    for (let i = 1; i <= BOT_CHECK_MONTHLY_LIMIT; i++) {
      const d = await reserveBotCheck("t1");
      expect(d.allowed).toBe(true);
      expect(d.used).toBe(i);
    }
    const over = await reserveBotCheck("t1");
    expect(over.allowed).toBe(false);
    expect(over.used).toBe(BOT_CHECK_MONTHLY_LIMIT);
    expect(over.limit).toBe(BOT_CHECK_MONTHLY_LIMIT);
  });

  it("rolls the counter back when it refuses, so a rejected click costs nothing", async () => {
    for (let i = 0; i < BOT_CHECK_MONTHLY_LIMIT; i++) await reserveBotCheck("t1");
    await reserveBotCheck("t1"); // refused
    expect(await botChecksUsed("t1")).toBe(BOT_CHECK_MONTHLY_LIMIT);
  });

  it("INCRs before deciding, so concurrent clicks cannot both take the last slot", async () => {
    for (let i = 0; i < BOT_CHECK_MONTHLY_LIMIT - 1; i++) await reserveBotCheck("t1");
    const [a, b] = await Promise.all([reserveBotCheck("t1"), reserveBotCheck("t1")]);
    expect([a.allowed, b.allowed].filter(Boolean)).toHaveLength(1);
  });

  it("gives a reservation back on release", async () => {
    await reserveBotCheck("t1");
    expect(await botChecksUsed("t1")).toBe(1);
    await releaseBotCheck("t1");
    expect(await botChecksUsed("t1")).toBe(0);
  });

  it("isolates tenants — one tenant cannot spend another's allowance", async () => {
    for (let i = 0; i < BOT_CHECK_MONTHLY_LIMIT; i++) await reserveBotCheck("t1");
    expect((await reserveBotCheck("t1")).allowed).toBe(false);
    const other = await reserveBotCheck("t2");
    expect(other.allowed).toBe(true);
    expect(other.used).toBe(1);
    expect(botCheckQuotaKey("t1")).not.toBe(botCheckQuotaKey("t2"));
  });

  it("scopes the key to tenant and month", () => {
    const jan = new Date("2026-01-15T00:00:00Z");
    const dec = new Date("2026-12-15T00:00:00Z");
    expect(botCheckMonthKey(jan)).toBe("2026-01");
    expect(botCheckMonthKey(dec)).toBe("2026-12");
    expect(botCheckQuotaKey("t1", jan)).toContain("t1");
    expect(botCheckQuotaKey("t1", jan)).not.toBe(botCheckQuotaKey("t1", dec));
  });

  it("sets a TTL so the month key self-cleans", async () => {
    await reserveBotCheck("t1");
    expect(redis.expire).toHaveBeenCalled();
    const [, ttl] = redis.expire.mock.calls[0] as unknown as [string, number];
    expect(ttl).toBeGreaterThan(31 * 24 * 60 * 60);
  });

  it("fails closed when Redis is unreachable", async () => {
    // With no counter to enforce against, allowing means an uncapped request
    // loop at a customer's origin.
    redisFails.incr = true;
    await expect(reserveBotCheck("t1")).rejects.toBeInstanceOf(BotCheckQuotaUnavailableError);
  });
});

// ─── 5. Help illustration convention ────────────────────────────────────────
describe("bot-analytics illustration", () => {
  const html = renderToStaticMarkup(createElement(BotAnalyticsArt));

  it("renders", () => {
    expect(html.startsWith("<svg")).toBe(true);
    expect(html.length).toBeGreaterThan(200);
  });

  it("is decorative: aria-hidden and not focusable", () => {
    expect(html).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(html).toMatch(/^<svg[^>]*focusable="false"/);
  });

  it("uses the shared 480x150 canvas", () => {
    expect(html).toContain('viewBox="0 0 480 150"');
  });

  it("carries no translatable text — HTTP status codes only", () => {
    const texts = [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      expect(t).toMatch(/^[0-9]+$/);
    }
  });
});
