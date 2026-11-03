// GET/PUT /api/seo/v1/crawl/accepted-words — the spell check's accepted words.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const tenant = { findUnique: vi.fn(), update: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { tenant } }));

const { GET, PUT } = await import("@/app/api/seo/v1/crawl/accepted-words/route");

const put = (body: unknown) =>
  PUT(new Request("https://app.test/api/seo/v1/crawl/accepted-words", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  vi.clearAllMocks();
  requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
});

describe("accepted words", () => {
  it("401 when signed out", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated"));
    expect((await GET()).status).toBe(401);
    expect((await put({ words: [] })).status).toBe(401);
    expect(tenant.update).not.toHaveBeenCalled();
  });

  it("reads the caller's own workspace", async () => {
    tenant.findUnique.mockResolvedValue({ spellingAcceptedWords: ["Acme"] });
    const res = await GET();
    expect(await res.json()).toMatchObject({ words: ["Acme"] });
    expect(tenant.findUnique.mock.calls[0]![0].where).toEqual({ id: "t1" });
  });

  it("saves a cleaned list on the caller's workspace only", async () => {
    const res = await put({ words: [" Acme ", "acme", "", "Zed"] });
    expect(res.status).toBe(200);
    expect(tenant.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { spellingAcceptedWords: ["Acme", "Zed"] } });
  });

  it("rejects a malformed body", async () => {
    expect((await put({ words: "Acme" })).status).toBe(400);
    expect((await put({ words: ["x".repeat(61)] })).status).toBe(400);
    expect(tenant.update).not.toHaveBeenCalled();
  });
});
