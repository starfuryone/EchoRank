// tests/guest-welcome.test.ts
//
// THE SESSION-VALIDATION MATRIX. /welcome's guest path treats a Stripe checkout
// session id as a credential, so every way that id can be wrong is a way into
// somebody's account, and each one gets a row here:
//
//   complete + guest_signup + no password yet  -> ready     (the ONLY form)
//   complete + guest_signup + password set     -> consumed  (single-use, spent)
//   complete + guest_signup + no user row yet  -> pending   (beat the webhook)
//   complete + flow=upgrade                    -> invalid
//   complete + no flow at all                  -> invalid
//   status=open / expired                      -> invalid
//   garbage / wrong shape / Stripe threw       -> invalid
//
// The last four are ONE state on purpose. A caller learns whether it may set a
// password and nothing else — not which of the four it was, and never a Stripe
// error string.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { retrieve, user, hashPassword, loggerFns } = vi.hoisted(() => ({
  retrieve: vi.fn(),
  user: { findUnique: vi.fn(), updateMany: vi.fn() },
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
loggerFns.child.mockReturnValue(loggerFns);

vi.mock("@/lib/prisma", () => ({ prisma: { user } }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({ checkout: { sessions: { retrieve } } }),
}));
vi.mock("@/lib/password", () => ({ hashPassword }));

const SESSION = "cs_test_a1b2c3d4e5f6g7h8";
const EMAIL = "guest@example.com";

function stripeSession(over: Record<string, unknown> = {}) {
  return {
    id: SESSION,
    status: "complete",
    customer_details: { email: EMAIL },
    customer_email: null,
    metadata: { flow: "guest_signup", tier: "starter" },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  retrieve.mockResolvedValue(stripeSession());
  user.findUnique.mockResolvedValue({ id: "u1", passwordHash: null });
  user.updateMany.mockResolvedValue({ count: 1 });
});

// ─── The matrix ─────────────────────────────────────────────────────────────

