// Login log: every sign-in attempt (time, user, IP, outcome) in login_events,
// kept 90 days; the application log carries no email and no IP.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Authorize = (c: Record<string, unknown>, r: Request) => Promise<unknown>;
const m = vi.hoisted(() => ({
  loginEvent: { create: vi.fn(), deleteMany: vi.fn() },
  user: { findUnique: vi.fn() },
  verifyPassword: vi.fn(),
  rateLimit: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
  cfg: null as null | { providers: { authorize: Authorize }[] },
}));

vi.mock("@/lib/prisma", () => ({ prisma: { loginEvent: m.loginEvent, user: m.user } }));
vi.mock("@/lib/password", () => ({ verifyPassword: m.verifyPassword }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: m.log }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("next-auth/providers/credentials", () => ({ default: (c: unknown) => c }));
vi.mock("next-auth", () => ({
  default: (cfg: typeof m.cfg) => {
    m.cfg = cfg;
    return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() };
  },
}));

import { LOGIN_EVENT_RETENTION_DAYS, loginEmailHash, purgeOldLoginEvents, recordLogin } from "@/lib/login-events";
import "@/lib/auth";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const EMAIL = "Jane@Example.test";
const IP = "198.51.100.7";

const signIn = (password = "pw") =>
  m.cfg!.providers[0].authorize(
    { email: EMAIL, password },
    new Request("https://echorank360.com/api/auth/callback/credentials", {
      headers: { "cf-connecting-ip": IP, "x-forwarded-for": `${IP}, 10.0.0.1` },
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockResolvedValue({ success: true });
  m.user.findUnique.mockResolvedValue({ id: "u1", email: "jane@example.test", passwordHash: "h", name: null, image: null });
  m.verifyPassword.mockResolvedValue(true);
});

describe("sign-in records", () => {
  it("a success: time, user, IP", async () => {
    expect(await signIn()).toMatchObject({ id: "u1" });
    expect(m.loginEvent.create).toHaveBeenCalledWith({
      data: { userId: "u1", emailHash: null, ip: IP, success: true, reason: null },
    });
  });

  it("a wrong password: the user, the IP, the reason", async () => {
    m.verifyPassword.mockResolvedValue(false);
    expect(await signIn("nope")).toBeNull();
    expect(m.loginEvent.create.mock.calls[0][0].data).toEqual({
      userId: "u1", emailHash: null, ip: IP, success: false, reason: "bad_password",
    });
  });

  it("an unknown email: a hash of it, never the address", async () => {
    m.user.findUnique.mockResolvedValue(null);
    await signIn();
    const data = m.loginEvent.create.mock.calls[0][0].data;
    expect(data).toEqual({ userId: null, emailHash: loginEmailHash(EMAIL), ip: IP, success: false, reason: "no_such_user" });
    expect(JSON.stringify(data).toLowerCase()).not.toContain("example.test");
  });

  it("a rate-limited attempt is recorded too", async () => {
    m.rateLimit.mockResolvedValueOnce({ success: false });
    await signIn();
    expect(m.loginEvent.create.mock.calls[0][0].data).toMatchObject({ success: false, reason: "rate_limited_ip" });
  });

  it("the application log carries neither the email nor the IP", async () => {
    await signIn();
    m.verifyPassword.mockResolvedValue(false);
    await signIn();
    const logged = JSON.stringify([...m.log.info.mock.calls, ...m.log.warn.mock.calls]).toLowerCase();
    expect(logged).not.toContain("example.test");
    expect(logged).not.toContain(IP);
    expect(logged).toContain('"xffdiffers":false');
  });

  it("a failed write never fails the sign-in", async () => {
    m.loginEvent.create.mockRejectedValue(new Error("db down"));
    expect(await signIn()).toMatchObject({ id: "u1" });
    await expect(recordLogin({ email: "x@y.z", ip: "unknown", success: false })).resolves.toBeUndefined();
  });

  it("an unresolvable IP is stored as null", async () => {
    await recordLogin({ userId: "u1", email: "x@y.z", ip: "unknown", success: true });
    expect(m.loginEvent.create.mock.calls[0][0].data.ip).toBeNull();
  });
});

describe("90-day retention", () => {
  it("the purge deletes rows older than 90 days", async () => {
    m.loginEvent.deleteMany.mockResolvedValue({ count: 3 });
    const now = new Date("2026-11-07T03:35:00Z");
    expect(await purgeOldLoginEvents(now)).toBe(3);
    expect(LOGIN_EVENT_RETENTION_DAYS).toBe(90);
    expect(m.loginEvent.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date("2026-08-09T03:35:00Z") } },
    });
  });

  it("runs nightly on the visibility-monitoring queue; account deletion cascades; the export includes them", () => {
    const worker = read("src/infrastructure/queue/workers/visibility-monitoring.worker.ts");
    expect(worker).toContain('const LOGIN_EVENTS_PURGE_JOB_NAME = "login-events-purge";');
    expect(worker).toMatch(/\{ loginEventsPurge: true \},\s*\{\s*repeat: \{ pattern: "35 3 \* \* \*", tz: "UTC" \}/);
    expect(read("prisma/schema.prisma")).toMatch(/user\s+User\?\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)\n\s+emailHash/);
    expect(read("src/lib/privacy/export.ts")).toContain("signIns: logins");
  });
});
