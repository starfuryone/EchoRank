// The Reddit Threads Finder, back without Reddit's API (2026-11-08): subreddit
// parsing, the DataForSEO task, the cache (a hit makes no provider call), the
// limits (Turnstile, 10 a day per IP, no cf-connecting-ip → 403, the daily
// budget), the CSV email gate with the EU/UK rule, the route table and the
// removed 301.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Redis (GET / SET with EX) ──────────────────────────────────────────────
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

// ─── Turnstile and the per-IP allowance ─────────────────────────────────────
const gate = vi.hoisted(() => ({
  turnstile: "ok" as string,
  limit: { ok: true } as { ok: true } | { ok: false; reason: string },
  consumed: [] as string[],
  refunded: [] as string[],
}));
vi.mock("@/lib/snapshot/turnstile", () => ({ verifyTurnstile: async () => gate.turnstile }));
vi.mock("@/lib/free-tools/limits", async (orig) => ({
  ...(await orig<typeof import("@/lib/free-tools/limits")>()),
  consumeDailyLimit: async (tool: string) => {
    gate.consumed.push(tool);
    return gate.limit;
  },
  refundDailyLimit: async (tool: string) => {
    gate.refunded.push(tool);
  },
}));

// ─── The metered DataForSEO call ────────────────────────────────────────────
const metered = vi.hoisted(() => ({
  calls: [] as { tenantId: string; path: string; task: Record<string, unknown> }[],
  respond: (() => []) as () => unknown,
  fail: null as Error | null,
}));
vi.mock("@/lib/dataforseo/metering", () => ({
  seoMeteredCallResult: async (tenantId: string, path: string, task: Record<string, unknown>) => {
    metered.calls.push({ tenantId, path, task });
    if (metered.fail) throw metered.fail;
    return { data: metered.respond(), billing: { path: path.split("/"), costUsd: 0.002 } };
  },
}));

// ─── Postgres: the day's spend and the leads ────────────────────────────────
const db = vi.hoisted(() => ({ spent: 0, spentWhere: null as unknown, leads: [] as Record<string, unknown>[] }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    seoApiCall: {
      aggregate: async (q: { where: unknown }) => {
        db.spentWhere = q.where;
        return { _sum: { costUsd: db.spent } };
      },
    },
    freeCrawlLead: {
      upsert: async (q: { create: Record<string, unknown> }) => {
        db.leads.push(q.create);
        return { id: "lead_1", doiRequestedAt: null };
      },
      update: async () => ({}),
    },
  },
}));
vi.mock("@/lib/site-crawler/free-result", () => ({ requestDoubleOptIn: async () => "skipped" }));

import { POST as search } from "@/app/api/free/v1/reddit-threads/route";
import { POST as csv } from "@/app/api/free/v1/reddit-threads/csv/route";
import { DataforseoError } from "@/lib/dataforseo/client";
import { SERP } from "@/lib/dataforseo/endpoints";
import { REDDIT_SEARCH_ROUTE, REDDIT_TENANT_ID, SEARCHES_PER_IP_PER_DAY, dailyBudgetUsd } from "@/lib/reddit-threads/config";
import { REDDIT_COPY } from "@/lib/reddit-threads/copy";
import { dateOf, parseRedditSerp, subredditFromUrl, threadsCsv } from "@/lib/reddit-threads/parse";
import { redditTask } from "@/lib/reddit-threads/service";
import { FREE_TOOLS_BASE, freeToolById, freeToolRoutes } from "@/lib/free-tools";
import { KNOWN_MARKETING_PATHS, LOCALIZED_ROUTES, RETIRED_LOCALIZED_PATHS } from "@/lib/seo/registry";

const ROOT = process.cwd();

const organic = (rank: number, url: string, extra: Record<string, unknown> = {}) => ({
  type: "organic",
  rank_group: rank,
  title: `Thread ${rank}`,
  url,
  description: `Snippet ${rank}`,
  timestamp: null,
  ...extra,
});

const SERP_RESULT = [
  {
    items: [
      organic(2, "https://www.reddit.com/r/smallbusiness/comments/abc/best_crm/", { timestamp: "2026-03-04 00:00:00 +00:00" }),
      organic(1, "https://www.reddit.com/r/CRM/comments/xyz/which_crm/"),
      organic(3, "https://example.com/not-reddit"),
      {
        type: "discussions_and_forums",
        items: [
          { url: "https://www.reddit.com/r/CRM/comments/xyz/which_crm/", title: "dup" },
          { url: "https://old.reddit.com/r/sales/comments/q1/crm/", title: "From the forums box" },
          { url: "https://www.quora.com/x", title: "not reddit" },
        ],
      },
    ],
  },
];

