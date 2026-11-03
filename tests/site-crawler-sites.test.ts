// Site ownership (Phase 4a): the three proofs, and the per-site settings route.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const crawlSiteDefault = { upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() };
const gscConnection = { findUnique: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { crawlSiteDefault, gscConnection } }));

const verify = await import("@/lib/site-crawler/site-verify");
const { GET, POST, PUT } = await import("@/app/api/seo/v1/crawl/sites/route");

const TOKEN = "tok_abc";
const row = (over: Record<string, unknown> = {}) => ({
  host: "example.com",
  verifyToken: TOKEN,
  verifiedAt: null,
  verifyMethod: null,
  config: null,
  ...over,
});
const req = (method: string, body?: unknown, qs = "") =>
  new Request(`https://app.test/api/seo/v1/crawl/sites${qs}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GSC_TOKEN_ENCRYPTION_KEY", "test-key-not-a-secret");
  requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
  crawlSiteDefault.upsert.mockResolvedValue(row());
});

describe("ownership proofs", () => {
  it.each([
    ["sc-domain:example.com", "example.com", true],
    ["sc-domain:example.com", "blog.example.com", true],
    ["sc-domain:example.com", "notexample.com", false],
    ["https://www.example.com/", "www.example.com", true],
    ["https://www.example.com/", "example.com", false],
    [null, "example.com", false],
  ])("GSC property %s covers %s: %s", (prop, host, expected) => {
    expect(verify.gscPropertyCovers(prop, host)).toBe(expected);
  });

  it.each([
    [`<meta name="echorank-verify" content="${TOKEN}">`, true],
    [`<META content='${TOKEN}' NAME='echorank-verify' />`, true],
    [`<meta name="echorank-verify" content="other">`, false],
    [`<meta name="google-site-verification" content="${TOKEN}">`, false],
  ])("meta tag %s → %s", (html, expected) => {
    expect(verify.pageHasMetaToken(`<html><head>${html}</head></html>`, TOKEN)).toBe(expected);
  });

  it("DNS TXT: chunks are joined, the whole record must match", () => {
    expect(verify.txtHasToken([["echorank-verify=", TOKEN]], TOKEN)).toBe(true);
    expect(verify.txtHasToken([[`v=spf1 echorank-verify=${TOKEN}`]], TOKEN)).toBe(false);
  });

  it("tries Search Console, then DNS, then the home page", async () => {
    const deps = { gscSiteUrl: vi.fn(async () => null), txt: vi.fn(async () => []), fetchHome: vi.fn(async () => null) };
    expect(await verify.checkOwnership("t1", "example.com", TOKEN, deps)).toBeNull();
    deps.fetchHome.mockResolvedValueOnce(`<meta name="echorank-verify" content="${TOKEN}">` as never);
    expect(await verify.checkOwnership("t1", "example.com", TOKEN, deps)).toBe("meta");
    deps.txt.mockResolvedValueOnce([[`echorank-verify=${TOKEN}`]] as never);
    expect(await verify.checkOwnership("t1", "example.com", TOKEN, deps)).toBe("dns");
    deps.gscSiteUrl.mockResolvedValueOnce("sc-domain:example.com" as never);
    expect(await verify.checkOwnership("t1", "example.com", TOKEN, deps)).toBe("gsc");
  });

  it("hostOf takes a URL or a bare host", () => {
    expect(verify.hostOf("https://WWW.Example.com:8443/a")).toBe("www.example.com");
    expect(verify.hostOf("example.com")).toBe("example.com");
    expect(verify.hostOf("")).toBeNull();
  });
});

describe("/api/seo/v1/crawl/sites", () => {
  it("401 when signed out", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated"));
    expect((await GET(req("GET", undefined, "?host=example.com"))).status).toBe(401);
  });

  it("refuses private and malformed hosts before touching the database", async () => {
    for (const host of ["localhost", "10.0.0.1", "", "http://[::1]/"]) {
      expect((await GET(req("GET", undefined, `?host=${encodeURIComponent(host)}`))).status, host).toBe(400);
    }
    expect(crawlSiteDefault.upsert).not.toHaveBeenCalled();
  });

  it("returns the token to publish, scoped to the caller's tenant", async () => {
    const res = await GET(req("GET", undefined, "?host=https://Example.com/x"));
    expect(await res.json()).toMatchObject({
      host: "example.com",
      verified: false,
      metaTag: `<meta name="echorank-verify" content="${TOKEN}">`,
      dnsRecord: `echorank-verify=${TOKEN}`,
      defaults: null,
    });
    expect(crawlSiteDefault.upsert.mock.calls[0]![0].where).toEqual({ tenantId_host: { tenantId: "t1", host: "example.com" } });
  });

  it("POST records a successful check", async () => {
    gscConnection.findUnique.mockResolvedValue({ siteUrl: "sc-domain:example.com", status: "ACTIVE" });
    crawlSiteDefault.update.mockResolvedValue(row({ verifiedAt: new Date(), verifyMethod: "gsc" }));
    const res = await POST(req("POST", { host: "example.com" }));
    expect(await res.json()).toMatchObject({ verified: true, verifyMethod: "gsc" });
    expect(crawlSiteDefault.update.mock.calls[0]![0].data).toMatchObject({ verifyMethod: "gsc" });
  });

  it("PUT refuses verified-only options on an unverified site", async () => {
    const res = await PUT(req("PUT", { host: "example.com", config: { respectRobots: false } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "INVALID_CONFIG", problems: [{ field: "respectRobots", code: "requires_verified_site" }] });
    expect(crawlSiteDefault.update).not.toHaveBeenCalled();
  });

  it("PUT stores secrets sealed and answers with { set: true } only", async () => {
    crawlSiteDefault.update.mockImplementation(async (args: { data: { config: unknown } }) => row({ config: args.data.config }));
    const res = await PUT(req("PUT", { host: "example.com", config: { cookies: "session=abc", headers: [{ name: "X-Preview", value: "tok-1" }] } }));
    expect(res.status).toBe(200);
    const stored = JSON.stringify(crawlSiteDefault.update.mock.calls[0]![0].data.config);
    expect(stored).not.toContain("session=abc");
    expect(stored).not.toContain("tok-1");
    const body = await res.text();
    expect(body).not.toContain("session=abc");
    expect(body).not.toContain("enc");
    expect(JSON.parse(body).defaults).toMatchObject({ cookies: { set: true }, headers: [{ name: "X-Preview", value: { set: true } }] });
  });
});