describe("resolveGuestSession", () => {
  it("is ready when the session is complete, ours, and the password is unset", async () => {
    const { resolveGuestSession } = await import("@/lib/billing/guest-welcome");
    const state = await resolveGuestSession(SESSION);

    expect(state).toEqual({
      kind: "ready",
      email: EMAIL,
      planName: expect.any(String),
      planHome: expect.any(String),
    });
  });

  it("is consumed once a password exists — the single-use marker", async () => {
    // passwordHash IS the marker. There is no consumedAt to fall out of step
    // with it, and no migration needed to add one.
    user.findUnique.mockResolvedValue({ id: "u1", passwordHash: "$2b$10$whatever" });
    const { resolveGuestSession } = await import("@/lib/billing/guest-welcome");

    expect(await resolveGuestSession(SESSION)).toEqual({ kind: "consumed" });
  });

  it("is pending when the buyer beat the webhook", async () => {
    // A normal outcome, not an error: it must render a wait, never a form
    // against a user row that does not exist.
    user.findUnique.mockResolvedValue(null);
    const { resolveGuestSession } = await import("@/lib/billing/guest-welcome");

    expect(await resolveGuestSession(SESSION)).toEqual({ kind: "pending" });
  });

  const rejects: Array<[string, () => void]> = [
    ["an upgrade session pasted into the guest flow", () =>
      retrieve.mockResolvedValue(stripeSession({ metadata: { flow: "upgrade", tier: "starter" } }))],
    ["a credit-pack session", () =>
      retrieve.mockResolvedValue(stripeSession({ metadata: { flow: "credit_pack" } }))],
    ["a session with no flow at all", () =>
      retrieve.mockResolvedValue(stripeSession({ metadata: {} }))],
    ["a session that was never completed", () =>
      retrieve.mockResolvedValue(stripeSession({ status: "open" }))],
    ["an expired session", () =>
      retrieve.mockResolvedValue(stripeSession({ status: "expired" }))],
    ["a complete session carrying no email", () =>
      retrieve.mockResolvedValue(
        stripeSession({ customer_details: { email: null }, customer_email: null }),
      )],
    ["an id Stripe refuses outright", () =>
      retrieve.mockRejectedValue(new Error("No such checkout.session: cs_test_aaaa"))],
  ];

  for (const [label, arrange] of rejects) {
    it(`is invalid for ${label}`, async () => {
      arrange();
      const { resolveGuestSession } = await import("@/lib/billing/guest-welcome");

      expect(await resolveGuestSession(SESSION)).toEqual({ kind: "invalid" });
    });
  }

  it("is invalid for a malformed id without spending a Stripe call", async () => {
    const { resolveGuestSession } = await import("@/lib/billing/guest-welcome");

    for (const bad of ["", "cs_", "nonsense", "cs_test_aa", "../../etc/passwd", "cs_" + "x".repeat(200)]) {
      expect(await resolveGuestSession(bad), bad).toEqual({ kind: "invalid" });
    }
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("never returns a Stripe error string to its caller", async () => {
    retrieve.mockRejectedValue(new Error("No such checkout.session: cs_test_aaaa; req_9xY"));
    const { resolveGuestSession } = await import("@/lib/billing/guest-welcome");

    const state = await resolveGuestSession(SESSION);
    // The whole returned value, serialised, must not carry the detail.
    expect(JSON.stringify(state)).not.toMatch(/No such|req_|cs_test_aaaa/);
  });
});

// ─── Spending the id ────────────────────────────────────────────────────────

describe("setGuestPassword", () => {
  it("sets the password with passwordHash: null in the WHERE", async () => {
    // That null is the lock. Dropping it turns this into a password reset
    // anyone holding a spent session id can call.
    const { setGuestPassword } = await import("@/lib/billing/guest-welcome");
    const result = await setGuestPassword(SESSION, "correct horse battery");

    expect(result).toEqual({ ok: true, email: EMAIL, planHome: expect.any(String) });
    expect(user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", passwordHash: null },
      data: { passwordHash: "hashed:correct horse battery" },
    });
  });

  it("refuses a session whose password is already set", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", passwordHash: "$2b$10$x" });
    const { setGuestPassword } = await import("@/lib/billing/guest-welcome");

    expect(await setGuestPassword(SESSION, "another password")).toEqual({
      ok: false,
      reason: "consumed",
    });
    expect(user.updateMany).not.toHaveBeenCalled();
  });

  it("refuses when the compare-and-swap loses a concurrent race", async () => {
    // Both requests passed the read above; the database decides which one is
    // the first password. count === 0 means this one was not it.
    user.updateMany.mockResolvedValue({ count: 0 });
    const { setGuestPassword } = await import("@/lib/billing/guest-welcome");

    expect(await setGuestPassword(SESSION, "second one in")).toEqual({
      ok: false,
      reason: "consumed",
    });
  });

  it("refuses an upgrade session, so a paying customer cannot be taken over", async () => {
    retrieve.mockResolvedValue(stripeSession({ metadata: { flow: "upgrade" } }));
    const { setGuestPassword } = await import("@/lib/billing/guest-welcome");

    expect(await setGuestPassword(SESSION, "not yours")).toEqual({ ok: false, reason: "invalid" });
    expect(user.updateMany).not.toHaveBeenCalled();
  });

  it("refuses an incomplete session", async () => {
    retrieve.mockResolvedValue(stripeSession({ status: "open" }));
    const { setGuestPassword } = await import("@/lib/billing/guest-welcome");

    expect(await setGuestPassword(SESSION, "not paid")).toEqual({ ok: false, reason: "invalid" });
    expect(user.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a cs_-shaped id Stripe has never heard of", async () => {
    // cs_test_aaaa passes the cheap shape check on purpose — it IS the shape.
    // Stripe is the authority on whether it exists, and its 404 becomes the
    // same `invalid` as everything else.
    retrieve.mockRejectedValue(new Error("No such checkout.session: cs_test_aaaa"));
    const { setGuestPassword } = await import("@/lib/billing/guest-welcome");

    expect(await setGuestPassword("cs_test_aaaa", "x".repeat(12))).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(user.findUnique).not.toHaveBeenCalled();
    expect(user.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a misshapen id without spending a Stripe call at all", async () => {
    const { setGuestPassword } = await import("@/lib/billing/guest-welcome");

    for (const bad of ["", "cs_", "hunter2", "../../etc/passwd"]) {
      expect(await setGuestPassword(bad, "x".repeat(12)), bad).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
    expect(retrieve).not.toHaveBeenCalled();
    expect(user.updateMany).not.toHaveBeenCalled();
  });
});