const req = (body: unknown, headers: Record<string, string> = { "cf-connecting-ip": "203.0.113.7" }) =>
  new Request("http://localhost/api/free/v1/reddit-threads", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const BODY = { keyword: "best crm", country: 2840, time: "year", turnstileToken: "t", locale: "en" };

beforeEach(() => {
  kv.clear();
  gate.turnstile = "ok";
  gate.limit = { ok: true };
  gate.consumed = [];
  gate.refunded = [];
  metered.calls = [];
  metered.respond = () => SERP_RESULT;
  metered.fail = null;
  db.spent = 0;
  db.leads = [];
  delete process.env.REDDIT_THREADS_DAILY_USD;
  delete process.env.SPACES_CACHE_BUCKET;
});

describe("subreddit and date parsing", () => {
  it.each([
    ["https://www.reddit.com/r/smallbusiness/comments/abc/x/", "r/smallbusiness"],
    ["https://old.reddit.com/r/CRM/comments/1/", "r/CRM"],
    ["https://reddit.com/r/sales", "r/sales"],
    ["https://np.reddit.com/r/Ask_Me/comments/z/", "r/Ask_Me"],
    ["https://www.reddit.com/user/someone/", null],
    ["https://www.reddit.com/", null],
    ["https://notreddit.com/r/fake/", null],
    ["https://evilreddit.com/r/fake/", null],
    ["not a url", null],
  ])("%s → %s", (url, sub) => expect(subredditFromUrl(url)).toBe(sub));

  it("keeps Google's date only when it prints one", () => {
    expect(dateOf("2026-03-04 00:00:00 +00:00")).toBe("2026-03-04");
    expect(dateOf(null)).toBeNull();
    expect(dateOf("yesterday")).toBeNull();
  });
});

describe("the SERP parser", () => {
  it("lists Reddit organic results by position, then forums-box Reddit links not already listed", () => {
    const { threads, forumsBlock } = parseRedditSerp(SERP_RESULT);
    expect(forumsBlock).toBe(true);
    expect(threads.map((t) => [t.position, t.subreddit, t.fromForums])).toEqual([
      [1, "r/CRM", false],
      [2, "r/smallbusiness", false],
      [null, "r/sales", true],
    ]);
    expect(threads[1]).toMatchObject({ title: "Thread 2", snippet: "Snippet 2", date: "2026-03-04" });
  });

  it("keeps at most ten organic threads", () => {
    const many = [{ items: Array.from({ length: 14 }, (_, i) => organic(i + 1, `https://www.reddit.com/r/a/comments/${i}/`)) }];
    expect(parseRedditSerp(many).threads).toHaveLength(10);
  });

  it("CSV: one row per thread, quoted, and a leading = is neutralised", () => {
    const out = threadsCsv([{ title: '=HYPERLINK("x")', url: "https://www.reddit.com/r/a/comments/1/", subreddit: "r/a", snippet: "a, b", position: 1, date: null, fromForums: false }]);
    const [head, row] = out.trim().split("\r\n");
    expect(head).toBe("position,title,subreddit,date,url,snippet");
    expect(row).toBe(`1,"'=HYPERLINK(""x"")",r/a,,https://www.reddit.com/r/a/comments/1/,"a, b"`);
  });
});

describe("the DataForSEO task", () => {
  const us = { code: 2840, language: "en" };

  it("one live SERP page of site:reddit.com in the country, no AI Overview", () => {
    expect(redditTask({ keyword: "best crm", country: us, time: "any" })).toEqual({
      keyword: "site:reddit.com best crm",
      location_code: 2840,
      language_code: "en",
      device: "desktop",
      os: "windows",
      depth: 10,
    });
  });

  it("sends Google's time filter as search_param", () => {
    expect(redditTask({ keyword: "x", country: us, time: "year" }).search_param).toBe("&tbs=qdr:y");
    expect(redditTask({ keyword: "x", country: us, time: "month" }).search_param).toBe("&tbs=qdr:m");
  });

  it("is marked for the search router: top-10 organic, country, no AI Overview, no features", () => {
    expect(REDDIT_SEARCH_ROUTE).toEqual({ kind: "organic_top10", location: "country", aiOverview: false, featureParsing: false });
    expect(redditTask({ keyword: "x", country: us, time: "any" })).not.toHaveProperty("load_async_ai_overview");
  });
});

describe("POST /api/free/v1/reddit-threads", () => {
  it("a miss buys one live search under the tool's own id, uses one allowance, and caches it", async () => {
    const res = await search(req(BODY));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cached).toBe(false);
    expect(data.threads).toHaveLength(3);
    expect(metered.calls).toEqual([expect.objectContaining({ tenantId: REDDIT_TENANT_ID, path: SERP.organicLive })]);
    expect(gate.consumed).toEqual(["reddit-threads"]);
    expect([...kv.keys()].some((k) => k.startsWith("free:cache:reddit:"))).toBe(true);
  });

  it("a cache hit makes no provider call and uses no allowance", async () => {
    await search(req(BODY));
    metered.calls = [];
    gate.consumed = [];
    const res = await search(req({ ...BODY, keyword: "  BEST   crm " }));
    expect(res.status).toBe(200);
    expect((await res.json()).cached).toBe(true);
    expect(metered.calls).toEqual([]);
    expect(gate.consumed).toEqual([]);
  });

  it("another country or time filter is another search", async () => {
    await search(req(BODY));
    await search(req({ ...BODY, time: "month" }));
    await search(req({ ...BODY, country: 2826 }));
    expect(metered.calls).toHaveLength(3);
  });

  it("no cf-connecting-ip → 403 before Turnstile or any purchase", async () => {
    const res = await search(req(BODY, { "x-forwarded-for": "203.0.113.7" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("no_ip");
    expect(metered.calls).toEqual([]);
  });

  it("a failed Turnstile check → 403", async () => {
    gate.turnstile = "failed";
    const res = await search(req(BODY));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("turnstile");
    expect(metered.calls).toEqual([]);
  });

  it(`the ${SEARCHES_PER_IP_PER_DAY}-a-day limit → 429 rate_limited, nothing bought`, async () => {
    gate.limit = { ok: false, reason: "rate_limited" };
    const res = await search(req(BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("rate_limited");
    expect(metered.calls).toEqual([]);
  });

  it("the daily budget (default $1) spent → 429 'back tomorrow', no allowance used", async () => {
    expect(dailyBudgetUsd()).toBe(1);
    db.spent = 1;
    const res = await search(req(BODY));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.code).toBe("budget");
    expect(data.error).toMatch(/tomorrow/);
    expect(gate.consumed).toEqual([]);
    expect(metered.calls).toEqual([]);
    expect(db.spentWhere).toMatchObject({ tenantId: REDDIT_TENANT_ID });
  });

  it("the budget is config: REDDIT_THREADS_DAILY_USD overrides it, 0 closes new searches", async () => {
    process.env.REDDIT_THREADS_DAILY_USD = "0";
    expect(dailyBudgetUsd()).toBe(0);
    expect((await search(req(BODY))).status).toBe(429);
    process.env.REDDIT_THREADS_DAILY_USD = "2.5";
    expect(dailyBudgetUsd()).toBe(2.5);
  });

  it("a provider failure refunds the allowance and answers 503", async () => {
    metered.fail = new DataforseoError("down", "UPSTREAM_UNAVAILABLE");
    const res = await search(req(BODY));
    expect(res.status).toBe(503);
    expect(gate.refunded).toEqual(["reddit-threads"]);
  });

  it("refuses an empty keyword and an unknown country", async () => {
    expect((await search(req({ ...BODY, keyword: "   " }))).status).toBe(400);
    expect((await search(req({ ...BODY, country: 9999 }))).status).toBe(400);
  });

  it("answers in the visitor's language", async () => {
    db.spent = 5;
    const fr = await (await search(req({ ...BODY, locale: "fr-CA" }))).json();
    expect(fr.error).toBe(REDDIT_COPY.fr.errors.budget);
  });
});

describe("POST /api/free/v1/reddit-threads/csv", () => {
  const csvReq = (body: unknown, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/free/v1/reddit-threads/csv", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7", "cf-ipcountry": "US", ...headers },
      body: JSON.stringify(body),
    });
  const CSV_BODY = { email: "Owner@Example.com", consent: false, keyword: "best crm", country: 2840, time: "year", locale: "en" };

  it("serves a cached search as a CSV attachment and stores the lead (source reddit-threads)", async () => {
    await search(req(BODY));
    metered.calls = [];
    const res = await csv(csvReq(CSV_BODY));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="reddit-threads-best-crm\.csv"$/);
    expect((await res.text()).split("\r\n")[0]).toBe("position,title,subreddit,date,url,snippet");
    expect(db.leads).toEqual([expect.objectContaining({ email: "owner@example.com", source: "reddit-threads", domain: "best crm" })]);
    expect(metered.calls).toEqual([]);
  });

  it("EU/EEA/UK visitors get the file but no lead is stored", async () => {
    await search(req(BODY));
    for (const country of ["DE", "FR", "GB"]) {
      const res = await csv(csvReq(CSV_BODY, { "cf-ipcountry": country }));
      expect(res.status).toBe(200);
    }
    expect(db.leads).toEqual([]);
  });

  it("a search not in the cache is 404 'expired' and is never bought", async () => {
    const res = await csv(csvReq(CSV_BODY));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("expired");
    expect(metered.calls).toEqual([]);
  });

  it("needs a valid email and cf-connecting-ip", async () => {
    expect((await csv(csvReq({ ...CSV_BODY, email: "nope" }))).status).toBe(400);
    const noIp = new Request("http://localhost/api/free/v1/reddit-threads/csv", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(CSV_BODY),
    });
    expect((await csv(noIp)).status).toBe(403);
  });
});

