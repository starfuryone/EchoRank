// Matrix localpart derivation and plan gating.
//
// The derivation is worth testing hard because it produces a PERMANENT,
// user-visible identifier on a homeserver we run. A collision hands one
// customer another's chat handle; an invalid character makes Synapse reject
// the registration after the nonce is already spent.
import { describe, it, expect, vi } from "vitest";

// The module imports prisma for its reconcile helpers; the derivation functions
// under test touch neither. Stubbed so the suite needs no DATABASE_URL.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import {
  deriveLocalpart,
  sanitizeLocalpart,
  resolveAvailableLocalpart,
  MAX_LOCALPART,
} from "@/lib/matrix-accounts";
import { hasFeature, getMinimumPlan } from "@/lib/feature-flags";
import type { PlanType } from "@/generated/prisma";

/** Exactly what Synapse permits in a localpart. */
const SYNAPSE_ALLOWED = /^[a-z0-9._=/-]+$/;

describe("sanitizeLocalpart", () => {
  it("lowercases and keeps only permitted characters", () => {
    expect(sanitizeLocalpart("ACME Plumbing")).toBe("acmeplumbing");
    expect(sanitizeLocalpart("jane.doe")).toBe("jane.doe");
  });

  it("folds accents to their base letter rather than dropping them", () => {
    // "Café Déjà" losing its vowels entirely would give "cfdj", which is
    // unreadable; decomposing first keeps the word recognisable.
    expect(sanitizeLocalpart("Café Déjà")).toBe("cafedeja");
    expect(sanitizeLocalpart("Zürich")).toBe("zurich");
    expect(sanitizeLocalpart("Frites Alors!")).toBe("fritesalors");
  });

  it("collapses separator runs and trims the ends", () => {
    expect(sanitizeLocalpart("--acme--")).toBe("acme");
    expect(sanitizeLocalpart("a...b")).toBe("a.b");
    expect(sanitizeLocalpart(".leading")).toBe("leading");
    expect(sanitizeLocalpart("trailing.")).toBe("trailing");
  });

  it("drops characters Synapse would reject", () => {
    for (const input of ["a@b", "a b", "a#b", "a:b", "a+b", "a$b"]) {
      expect(sanitizeLocalpart(input), input).toMatch(/^[a-z0-9._=/-]*$/);
    }
  });

  it("survives empty and non-string-ish input", () => {
    expect(sanitizeLocalpart("")).toBe("");
    expect(sanitizeLocalpart("   ")).toBe("");
    expect(sanitizeLocalpart("!!!")).toBe("");
  });
});

describe("deriveLocalpart", () => {
  it("joins tenant and user", () => {
    expect(deriveLocalpart("acme", "jane")).toBe("acme.jane");
  });

  it("always produces something Synapse accepts", () => {
    const cases: Array<[string, string]> = [
      ["ACME Plumbing", "jane.doe"],
      ["Café Déjà", "josé"],
      ["Frites Alors!", "marie-claire"],
      ["日本の会社", "田中"],
      ["", ""],
      ["   ", "!!!"],
      ["a".repeat(80), "b".repeat(80)],
    ];
    for (const [tenant, user] of cases) {
      const local = deriveLocalpart(tenant, user);
      expect(local.length, `${tenant}/${user} empty`).toBeGreaterThan(0);
      expect(local, `${tenant}/${user}`).toMatch(SYNAPSE_ALLOWED);
      expect(local.length).toBeLessThanOrEqual(MAX_LOCALPART);
    }
  });

  it("still yields a usable handle when everything sanitizes away", () => {
    // CJK-only names produce nothing after sanitizing, and those customers
    // still need an account.
    const local = deriveLocalpart("日本の会社", "田中");
    expect(local).toMatch(SYNAPSE_ALLOWED);
    expect(local.startsWith("user")).toBe(true);
  });

  it("never ends on a separator after truncation", () => {
    const local = deriveLocalpart("a".repeat(59), "b".repeat(30));
    expect(local.endsWith(".")).toBe(false);
    expect(local).toMatch(SYNAPSE_ALLOWED);
  });

  it("separates the same user across two tenants", () => {
    // The same person on two workspaces must not share one chat identity.
    expect(deriveLocalpart("acme", "jane")).not.toBe(deriveLocalpart("globex", "jane"));
  });

  it("is deterministic for the same inputs", () => {
    expect(deriveLocalpart("acme", "jane")).toBe(deriveLocalpart("acme", "jane"));
  });
});

describe("resolveAvailableLocalpart", () => {
  it("returns the base when it is free", async () => {
    const isAvailable = vi.fn(async () => true);
    expect(await resolveAvailableLocalpart("acme.jane", isAvailable)).toBe("acme.jane");
    expect(isAvailable).toHaveBeenCalledTimes(1);
  });

  it("suffixes -2 on the first collision", async () => {
    const taken = new Set(["acme.jane"]);
    const isAvailable = vi.fn(async (u: string) => !taken.has(u));
    expect(await resolveAvailableLocalpart("acme.jane", isAvailable)).toBe("acme.jane-2");
  });

  it("walks to -3 and beyond", async () => {
    const taken = new Set(["acme.jane", "acme.jane-2", "acme.jane-3"]);
    const isAvailable = vi.fn(async (u: string) => !taken.has(u));
    expect(await resolveAvailableLocalpart("acme.jane", isAvailable)).toBe("acme.jane-4");
  });

  it("keeps every candidate valid and within length", async () => {
    const isAvailable = vi.fn(async (u: string) => {
      expect(u).toMatch(SYNAPSE_ALLOWED);
      expect(u.length).toBeLessThanOrEqual(MAX_LOCALPART);
      return u.endsWith("-5");
    });
    const base = "x".repeat(MAX_LOCALPART);
    await resolveAvailableLocalpart(base, isAvailable);
  });

  it("throws rather than looping forever", async () => {
    const isAvailable = vi.fn(async () => false);
    await expect(resolveAvailableLocalpart("acme.jane", isAvailable, 3)).rejects.toThrow();
    // base + 2 suffixed attempts
    expect(isAvailable).toHaveBeenCalledTimes(3);
  });
});

describe("matrix_chat gating", () => {
  it("is GROWTH and above, never below", () => {
    expect(hasFeature("AI_VISIBILITY", "matrix_chat")).toBe(false);
    expect(hasFeature("STARTER", "matrix_chat")).toBe(false);
    expect(hasFeature("GROWTH", "matrix_chat")).toBe(true);
    expect(hasFeature("AGENCY", "matrix_chat")).toBe(true);
    expect(hasFeature("ENTERPRISE", "matrix_chat")).toBe(true);
  });

  it("reports GROWTH as the minimum plan, for the upgrade teaser", () => {
    expect(getMinimumPlan("matrix_chat")).toBe("GROWTH");
  });

  it("is monotonic up the tiers", () => {
    // A feature that appears, disappears and reappears would make the
    // downgrade hook deactivate accounts for a plan that should keep them.
    const order: PlanType[] = ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];
    const flags = order.map((p) => hasFeature(p, "matrix_chat"));
    const firstTrue = flags.indexOf(true);
    expect(firstTrue).toBeGreaterThan(-1);
    expect(flags.slice(firstTrue).every(Boolean)).toBe(true);
  });
});
