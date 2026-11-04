// @vitest-environment jsdom
//
// tests/site-crawler-4e-login.test.tsx — Phase 4e forms login: the session's
// cookies go to the login host only and live encrypted in Redis; the sidecar
// call never throws and maps its reasons; credentials are sealed and never
// shown; verified sites only; the editor in every dashboard locale; the
// routes never return a credential or a cookie.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (orig) => ({ ...(await orig<typeof import("@/lib/paid-plan")>()), requirePaidPlan: () => requirePaidPlan() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));
const crawlSiteDefault = { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { crawlSiteDefault } }));

import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { cookieHeaderFor, loadJar, loginJarKey, openLogin, saveJar, sealLogin, sidecarLogin, type JarCookie } from "@/lib/site-crawler/login";
import { LOGOUT_TEXT, LOGOUT_URL, viewLogin } from "@/lib/site-crawler/login-config";
import { CrawlConfigInputSchema, checkCrawlConfig, siteDefaultColumns, viewCrawlConfig, type StoredCrawlConfig } from "@/lib/site-crawler/crawl-config";
import { LoginEditor, toLoginInput, fromLoginView } from "@/components/seo-tools/site-crawler-login";
import { problemText } from "@/components/seo-tools/site-crawler-config";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const SECRET = "test-key-not-a-secret";
const PW = "hunter2-" + "x".repeat(8);
const login = {
  loginUrl: "https://app.example.com/login",
  usernameSelector: "#u",
  passwordSelector: "#p",
  submitSelector: "button[type=submit]",
  successCheck: { kind: "urlPrefix" as const, value: "https://app.example.com/account" },
  username: "ada@example.com",
  password: PW,
};
const jar: JarCookie[] = [
  { name: "sid", value: "abc", domain: "app.example.com", path: "/", secure: true },
  { name: "pref", value: "1", domain: ".app.example.com", path: "/settings" },
];

describe("the session's cookies", () => {
  it.each([
    ["https://app.example.com/", "sid=abc"],
    ["https://app.example.com/settings/x", "sid=abc; pref=1"],
    ["http://app.example.com/", null], // Secure cookie, plain http: not sent; pref's path does not match
    ["https://www.example.com/", null], // another host of the same site
    ["https://cdn.other.net/a.js", null],
    ["not a url", null],
  ])("%s → %s", (url, header) => {
    expect(cookieHeaderFor(jar, "app.example.com", url)).toBe(header);
  });

  it("lives in Redis encrypted, with the crawl's TTL, under the crawl's key", async () => {
    const store = new Map<string, { v: string; args: unknown[] }>();
    const redis = { set: async (k: string, v: string, ...args: unknown[]) => void store.set(k, { v, args }), get: async (k: string) => store.get(k)?.v ?? null };
    await saveJar(redis as never, "job1", jar, SECRET);
    const row = store.get(loginJarKey("job1"))!;
    expect(row.v).not.toContain("abc");
    expect(row.args).toEqual(["EX", 86_400]);
    expect(await loadJar(redis as never, "job1", SECRET)).toEqual(jar);
    expect(await loadJar(redis as never, "job2", SECRET)).toBeNull();
  });
});

describe("sidecarLogin", () => {
  it.each([
    [{ ok: true, cookies: jar }, 200, { ok: true, cookies: jar }],
    [{ ok: false, reason: "submit_not_found" }, 200, { ok: false, reason: "submit_not_found" }],
    [{ ok: false, reason: "made_up" }, 200, { ok: false, reason: "success_check_failed" }],
    [{ error: "bad" }, 400, { ok: false, reason: "login_page_unreachable" }],
    [{ error: "busy" }, 429, { ok: false, reason: "sidecar_unavailable" }],
  ])("%j → %j", async (body, status, out) => {
    const f = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    expect(await sidecarLogin(login, "UA", f)).toEqual(out);
  });
  it("never throws on a network error", async () => {
    expect(await sidecarLogin(login, "UA", async () => Promise.reject(new Error("ECONNREFUSED")))).toEqual({ ok: false, reason: "sidecar_unavailable" });
  });
});

describe("credentials at rest", () => {
  it("are sealed, kept on { keep: true }, opened only for the worker, viewed as { set: true }", () => {
    const sealed = sealLogin(login, null, SECRET);
    expect(JSON.stringify(sealed)).not.toContain(PW);
    expect(JSON.stringify(sealed)).not.toContain("ada@example.com");
    const kept = sealLogin({ ...login, username: { keep: true }, password: { keep: true } }, sealed, SECRET);
    expect(openLogin(kept, SECRET)).toMatchObject({ username: "ada@example.com", password: PW });
    expect(() => sealLogin({ ...login, password: { keep: true } }, null, SECRET)).toThrow();
    expect(viewLogin(sealed)).toMatchObject({ username: { set: true }, password: { set: true }, loginUrl: login.loginUrl });
    const cfg = { ...CrawlConfigInputSchema.parse({}), headers: [], cookies: null, basicAuth: null, login: sealed } as StoredCrawlConfig;
    expect(JSON.stringify(viewCrawlConfig(cfg))).not.toContain(sealed.password.enc);
    expect("login" in (siteDefaultColumns(cfg).config as object)).toBe(false);
  });

  it("useLogin is refused on an unverified site and never takes a login from input", () => {
    const run = (verified: boolean) => checkCrawlConfig(CrawlConfigInputSchema.parse({ useLogin: true, login: { loginUrl: "x" } }), { urlCap: 10, verified });
    expect(run(false).problems).toEqual([{ field: "login", code: "requires_verified_site" }]);
    expect(run(true).problems).toEqual([]);
    expect(run(true).config).not.toHaveProperty("login");
  });

  it.each([
    ["https://x.com/logout", true],
    ["https://x.com/account/sign-out?next=/", true],
    ["https://x.com/api/disconnect", true],
    ["https://x.com/blog/logging-out-of-habits", false],
  ])("logout URL %s → %s", (u, hit) => expect(LOGOUT_URL.test(u)).toBe(hit));
  it.each([["Log out", true], ["Sign out", true], ["Logout", true], ["Catalogue", false]])("logout text %s → %s", (s, hit) => expect(LOGOUT_TEXT.test(s)).toBe(hit));
});

