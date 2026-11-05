// @vitest-environment jsdom
//
// tests/free-crawler-result.test.tsx — the free public crawler's pages and
// result link (commit 3):
//   - the result page: lockup, host, pages, Site health, kind totals and the
//     top 5 Fix-first rules for anyone with the link; the full list and the
//     CSV link ONLY with this result's unlock cookie (otherwise a placeholder
//     carrying no rule data, plus the email form); noindex; 404 when unknown,
//     expired or the flag is off; the progress view while queued;
//   - the unlock cookie: HMAC of the token, one result only, tampering fails;
//   - the routes: status, unlock (lead stored with source free-crawler, a
//     consented one sent by Brevo double opt-in, Set-Cookie), CSV (403 locked);
//   - the tool page and the result page in en and fr; axe on both.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axe from "axe-core";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET = "test-only-secret";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/en/free-tools/site-crawler",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
const jar = vi.hoisted(() => ({ cookies: {} as Record<string, string> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n in jar.cookies ? { name: n, value: jar.cookies[n] } : undefined) }) }));
vi.mock("@/app/[locale]/PublicNav", () => ({ PublicNav: () => <nav aria-label="Main">nav</nav> }));
vi.mock("@/components/PublicFooter", () => ({ PublicFooter: () => <footer>footer</footer> }));
const flags = vi.hoisted(() => ({ free: true }));
vi.mock("@/lib/flags", async (orig) => {
  const real = await orig<typeof import("@/lib/flags")>();
  return { ...real, flag: (name: string) => (name === "crawl.free" ? flags.free : real.flag(name as never)) };
});
vi.mock("@/lib/free-tools/limits", () => ({
  visitorIp: (req: Request) => req.headers.get("cf-connecting-ip"),
  consumeDailyLimit: async () => ({ ok: true, remaining: 5 }),
}));

// ─── Data ───────────────────────────────────────────────────────────────────
const ISSUES: Record<string, { count: number; kind: string; priority: string; pages: number }> = {
  "page_titles.missing": { count: 40, kind: "issue", priority: "high", pages: 40 },
  "h1.missing": { count: 30, kind: "issue", priority: "high", pages: 30 },
  "meta_description.missing": { count: 25, kind: "issue", priority: "high", pages: 25 },
  "canonicals.missing": { count: 20, kind: "warning", priority: "high", pages: 20 },
  "images.missing_alt": { count: 90, kind: "issue", priority: "high", pages: 15 },
  "links.orphan": { count: 12, kind: "issue", priority: "high", pages: 10 },
  "page_titles.duplicate": { count: 8, kind: "warning", priority: "medium", pages: 8 },
  "meta_keywords.present": { count: 0, kind: "opportunity", priority: "low", pages: 0 },
};
const NOW = new Date();
type Row = { token: string; domain: string; host: string; createdAt: Date; crawlJob: Record<string, unknown> };
const rows = new Map<string, Row>();
function addRow(token: string, status = "COMPLETED", createdAt = NOW): Row {
  const row: Row = {
    token,
    domain: "example.org",
    host: "www.example.org",
    createdAt,
    crawlJob: {
      id: `c_${token}`,
      tenantId: "t_free",
      rootUrl: "https://www.example.org/",
      status,
      stoppedReason: "url_cap",
      pagesCrawled: status === "COMPLETED" ? 100 : 0,
      urlCap: 100,
      summary: status === "COMPLETED" ? { issues: ISSUES, issuesByKind: { issue: 197, warning: 28, opportunity: 0 }, health: { score: 41 } } : null,
      createdAt,
      startedAt: null,
      finishedAt: null,
    },
  };
  rows.set(token, row);
  return row;
}
const leads: Record<string, unknown>[] = [];
const issueRows = [
  { id: "i1", type: "page_titles.missing", severity: "error", detail: null, crawlPage: { url: "https://www.example.org/a", statusCode: 200, segmentIds: [] } },
];
vi.mock("@/lib/prisma", () => ({
  prisma: {
    freeCrawl: {
      findFirst: vi.fn(async ({ where }: { where: { token: string; createdAt: { gt: Date } } }) => {
        const r = rows.get(where.token);
        return r && r.createdAt > where.createdAt.gt ? r : null;
      }),
    },
    freeCrawlLead: {
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
        leads.push(create);
        return { id: `l${leads.length}`, doiRequestedAt: null };
      }),
      update: vi.fn(async () => ({})),
    },
    crawlJob: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    tenant: { findUnique: vi.fn(async () => ({ crawlConcurrencyOverride: null, crawlsKeptOverride: null, crawlUrlCapOverride: null })) },
    crawlIssue: { findMany: vi.fn(async ({ where }: { where: { id?: unknown } }) => (where.id ? [] : issueRows)) },
  },
}));

