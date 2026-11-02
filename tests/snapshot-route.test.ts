// tests/snapshot-route.test.ts
//
// POST /api/free/v1/snapshot: the spend order. A cached domain is served to
// anyone (over the IP limit included) without touching the allowance; a new
// domain over the limit is refused; nothing is queued without Turnstile. And
// the run id hands out the preview only — the full report needs the token
// an email unlock returns.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  verifyTurnstile: vi.fn(),
  findCached: vi.fn(),
  createSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  unlock: vi.fn(),
  takeIpAllowance: vi.fn(),
  refundIpAllowance: vi.fn(),
  lockDomain: vi.fn(),
  unlockDomain: vi.fn(),
  takePrefillAllowance: vi.fn(),
  enqueueSnapshot: vi.fn(),
  enqueueSnapshotEmail: vi.fn(),
}));

vi.mock("@/lib/snapshot/turnstile", () => ({ verifyTurnstile: m.verifyTurnstile }));
vi.mock("@/lib/snapshot/store", () => ({
  findCached: m.findCached,
  createSnapshot: m.createSnapshot,
  getSnapshot: m.getSnapshot,
  unlock: m.unlock,
}));
vi.mock("@/lib/snapshot/limits", async (orig) => ({
  ...(await orig<typeof import("@/lib/snapshot/limits")>()),
  takeIpAllowance: m.takeIpAllowance,
  refundIpAllowance: m.refundIpAllowance,
  lockDomain: m.lockDomain,
  unlockDomain: m.unlockDomain,
  takePrefillAllowance: m.takePrefillAllowance,
}));
vi.mock("@/lib/snapshot/job", () => ({ enqueueSnapshot: m.enqueueSnapshot, enqueueSnapshotEmail: m.enqueueSnapshotEmail }));
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => ({}) }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { POST } from "@/app/api/free/v1/snapshot/route";
import { GET as getRun } from "@/app/api/free/v1/snapshot/[id]/route";
import { POST as unlockRun } from "@/app/api/free/v1/snapshot/[id]/unlock/route";

const body = { brand: "Acme Plumbing", domain: "https://www.AcmePlumbing.co.uk/", category: "emergency plumber", city: "Leeds", turnstileToken: "t" };
const post = (b: unknown = body) =>
  POST(new Request("http://x/api/free/v1/snapshot", { method: "POST", body: JSON.stringify(b), headers: { "cf-connecting-ip": "203.0.113.9" } }));

const ID = "cmh0000000000000000000001";
const REPORT = {
  brand: "Acme Plumbing",
  domain: "acmeplumbing.co.uk",
  category: "emergency plumber",
  location: "Leeds",
  engines: [{ engine: "openai", model: "m", asked: 10, answered: 10, mentioned: 0, cited: 0, mentionRate: 0, citationRate: 0 }],
  competitors: [{ name: "Pipeworks Ltd", count: 6, byEngine: { openai: 6 } }],
  prompts: [{ index: 0, kind: "best", text: "q", results: {} }],
  sources: [{ domain: "checkatrade.com", timesCited: 4 }],
  capped: false,
  generatedAt: "2026-11-02T05:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "k";
  process.env.OPENAI_SNAPSHOT_MODEL = "gpt-4.1-mini";
  m.verifyTurnstile.mockResolvedValue("ok");
  m.findCached.mockResolvedValue(null);
  m.takeIpAllowance.mockResolvedValue("ok");
  m.lockDomain.mockResolvedValue(true);
  m.createSnapshot.mockImplementation(async (d) => ({ id: ID, status: "queued", ...d }));
  m.takePrefillAllowance.mockResolvedValue(true);
});