describe("the route table, the sitemap and the removed redirect", () => {
  const dir = join(ROOT, "src/app/[locale]/free-tools/reddit-threads");

  it("the 301 route.ts is gone and the page is back on the old slug", () => {
    expect(existsSync(join(dir, "route.ts"))).toBe(false);
    expect(existsSync(join(dir, "page.tsx"))).toBe(true);
    expect(readFileSync(join(dir, "page.tsx"), "utf8")).not.toContain("permanentRedirect");
  });

  it("is no longer a retired path, and is in the sitemap registry and the locale guard", () => {
    const path = `${FREE_TOOLS_BASE}/reddit-threads`;
    expect(RETIRED_LOCALIZED_PATHS).not.toContain(path);
    expect(freeToolRoutes()).toContain(path);
    expect(LOCALIZED_ROUTES.map((r) => r.path)).toContain(path);
    expect(KNOWN_MARKETING_PATHS).toContain(path);
  });

  it("is a paid free tool with its limit, its API route and FAQ JSON-LD", () => {
    const tool = freeToolById("reddit_threads");
    expect(tool).toMatchObject({ slug: "reddit-threads", cost: "paid_api", dailyLimit: SEARCHES_PER_IP_PER_DAY, apiPath: "/api/free/v1/reddit-threads", jsonLd: "faq" });
    expect(existsSync(join(ROOT, "src/app/api/free/v1/reddit-threads/route.ts"))).toBe(true);
  });

  it("never fetches from reddit.com: no Reddit API or page fetch in the tool's code", () => {
    for (const f of ["src/lib/reddit-threads/service.ts", "src/app/api/free/v1/reddit-threads/route.ts", "src/app/api/free/v1/reddit-threads/csv/route.ts"]) {
      const src = readFileSync(join(ROOT, f), "utf8");
      expect(src, f).not.toMatch(/fetch\([^)]*reddit|search\.json|oauth\.reddit|api\.reddit/);
    }
  });
});

describe("copy", () => {
  it("en, fr and de-CH carry every string, the FAQ and the AI line", () => {
    const shape = (o: unknown): unknown =>
      o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.length : shape(v)])) : typeof o;
    expect(shape(REDDIT_COPY.fr)).toEqual(shape(REDDIT_COPY.en));
    expect(shape(REDDIT_COPY["de-CH"])).toEqual(shape(REDDIT_COPY.en));
    for (const l of ["en", "fr", "de-CH"] as const) {
      expect(REDDIT_COPY[l].faq.length).toBeGreaterThanOrEqual(3);
      expect(REDDIT_COPY[l].aiLine).toMatch(/Reddit/);
      expect(REDDIT_COPY[l].errors.budget.length).toBeGreaterThan(20);
    }
    expect(REDDIT_COPY.en.ctaButton).toBe("Track these keywords");
    expect(JSON.stringify(REDDIT_COPY["de-CH"])).not.toContain("ß");
    expect(JSON.stringify(REDDIT_COPY)).not.toMatch(/EchoRank|Echo Rank/);
  });
});