const ResultPage = (await import("@/app/[locale]/free-tools/site-crawler/r/[token]/page")).default;
const { generateMetadata } = await import("@/app/[locale]/free-tools/site-crawler/r/[token]/page");
const ToolPage = (await import("@/app/[locale]/free-tools/site-crawler/page")).default;
const statusRoute = await import("@/app/api/free/v1/site-crawler/[token]/route");
const unlockRoute = await import("@/app/api/free/v1/site-crawler/[token]/unlock/route");
const exportRoute = await import("@/app/api/free/v1/site-crawler/[token]/export/route");
const result = await import("@/lib/site-crawler/free-result");
const { FREE_CRAWLER_COPY } = await import("@/lib/site-crawler/free-copy");
const { RULE_COPY } = await import("@/lib/crawl-rules-meta");

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  rows.clear();
  leads.length = 0;
  jar.cookies = {};
  flags.free = true;
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "queued", pagesCrawled: 0, urlCap: 100, queuePosition: 2 }), { status: 200 })));
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

async function renderResult(token: string, locale = "en", search: Record<string, string> = {}) {
  const tree = await ResultPage({ params: Promise.resolve({ locale, token }), searchParams: Promise.resolve(search) });
  await act(async () => root.render(tree));
}
const a11y = async () => {
  const res = await axe.run(el, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
};

describe("the result page", () => {
  it("shows the lockup, host, pages, health, kind totals and the top 5 Fix-first rules to anyone", async () => {
    addRow("tok_abcdefghijklmnop");
    await renderResult("tok_abcdefghijklmnop");
    const logo = el.querySelector('[data-testid="free-result-lockup"] img')!;
    expect([logo.getAttribute("src"), logo.getAttribute("alt"), logo.getAttribute("width"), logo.getAttribute("height")]).toEqual([CRAWLER_BRAND.logoOnDark, CRAWLER_BRAND.name, "259", "36"]);
    expect(el.querySelector('[data-testid="free-result-lockup"]')!.textContent).toBe(CRAWLER_BRAND.byline);
    expect(el.querySelector('[data-testid="free-result-host"]')!.textContent).toBe("www.example.org");
    expect(el.querySelector('[data-testid="free-result-health"]')!.textContent).toContain("41");
    expect(el.textContent).toContain("197");
    const fix = [...el.querySelectorAll('[data-testid="free-fix-first"] li')];
    expect(fix.map((li) => li.getAttribute("data-rule"))).toEqual(["page_titles.missing", "h1.missing", "meta_description.missing", "canonicals.missing", "images.missing_alt"]);
    // One-line why: the first sentence of the rule's description.
    const why = result.oneLineWhy("page_titles.missing");
    expect(RULE_COPY["page_titles.missing"]).toBeDefined();
    expect(fix[0]!.textContent).toContain(RULE_COPY["page_titles.missing"]!.name);
    expect(fix[0]!.textContent).toContain(why!);
    expect(why ?? "").not.toMatch(/\.\s+\S/);
    expect(el.querySelector('[data-testid="free-cta"] a')!.getAttribute("href")).toBe("/en/pricing?src=free-tools-site-crawler");
    expect(el.querySelector('[data-testid="free-cta"]')!.textContent).toContain("25,000");
    expect(el.querySelector('[data-testid="free-share"]')).not.toBeNull();
    expect(el.textContent).toContain("support@echorank360.com");
  });

  it("keeps the full list and the CSV behind the email form until this result's cookie", async () => {
    addRow("tok_abcdefghijklmnop");
    await renderResult("tok_abcdefghijklmnop");
    let full = el.querySelector('[data-testid="free-full-list"]')!;
    expect(full.getAttribute("data-locked")).toBe("true");
    // No rule beyond the top 5 is anywhere in the page, and no CSV link.
    expect(el.querySelector('[data-rule="links.orphan"]')).toBeNull();
    expect(el.querySelector('[data-rule="page_titles.duplicate"]')).toBeNull();
    expect(el.querySelector('[data-testid="free-csv"]')).toBeNull();
    expect(full.querySelector('[data-testid="free-unlock-form"]')).not.toBeNull();
    expect(full.querySelector('[aria-hidden="true"]')!.getAttribute("style")).toContain("blur");

    // Another result's cookie does not open this one; a forged value neither.
    jar.cookies[result.unlockCookieName("tok_abcdefghijklmnop")] = result.unlockValue("tok_other_result_xyz")!;
    await renderResult("tok_abcdefghijklmnop");
    expect(el.querySelector('[data-testid="free-full-list"]')!.getAttribute("data-locked")).toBe("true");

    jar.cookies[result.unlockCookieName("tok_abcdefghijklmnop")] = result.unlockValue("tok_abcdefghijklmnop")!;
    await renderResult("tok_abcdefghijklmnop");
    full = el.querySelector('[data-testid="free-full-list"]')!;
    expect(full.getAttribute("data-locked")).toBe("false");
    expect([...full.querySelectorAll("li")].map((li) => li.getAttribute("data-rule"))).toEqual([
      "page_titles.missing",
      "h1.missing",
      "meta_description.missing",
      "images.missing_alt",
      "links.orphan",
      "canonicals.missing",
      "page_titles.duplicate",
    ]);
    expect(el.querySelector('[data-testid="free-csv"]')!.getAttribute("href")).toBe("/api/free/v1/site-crawler/tok_abcdefghijklmnop/export");
    expect(el.querySelector('[data-testid="free-unlock-form"]')).toBeNull();
  });

  it("shows the progress view while the crawl is queued", async () => {
    addRow("tok_queued_aaaaaaaaaa", "QUEUED");
    await renderResult("tok_queued_aaaaaaaaaa");
    expect(el.querySelector('[data-testid="free-crawl-progress"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="free-result-summary"]')).toBeNull();
  });

  it("is noindex, and a 404 when unknown, older than 7 days, or with the flag off", async () => {
    expect((await generateMetadata({ params: Promise.resolve({ locale: "en" }) })).robots).toEqual({ index: false, follow: false });
    await expect(renderResult("tok_unknown_aaaaaaaaa")).rejects.toThrow("NEXT_NOT_FOUND");
    addRow("tok_old_aaaaaaaaaaaaa", "COMPLETED", new Date(NOW.getTime() - 8 * 86_400_000));
    await expect(renderResult("tok_old_aaaaaaaaaaaaa")).rejects.toThrow("NEXT_NOT_FOUND");
    addRow("tok_abcdefghijklmnop");
    flags.free = false;
    await expect(renderResult("tok_abcdefghijklmnop")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each(["en", "fr"] as const)("renders in %s, with no serious axe violation (locked and unlocked)", async (l) => {
    const t = FREE_CRAWLER_COPY[l].result;
    addRow("tok_abcdefghijklmnop");
    await renderResult("tok_abcdefghijklmnop", l === "fr" ? "fr-CA" : "en");
    expect(el.textContent).toContain(t.fixFirst);
    expect(el.textContent).toContain(t.unlockTitle);
    expect(await a11y()).toEqual([]);
    jar.cookies[result.unlockCookieName("tok_abcdefghijklmnop")] = result.unlockValue("tok_abcdefghijklmnop")!;
    await renderResult("tok_abcdefghijklmnop", l);
    expect(el.textContent).toContain(t.csv);
    expect(await a11y()).toEqual([]);
  });
});

describe("the tool page", () => {
  it.each(["en", "fr"] as const)("renders the form in %s, with the abuse line and no serious axe violation", async (l) => {
    const t = FREE_CRAWLER_COPY[l];
    const tree = await ToolPage({ params: Promise.resolve({ locale: l }) });
    await act(async () => root.render(tree));
    expect(el.querySelector("h1")!.textContent).toBe(t.name);
    expect(el.querySelector('[data-testid="free-crawl-form"] button[type="submit"]')!.textContent).toBe(t.submit);
    expect(el.querySelector('[data-testid="free-crawl-abuse"]')!.textContent).toContain("support@echorank360.com");
    expect(await a11y()).toEqual([]);
  });

  it("is a 404 with the flag off", async () => {
    flags.free = false;
    await expect(ToolPage({ params: Promise.resolve({ locale: "en" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("the routes", () => {
  const ctx = (token: string) => ({ params: Promise.resolve({ token }) });

  it("status: progress for a live token, 404 otherwise", async () => {
    addRow("tok_queued_aaaaaaaaaa", "QUEUED");
    const res = await statusRoute.GET(new Request("https://x.test/"), ctx("tok_queued_aaaaaaaaaa"));
    expect(await res.json()).toMatchObject({ status: "queued", host: "www.example.org", pagesCrawled: 0, urlCap: 100, queuePosition: 1 });
    expect((await statusRoute.GET(new Request("https://x.test/"), ctx("tok_unknown_aaaaaaaaa"))).status).toBe(404);
  });

  it("unlock: stores the lead (source free-crawler), sets an HttpOnly cookie for this result only", async () => {
    addRow("tok_abcdefghijklmnop");
    const post = (body: unknown, ip: string | null = "203.0.113.7") =>
      unlockRoute.POST(
        new Request("https://x.test/", { method: "POST", headers: { "content-type": "application/json", ...(ip ? { "cf-connecting-ip": ip } : {}) }, body: JSON.stringify(body) }),
        ctx("tok_abcdefghijklmnop"),
      );
    expect((await post({ email: "not-an-email" })).status).toBe(400);
    expect((await post({ email: "a@b.co" }, null)).status).toBe(400);
    const res = await post({ email: " Owner@Example.org ", consent: false, locale: "fr" });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^erfc_tok_abcdefghijklmnop=[\w-]+; Path=\/; Max-Age=\d+; HttpOnly; SameSite=Lax/);
    const value = cookie.split(";")[0]!.split("=")[1]!;
    expect(result.isUnlocked("tok_abcdefghijklmnop", value)).toBe(true);
    expect(result.isUnlocked("tok_other_result_xyz", value)).toBe(false);
    expect(result.isUnlocked("tok_abcdefghijklmnop", `${value}x`)).toBe(false);
    expect(leads[0]).toMatchObject({ token: "tok_abcdefghijklmnop", email: "owner@example.org", domain: "example.org", locale: "fr", marketingConsent: false, source: "free-crawler" });
  });

  it("CSV: 403 without the cookie, the issues CSV with it", async () => {
    addRow("tok_abcdefghijklmnop");
    const get = (cookie?: string) => exportRoute.GET(new Request("https://x.test/", { headers: cookie ? { cookie } : {} }), ctx("tok_abcdefghijklmnop"));
    expect((await get()).status).toBe(403);
    expect((await get(`erfc_tok_abcdefghijklmnop=${result.unlockValue("tok_other_result_xyz")}`)).status).toBe(403);
    const res = await get(`a=b; erfc_tok_abcdefghijklmnop=${result.unlockValue("tok_abcdefghijklmnop")}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(await res.text()).toContain("https://www.example.org/a");
  });
});

describe("Brevo double opt-in", () => {
  it("is sent only when configured and in production, to the DOI endpoint with SOURCE free-crawler", async () => {
    const f = vi.fn(async () => new Response(null, { status: 201 }));
    expect(await result.requestDoubleOptIn("a@b.co", "en", "example.org", f as never)).toBe("skipped");
    vi.stubEnv("BREVO_API_KEY", "test-key");
    vi.stubEnv("BREVO_FREE_TOOLS_LIST_ID", "12");
    vi.stubEnv("BREVO_DOI_TEMPLATE_ID", "34");
    expect(await result.requestDoubleOptIn("a@b.co", "en", "example.org", f as never)).toBe("skipped"); // not production
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(await result.requestDoubleOptIn("a@b.co", "fr", "example.org", f as never)).toBe("sent");
    } finally {
      vi.unstubAllEnvs();
    }
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/contacts/doubleOptinConfirmation");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "a@b.co",
      includeListIds: [12],
      templateId: 34,
      redirectionUrl: "https://echorank360.com/fr/free-tools/site-crawler?subscribed=1",
      attributes: { SOURCE: "free-crawler", LOCALE: "fr", CHECKED_DOMAIN: "example.org" },
    });
  });
});