describe("POST /api/free/v1/snapshot", () => {
  it("queues a new run with the normalised domain and the 10-prompt set", async () => {
    const res = await post();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ id: ID, status: "queued", cached: false });
    const created = m.createSnapshot.mock.calls[0][0];
    expect(created.domain).toBe("acmeplumbing.co.uk");
    expect(created.prompts).toHaveLength(10);
    expect(created.engines).toEqual(["openai"]);
    expect(m.enqueueSnapshot).toHaveBeenCalledWith(ID);
    expect(m.unlockDomain).toHaveBeenCalledWith("acmeplumbing.co.uk");
  });

  it("serves a domain checked in the last 7 days from cache, without spending the allowance", async () => {
    m.findCached.mockResolvedValue({ id: ID, status: "done" });
    const res = await post();
    expect(await res.json()).toEqual({ id: ID, status: "done", cached: true });
    expect(m.takeIpAllowance).not.toHaveBeenCalled();
    expect(m.createSnapshot).not.toHaveBeenCalled();
  });

  it("over the IP limit: a cached domain is still served; a new one is refused 429", async () => {
    m.takeIpAllowance.mockResolvedValue("limited");
    m.findCached.mockResolvedValueOnce({ id: ID, status: "done" });
    expect((await post()).status).toBe(200);
    const res = await post();
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
    expect(m.createSnapshot).not.toHaveBeenCalled();
  });

  it("nothing runs without Turnstile, and nothing at all when it is not configured", async () => {
    m.verifyTurnstile.mockResolvedValueOnce("failed");
    expect((await post()).status).toBe(403);
    m.verifyTurnstile.mockResolvedValueOnce("unconfigured");
    expect((await post()).status).toBe(503);
    expect(m.findCached).not.toHaveBeenCalled();
  });

  it("refuses junk and blocklisted input before Turnstile", async () => {
    expect((await post({ ...body, domain: "localhost" })).status).toBe(400);
    expect((await post({ ...body, domain: "10.0.0.1" })).status).toBe(400);
    expect((await post({ ...body, brand: "xxx cams" })).status).toBe(400);
    expect((await post({ ...body, category: "plumber https://evil.example" })).status).toBe(400);
    expect(m.verifyTurnstile).not.toHaveBeenCalled();
  });

  it("Redis down fails closed: no new paid run", async () => {
    m.takeIpAllowance.mockResolvedValue("unavailable");
    expect((await post()).status).toBe(503);
    expect(m.createSnapshot).not.toHaveBeenCalled();
  });

  it("a queueing failure gives the visitor their allowance back", async () => {
    m.enqueueSnapshot.mockRejectedValueOnce(new Error("redis"));
    expect((await post()).status).toBe(503);
    expect(m.refundIpAllowance).toHaveBeenCalled();
  });
});

describe("the email gate", () => {
  const ctx = { params: Promise.resolve({ id: ID }) };

  it("the run id returns the preview only: rates, competitor names, a source count", async () => {
    m.getSnapshot.mockResolvedValue({ id: ID, status: "done", brand: "Acme", domain: "acmeplumbing.co.uk", prompts: [{ text: "q" }], report: REPORT });
    const data = await (await getRun(new Request("http://x"), ctx)).json();
    expect(data.preview).toEqual({
      brand: "Acme Plumbing",
      domain: "acmeplumbing.co.uk",
      engines: REPORT.engines,
      competitors: ["Pipeworks Ltd"],
      sourceCount: 1,
      notMentioned: true,
      capped: false,
    });
    expect(JSON.stringify(data)).not.toContain("checkatrade.com");
    expect(data.report).toBeUndefined();
  });

  it("an email unlock returns the token and full report and queues the PDF email", async () => {
    m.getSnapshot.mockResolvedValue({ id: ID, status: "done", report: REPORT });
    m.unlock.mockResolvedValue({ token: "tok_abcdefghijklmnopqrstu", leadId: "lead1", expiresAt: new Date("2026-12-02T00:00:00Z") });
    const res = await unlockRun(
      new Request("http://x", { method: "POST", body: JSON.stringify({ email: " Me@Example.com ", consent: false, locale: "fr" }) }),
      ctx,
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.token).toBe("tok_abcdefghijklmnopqrstu");
    expect(data.report.sources[0].domain).toBe("checkatrade.com");
    expect(m.unlock).toHaveBeenCalledWith(ID, { email: "me@example.com", locale: "fr", marketingConsent: false });
    expect(m.enqueueSnapshotEmail).toHaveBeenCalledWith("lead1");
  });

  it("refuses a bad email, and a run that is not done", async () => {
    m.getSnapshot.mockResolvedValue({ id: ID, status: "running", report: null });
    const req = (email: string) => new Request("http://x", { method: "POST", body: JSON.stringify({ email }) });
    expect((await unlockRun(req("nope"), ctx)).status).toBe(400);
    expect((await unlockRun(req("a@b.co"), ctx)).status).toBe(409);
    expect(m.unlock).not.toHaveBeenCalled();
  });
});
