// The Website Authority Checker's routes: what each request may spend, in
// what order, and what each visitor sees. The DataForSEO layer (data.ts) is
// replaced by a fake that counts purchases; Redis by a map.
import { beforeEach, describe, expect, it, vi } from "vitest";

const kv = vi.hoisted(() => new Map<string, string>());
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => ({
    get: async (k: string) => kv.get(k) ?? null,
    set: async (k: string, v: string) => {
      kv.set(k, v);
      return "OK";
    },
  }),
}));

const turnstile = vi.hoisted(() => ({ outcome: "ok" as "ok" | "failed" | "unconfigured" }));
vi.mock("@/lib/snapshot/turnstile", () => ({ verifyTurnstile: async () => turnstile.outcome }));

const limits = vi.hoisted(() => ({ consumed: [] as [string, string, number][], refunded: [] as string[], deny: null as null | "rate_limited" | "unavailable" }));
vi.mock("@/lib/free-tools/limits", async (orig) => ({
  ...(await orig<typeof import("@/lib/free-tools/limits")>()),
  consumeDailyLimit: async (tool: string, ip: string, n: number) => {
    limits.consumed.push([tool, ip, n]);
    return limits.deny ? { ok: false, reason: limits.deny } : { ok: true };
  },
  refundDailyLimit: async (tool: string) => {
    limits.refunded.push(tool);
  },
}));

// The data layer: a cache of known facts, and a log of what was bought.
const data = vi.hoisted(() => ({
  ranks: new Map<string, number | null>(),
  links: new Map<string, { referringDomains: number; backlinks: number; dofollowShare: number | null }>(),
  ref: new Map<string, { domain: string; authority: number | null; backlinks: number }[]>(),
  bought: [] as string[],
  exhausted: false,
  fail: null as null | Error,
}));
vi.mock("@/lib/authority-checker/data", () => ({
  cachedRanks: async (domains: string[]) => ({
    known: Object.fromEntries(domains.filter((d) => data.ranks.has(d)).map((d) => [d, data.ranks.get(d)!])),
    missing: domains.filter((d) => !data.ranks.has(d)),
  }),
  buyRanks: async (domains: string[]) => {
    if (domains.length === 0) return {};
    if (data.fail) throw data.fail;
    data.bought.push(`ranks:${domains.join(",")}`);
    return Object.fromEntries(domains.map((d) => [d, 50]));
  },
  cachedLinks: async (d: string) => data.links.get(d) ?? null,
  buyLinks: async (d: string) => {
    if (data.fail) throw data.fail;
    data.bought.push(`links:${d}`);
    return { referringDomains: 7, backlinks: 70, dofollowShare: 0.5 };
  },
  cachedRefDomains: async (d: string) => data.ref.get(d) ?? null,
  buyRefDomains: async (d: string) => {
    data.bought.push(`ref:${d}`);
    return [{ domain: "r.com", authority: 80, backlinks: 2 }];
  },
  budgetState: async () => ({ spent: data.exhausted ? 3 : 0, budget: 3, exhausted: data.exhausted }),
  alertIfNearBudget: async () => false,
}));

const leads = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    freeCrawlLead: {
      upsert: async (q: { create: Record<string, unknown> }) => {
        leads.rows.push(q.create);
        return { id: "l1", doiRequestedAt: null };
      },
      update: async () => ({}),
    },
  },
}));
vi.mock("@/lib/site-crawler/free-result", () => ({ requestDoubleOptIn: async () => "skipped" }));

import { POST as check } from "@/app/api/free/v1/authority-checker/route";
import { GET as read } from "@/app/api/free/v1/authority-checker/[token]/route";
import { POST as unlock } from "@/app/api/free/v1/authority-checker/[token]/unlock/route";
import { GET as pdf } from "@/app/api/free/v1/authority-checker/[token]/pdf/route";
import { DataforseoError } from "@/lib/dataforseo/client";
import { AUTHORITY_COPY } from "@/lib/authority-checker/copy";
import { unlockCookieName } from "@/lib/authority-checker/store";

const json = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://echorank360.com${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.9", ...headers },
    body: JSON.stringify(body),
  });
const params = (token: string) => ({ params: Promise.resolve({ token }) });
const newCheck = (body: Record<string, unknown> = {}) =>
  check(json("/api/free/v1/authority-checker", { domain: "a.com", competitors: ["b.com", "c.com"], turnstileToken: "t", locale: "en", ...body }));

beforeEach(() => {
  kv.clear();
  turnstile.outcome = "ok";
  limits.consumed = [];
  limits.refunded = [];
  limits.deny = null;
  data.ranks.clear();
  data.links.clear();
  data.ref.clear();
  data.bought = [];
  data.exhausted = false;
  data.fail = null;
  leads.rows = [];
  process.env.AUTH_SECRET = "test-secret";
});

