// "Your data": deletion with a 14-day grace period (src/lib/privacy/deletion.ts), the API, the
// nightly sweep, and the account export (src/lib/privacy/export.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const deleted: Record<string, unknown[]> = {};
  const fixed: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {
    dataDeletionRequest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    tenantMember: { findFirst: vi.fn(), findMany: vi.fn(async () => []) },
    tenant: { findUnique: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), delete: vi.fn() },
    pageSnapshot: { findMany: vi.fn(async () => [{ objectKey: "k1" }, { objectKey: "k1" }, { objectKey: "k2" }]), deleteMany: vi.fn(async () => ({ count: 3 })) },
  };
  const prisma = new Proxy(
    { $executeRaw: vi.fn(async () => 2) } as Record<string, unknown>,
    {
      get(target, key: string) {
        if (key in target) return target[key];
        if (fixed[key]) return fixed[key];
        // Any other delegate: findMany / deleteMany recorded per model.
        fixed[key] = {
          deleteMany: vi.fn(async (args: unknown) => {
            (deleted[key] ??= []).push(args);
            return { count: 1 };
          }),
          findMany: vi.fn(async () => []),
          findUnique: vi.fn(async () => null),
        };
        return fixed[key];
      },
    },
  );
  return {
    prisma,
    fixed,
    deleted,
    stripeCancel: vi.fn(async () => ({})),
    sendMail: vi.fn(async () => true),
    redis: { scan: vi.fn(async () => ["0", ["echorank:x:tenant12345678"]]), del: vi.fn(async (...k: string[]) => k.length) },
    deleteSnapshotObject: vi.fn(async () => {}),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => ({ subscriptions: { cancel: m.stripeCancel } }) }));
vi.mock("@/lib/mailer", () => ({ sendMail: m.sendMail }));
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => m.redis }));
vi.mock("@/lib/historical/spaces", () => ({ isSpacesConfigured: () => true, deleteSnapshotObject: m.deleteSnapshotObject }));

import { GRACE_DAYS, KEPT_MODELS, modelsWithoutFk, requestDeletion, cancelDeletion, runDueDeletions, subjectHash } from "@/lib/privacy/deletion";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const f = m.fixed;

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(m.deleted)) delete m.deleted[k];
  f.dataDeletionRequest.findFirst.mockResolvedValue(null);
  f.dataDeletionRequest.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "dr1", requestedAt: new Date(), ...data }));
  f.dataDeletionRequest.update.mockImplementation(async ({ data }: { data: unknown }) => data);
  f.user.findUnique.mockResolvedValue({ id: "user1234567890", email: "owner@example.com", name: "Owner" });
  f.tenant.findUnique.mockResolvedValue({ id: "tenant12345678", stripeSubscriptionId: "sub_1", stripeCustomerId: "cus_1" });
});

describe("which tables a cascade cannot reach", () => {
  const models = [
    { name: "Customer", fields: [{ name: "tenantId", kind: "scalar" }, { name: "tenant", kind: "object", type: "Tenant", relationFromFields: ["tenantId"] }] },
    { name: "Signal", fields: [{ name: "tenantId", kind: "scalar" }] },
    { name: "ConsentEvent", fields: [{ name: "tenantId", kind: "scalar" }, { name: "userId", kind: "scalar" }] },
    { name: "Notification", fields: [{ name: "userId", kind: "scalar" }, { name: "tenantId", kind: "scalar" }, { name: "tenant", kind: "object", type: "Tenant", relationFromFields: ["tenantId"] }] },
  ] as never;
  it("picks models with the field and no relation through it, minus the kept ones", () => {
    expect(modelsWithoutFk("tenantId", "Tenant", models)).toEqual(["Signal"]);
    expect(modelsWithoutFk("userId", "User", models)).toEqual(["Notification"]);
    expect(KEPT_MODELS.has("ConsentEvent")).toBe(true);
  });

  it("on the real schema: Signal and PageSnapshot are swept by hand, Customer cascades, ConsentEvent is kept", () => {
    const tenantLess = modelsWithoutFk("tenantId", "Tenant");
    expect(tenantLess).toEqual(expect.arrayContaining(["Signal", "PageSnapshot", "MessageEvent", "MatrixAccount"]));
    expect(tenantLess).not.toContain("Customer");
    expect(tenantLess).not.toContain("ConsentEvent");
    expect(modelsWithoutFk("userId", "User")).toEqual(expect.arrayContaining(["AssistantConversation", "NotificationRead"]));
  });
});