describe("the editor", () => {
  it.each(["en", "fr", "de-CH"] as const)("%s: verified only; saved credentials are never shown; save sends keep", async (l) => {
    const t = SITE_CRAWLER_COPY[l].p4e;
    const saved = viewLogin(sealLogin(login, null, SECRET));
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ login: saved }) }));
    vi.stubGlobal("fetch", fetchMock);
    const el = document.createElement("div");
    const root = createRoot(el);
    await act(async () => root.render(<LoginEditor t={t} host="app.example.com" verified={false} use={false} onUse={() => {}} disabled={false} />));
    expect(el.textContent).toContain(t.loginVerifiedOnly);
    expect(el.querySelector("input")).toBeNull();
    await act(async () => root.render(<LoginEditor t={t} host="app.example.com" verified use={false} onUse={() => {}} disabled={false} />));
    expect((el.querySelector("#login-loginUrl") as HTMLInputElement).value).toBe(login.loginUrl);
    expect((el.querySelector("#login-password") as HTMLInputElement).value).toBe("");
    expect((el.querySelector("#login-password") as HTMLInputElement).type).toBe("password");
    expect((el.querySelector("#login-password") as HTMLInputElement).placeholder).toBe(t.loginSecretSet);
    expect(toLoginInput(fromLoginView(saved), true)).toMatchObject({ username: { keep: true }, password: { keep: true } });
    expect(el.textContent).toContain(t.loginTest);
    if (l === "de-CH") expect(JSON.stringify(t)).not.toContain("ß");
    root.unmount();
    vi.unstubAllGlobals();
  });

  it("names the login problems", () => {
    const c = SITE_CRAWLER_COPY.en;
    expect(problemText({ field: "login", code: "login_missing" }, c.p4a, c.p4b, c.p4d, c.p4e)).toBe(c.p4e.problemLoginMissing);
    expect(problemText({ field: "login", code: "requires_verified_site" }, c.p4a, c.p4b, c.p4d, c.p4e)).toContain(c.p4e.loginVerifiedOnly);
  });
});

describe("/api/seo/v1/crawl/sites/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GSC_TOKEN_ENCRYPTION_KEY", SECRET);
    requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
    crawlSiteDefault.upsert.mockResolvedValue({ host: "app.example.com", verifyToken: "tok", verifiedAt: new Date(), verifyMethod: "dns", config: null, jsSnippets: null });
    crawlSiteDefault.findUnique.mockResolvedValue({ login: null });
  });
  const req = (method: string, body: unknown) => new Request("https://app.test/api/seo/v1/crawl/sites/login", { method, body: JSON.stringify(body) });

  it("saves sealed credentials for the caller's tenant and returns only { set: true }", async () => {
    const { PUT } = await import("@/app/api/seo/v1/crawl/sites/login/route");
    const res = await PUT(req("PUT", { host: "app.example.com", login }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(PW);
    expect(text).not.toContain("ada@");
    const call = crawlSiteDefault.update.mock.calls[0]![0];
    expect(call.where).toEqual({ tenantId_host: { tenantId: "t1", host: "app.example.com" } });
    expect(JSON.stringify(call.data)).not.toContain(PW);
  });

  it("refuses an unverified site, and a login page on another site, without echoing", async () => {
    const { PUT } = await import("@/app/api/seo/v1/crawl/sites/login/route");
    const off = await PUT(req("PUT", { host: "app.example.com", login: { ...login, loginUrl: "https://evil.example.net/login" } }));
    expect(off.status).toBe(400);
    expect(await off.text()).not.toContain(PW);
    crawlSiteDefault.upsert.mockResolvedValueOnce({ host: "app.example.com", verifyToken: "tok", verifiedAt: null, verifyMethod: null, config: null, jsSnippets: null });
    expect((await PUT(req("PUT", { host: "app.example.com", login }))).status).toBe(403);
    const bad = await PUT(req("PUT", { host: "app.example.com", login: { ...login, usernameSelector: "" } }));
    expect(bad.status).toBe(400);
    expect(await bad.text()).not.toContain(PW);
  });

  it("Test login answers ok / reason and never returns the cookies", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, cookies: jar }), { status: 200 })));
    const { POST } = await import("@/app/api/seo/v1/crawl/sites/login/route");
    const res = await POST(req("POST", { host: "app.example.com", login }));
    expect(await res.json()).toEqual({ ok: true, reason: null });
    vi.unstubAllGlobals();
  });
});