describe("POST a check", () => {
  it("buys one bulk_ranks for the uncached domains and the summary, using one of the 10 daily checks", async () => {
    data.ranks.set("b.com", 61);
    const res = await newCheck();
    expect(res.status).toBe(200);
    const view = await res.json();
    expect(data.bought).toEqual(["ranks:a.com,c.com", "links:a.com"]);
    expect(limits.consumed).toEqual([["authority-checker", "203.0.113.9", 10]]);
    expect(view).toMatchObject({ domain: "a.com", competitors: ["b.com", "c.com"], authority: 50, unlocked: false, full: null });
    expect(view.links).toEqual({ referringDomains: 7, backlinks: 70, dofollowShare: 0.5 });
    expect(view.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("a fully cached check is free: no purchase, no allowance used (Turnstile still required)", async () => {
    for (const d of ["a.com", "b.com", "c.com"]) data.ranks.set(d, 30);
    data.links.set("a.com", { referringDomains: 1, backlinks: 2, dofollowShare: 1 });
    const res = await newCheck();
    expect(res.status).toBe(200);
    expect(data.bought).toEqual([]);
    expect(limits.consumed).toEqual([]);
    turnstile.outcome = "failed";
    expect((await newCheck()).status).toBe(403);
  });

  it("the day's budget spent: a friendly back-tomorrow, before any allowance or purchase", async () => {
    data.exhausted = true;
    const res = await newCheck({ locale: "fr" });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ code: "budget", error: AUTHORITY_COPY.fr.errors.budget });
    expect(limits.consumed).toEqual([]);
    expect(data.bought).toEqual([]);
  });

  it("the metering's own cap reads as the same budget message; other failures refund the check", async () => {
    data.fail = new DataforseoError("Monthly SEO data budget reached for this workspace", "RATE_LIMITED");
    const capped = await newCheck();
    expect((await capped.json()).code).toBe("budget");
    data.fail = new DataforseoError("boom", "UPSTREAM_UNAVAILABLE");
    const down = await newCheck();
    expect(down.status).toBe(503);
    expect((await down.json()).code).toBe("upstream");
    expect(limits.refunded).toEqual(["authority-checker", "authority-checker"]);
  });

  it("refuses bad input, the 11th check, a missing IP and an unconfigured Turnstile", async () => {
    expect((await newCheck({ domain: "not a domain" })).status).toBe(400);
    expect((await (await newCheck({ competitors: ["b.com", "c.com", "d.com", "e.com"] })).json()).code).toBe("too_many_competitors");
    limits.deny = "rate_limited";
    expect((await (await newCheck()).json()).code).toBe("rate_limited");
    limits.deny = null;
    const noIp = await check(new Request("https://echorank360.com/api/free/v1/authority-checker", { method: "POST", body: JSON.stringify({ domain: "a.com" }) }));
    expect(noIp.status).toBe(403);
    turnstile.outcome = "unconfigured";
    expect((await newCheck()).status).toBe(503);
  });
});

describe("the email unlock", () => {
  async function stored() {
    const view = await (await newCheck()).json();
    data.bought = [];
    return view.token as string;
  }

  it("stores the lead, sets the cookie, buys the top 10 and the competitors' summaries, and shows them", async () => {
    const token = await stored();
    data.links.set("c.com", { referringDomains: 3, backlinks: 30, dofollowShare: 0.2 });
    const res = await unlock(json(`/x`, { email: "Ann@Agency.example", consent: true, locale: "en" }), params(token));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain(`${unlockCookieName(token)}=`);
    expect(cookie).toContain("HttpOnly");
    expect(data.bought).toEqual(["ref:a.com", "links:b.com"]);
    expect(leads.rows).toEqual([expect.objectContaining({ email: "ann@agency.example", domain: "a.com", source: "authority-checker", marketingConsent: true })]);
    const view = await res.json();
    expect(view.unlocked).toBe(true);
    expect(view.full.referringDomains).toEqual([{ domain: "r.com", authority: 80, backlinks: 2 }]);
    expect(view.full.comparison.map((r: { domain: string }) => r.domain)).toEqual(["a.com", "b.com", "c.com"]);

    // The same browser reads it back; another browser does not.
    const withCookie = new Request(`https://echorank360.com/x`, { headers: { cookie: cookie.split(";")[0] } });
    expect((await (await read(withCookie, params(token))).json()).full).not.toBeNull();
    expect((await (await read(new Request("https://echorank360.com/x"), params(token))).json()).full).toBeNull();
  });

  it("blocked-country rule: an EU/EEA/UK visitor unlocks, but no lead is stored", async () => {
    const token = await stored();
    const res = await unlock(json(`/x`, { email: "a@b.de" }, { "cf-ipcountry": "DE" }), params(token));
    expect(res.status).toBe(200);
    expect(leads.rows).toEqual([]);
  });

  it("budget spent at unlock: unlocked, the full section pending, nothing bought; a retry needs no email", async () => {
    const token = await stored();
    data.exhausted = true;
    const res = await unlock(json(`/x`, { email: "a@b.com" }), params(token));
    const view = await res.json();
    expect(view).toMatchObject({ unlocked: true, full: null, fullPending: true, notice: "budget" });
    expect(data.bought).toEqual([]);
    data.exhausted = false;
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const retry = await unlock(json(`/x`, { email: "" }, { cookie }), params(token));
    expect((await retry.json()).full).not.toBeNull();
    // Without the cookie an email is required.
    expect((await unlock(json(`/x`, { email: "" }), params(token))).status).toBe(400);
  });

  it("an unknown token is 404; the PDF needs the cookie and the full section", async () => {
    expect((await unlock(json(`/x`, { email: "a@b.com" }), params("x".repeat(22)))).status).toBe(404);
    const token = await stored();
    expect((await pdf(new Request("https://echorank360.com/x"), params(token))).status).toBe(403);
  });
});