describe("requests", () => {
  it("an owner's request takes the workspace; 14 days of grace; the user is emailed", async () => {
    f.tenantMember.findFirst.mockResolvedValue({ role: "OWNER" });
    const now = new Date("2026-11-06T12:00:00Z");
    const r = await requestDeletion("user1234567890", "tenant12345678", now);
    expect(r).toMatchObject({ scope: "WORKSPACE", tenantId: "tenant12345678", subjectHash: subjectHash("user1234567890") });
    expect((r.runAfter as Date).getTime() - now.getTime()).toBe(GRACE_DAYS * 86_400_000);
    expect((m.sendMail.mock.calls[0] as unknown as [{ to: string[]; text: string }])[0].text).toContain("2026-11-20");
  });

  it("a member's request is the user only; a second request returns the pending one", async () => {
    f.tenantMember.findFirst.mockResolvedValue({ role: "MEMBER" });
    expect(await requestDeletion("user1234567890", "tenant12345678")).toMatchObject({ scope: "USER", tenantId: null });
    f.dataDeletionRequest.findFirst.mockResolvedValue({ id: "dr0", status: "PENDING" });
    expect(await requestDeletion("user1234567890", "tenant12345678")).toEqual({ id: "dr0", status: "PENDING" });
    expect(f.dataDeletionRequest.create).toHaveBeenCalledTimes(1);
  });

  it("cancel marks it cancelled", async () => {
    f.dataDeletionRequest.findFirst.mockResolvedValue({ id: "dr1" });
    const r = await cancelDeletion("user1234567890");
    expect(r).toMatchObject({ status: "CANCELLED", cancelledAt: expect.any(Date) });
  });
});

describe("the sweep", () => {
  it("workspace: Stripe cancelled, Spaces objects, no-FK tables, webhook payloads, the tenant, Redis, then the user — and the log keeps no ids", async () => {
    f.dataDeletionRequest.findMany.mockResolvedValue([
      { id: "dr1", scope: "WORKSPACE", tenantId: "tenant12345678", userId: "user1234567890" },
    ]);
    expect(await runDueDeletions()).toEqual({ completed: 1, failed: 0 });
    expect(m.stripeCancel).toHaveBeenCalledWith("sub_1");
    expect(m.deleteSnapshotObject.mock.calls.map((c) => (c as unknown[])[0])).toEqual(["k1", "k2"]);
    expect(m.deleted.signal).toEqual([{ where: { tenantId: "tenant12345678" } }]);
    expect(f.tenant.delete).toHaveBeenCalledWith({ where: { id: "tenant12345678" } });
    expect(m.redis.scan).toHaveBeenCalledWith("0", "MATCH", "*tenant12345678*", "COUNT", 500);
    expect(f.user.delete).toHaveBeenCalledWith({ where: { id: "user1234567890" } });
    const done = f.dataDeletionRequest.update.mock.calls.at(-1)![0].data;
    expect(done).toMatchObject({ status: "COMPLETED", userId: null, tenantId: null, completedAt: expect.any(Date) });
    expect(JSON.stringify(done.summary)).not.toMatch(/@|user1234567890|tenant12345678/);
    expect(done.summary).toMatchObject({ Tenant: 1, User: 1, "spaces.snapshots": 2 });
  });

  it("a failure marks the request FAILED (ids kept for a retry) and throws so the queue alert fires", async () => {
    f.dataDeletionRequest.findMany.mockResolvedValue([{ id: "dr2", scope: "USER", tenantId: null, userId: "user1234567890" }]);
    f.user.delete.mockRejectedValueOnce(new Error("fk violation"));
    await expect(runDueDeletions()).rejects.toThrow("1 data deletion request(s) failed");
    expect(f.dataDeletionRequest.update).toHaveBeenCalledWith({ where: { id: "dr2" }, data: { status: "FAILED", error: "fk violation" } });
  });

  it("runs nightly from the visibility-monitoring worker", () => {
    const w = read("src/infrastructure/queue/workers/visibility-monitoring.worker.ts");
    expect(w).toContain("if (job.data.dataDeletionSweep)");
    expect(w).toMatch(/\{ dataDeletionSweep: true \},\s*\{\s*repeat: \{ pattern: "20 3 \* \* \*", tz: "UTC" \}/);
  });
});

describe("the API and the page", () => {
  it("deletion needs a signed-in user and the typed confirmation; export is rate-limited and a download", () => {
    const del = read("src/app/api/account/deletion/route.ts");
    expect(del).toContain('if (body?.confirm !== "DELETE")');
    expect(del).toMatch(/requireTenant\(\)/);
    const exp = read("src/app/api/account/export/route.ts");
    expect(exp).toContain("rateLimit(`account-export:${m.userId}`, 5, 3_600_000)");
    expect(exp).toContain("content-disposition");
    expect(read("src/app/(dashboard)/settings/account/page-client.tsx")).toContain("<DataRequestsSection locale={locale} />");
  });

  it("the export never includes secrets", () => {
    const src = read("src/lib/privacy/export.ts");
    expect(src).not.toMatch(/passwordHash: true|refreshToken|accessToken|stripeSubscriptionId: true/);
  });
});
