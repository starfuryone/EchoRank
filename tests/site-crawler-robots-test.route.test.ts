// POST /api/seo/v1/crawl/robots-test — allow/block per rule line, live vs draft.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const fetchRobots = vi.fn();
vi.mock("@/lib/site-crawler/robots", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/site-crawler/robots")>()),
  fetchRobots: (...a: unknown[]) => fetchRobots(...a),
}));

const { rulesFromBody, denyAllRules } = await import("@/lib/site-crawler/robots");
const { POST } = await import("@/app/api/seo/v1/crawl/robots-test/route");

const LIVE = "User-agent: *\nDisallow: /private\n\nUser-agent: Googlebot\nDisallow: /nogoogle";
const post = (body: unknown) =>
  POST(new Request("https://app.test/api/seo/v1/crawl/robots-test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  vi.clearAllMocks();
  requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "STARTER" } });
  fetchRobots.mockImplementation(async (_root: string, opts: { agent: string }) =>
    rulesFromBody(LIVE, "https://example.com/robots.txt", opts.agent),
  );
});

describe("robots.txt tester", () => {
  it("401 when signed out", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated"));
    expect((await post({ url: "https://example.com", urls: ["/a"] })).status).toBe(401);
  });

  it("judges each URL with the deciding line, live and draft", async () => {
    const res = await post({ url: "https://example.com", urls: ["/private/x", "/blog/a"], customRobots: "User-agent: *\nDisallow: /blog" });
    const body = await res.json();
    expect(body.results).toEqual([
      {
        url: "https://example.com/private/x",
        live: { allowed: false, line: 2, text: "Disallow: /private" },
        custom: { allowed: true, line: null, text: null },
      },
      {
        url: "https://example.com/blog/a",
        live: { allowed: true, line: null, text: null },
        custom: { allowed: false, line: 2, text: "Disallow: /blog" },
      },
    ]);
  });

  it("evaluates another group on request", async () => {
    const body = await (await post({ url: "https://example.com", urls: ["/nogoogle"], agent: "Googlebot" })).json();
    expect(body.results[0].live).toMatchObject({ allowed: false, line: 5 });
  });

  it("does not judge URLs on another host", async () => {
    const body = await (await post({ url: "https://example.com", urls: ["https://other.test/x"] })).json();
    expect(body.results).toEqual([{ url: "https://other.test/x", error: "other_host" }]);
  });

  it("says when the live file could not be read", async () => {
    fetchRobots.mockResolvedValue(denyAllRules());
    const body = await (await post({ url: "https://example.com", urls: ["/a"] })).json();
    expect(body.live).toEqual({ found: false, unreachable: true });
    expect(body.results[0].live.allowed).toBe(false);
  });

  it.each([
    [{ url: "http://127.0.0.1/", urls: ["/a"] }],
    [{ url: "https://example.com", urls: [] }],
    [{ url: "https://example.com", urls: Array(101).fill("/a") }],
    [{ url: "https://example.com", urls: ["/a"], agent: "bad agent!" }],
  ])("400 on %o", async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(fetchRobots).not.toHaveBeenCalled();
  });
});
