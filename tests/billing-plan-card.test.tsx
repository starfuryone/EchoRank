// The Billing plan card, the /billing/cancel confirmation page, and what a
// CANCELED tenant sees (CANCEL-FAIR-PLAY). Server-rendered to markup with
// the real components and catalogs; the DB and session are fakes.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";

const m = vi.hoisted(() => ({
  membership: null as null | { tenantId: string; userId: string; role: string; tenant: { id: string; planType: string; stripeCustomerId: string | null } },
  sub: null as null | Record<string, unknown>,
  billing: null as null | { status: string | null; hasSubscriptionRow: boolean; watcherOnly: boolean; needsPlanSelection: boolean },
  pathname: "/crawler",
  ownerName: "Ada Owner" as string | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: (k: string) => (k === "x-pathname" ? m.pathname : null) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => m.pathname,
}));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "u1", name: "U", email: "u@example.test" } }) }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => m.membership }));
vi.mock("@/lib/paid-plan", async (orig) => {
  const real = await orig<typeof import("@/lib/paid-plan")>();
  return { ...real, getBillingContext: async () => m.billing };
});
vi.mock("@/lib/prisma", () => ({
  prisma: { subscription: { findUnique: async () => m.sub } },
}));
vi.mock("@/lib/billing/cancellation", () => ({ billingOwnerName: async () => m.ownerName }));
vi.mock("@/lib/notifications/store", () => ({ unreadNotificationCount: async () => 0 }));
vi.mock("@/lib/credits/store", () => ({ creditBalance: async () => 0, creditHistory: async () => [] }));

import { PlanStatusCard, OUTLINE_BUTTON_CLASS, type PlanStatusCardProps } from "@/components/billing/plan-status-card";
import { planCardAction, planCardState } from "@/lib/billing/plan-card-state";
import { BILLING_COPY } from "@/lib/i18n/dashboard";

const END = "2026-11-20T13:18:06.000Z";

function card(over: Partial<PlanStatusCardProps>) {
  const props: PlanStatusCardProps = {
    locale: "en",
    t: BILLING_COPY.en,
    state: "trial",
    status: "TRIALING",
    planLabel: "Nosy Bat",
    price: "$15/month",
    priceText: "$15/month",
    periodEnd: END,
    canManage: true,
    ownerName: null,
    hasPortal: true,
    onPortal: () => {},
    portalBusy: false,
    portalError: false,
    onResume: () => {},
    resumeBusy: false,
    resumeError: false,
    cancelHelpHref: "/en/help/cancel-subscription",
    ...over,
  };
  return renderToStaticMarkup(createElement(PlanStatusCard, props));
}

describe("planCardState", () => {
  it.each([
    ["TRIALING", false, "trial", "cancel"],
    ["ACTIVE", false, "renewing", "cancel"],
    ["TRIALING", true, "cancelling", "resume"],
    ["ACTIVE", true, "cancelling", "resume"],
    ["CANCELED", false, "ended", null],
    ["CANCELED", true, "ended", null],
    ["PAST_DUE", false, "past_due", "cancel"],
    ["NONE", false, "none", null],
  ] as const)("%s, cancelAtPeriodEnd=%s → %s", (status, cancelAtPeriodEnd, state, action) => {
    expect(planCardState({ status, cancelAtPeriodEnd })).toBe(state);
    expect(planCardAction(state)).toBe(action);
  });
});

describe("the plan card tells the truth, with dates", () => {
  it("trial: ends {date}, then {price}; Cancel + Payment method & invoices", () => {
    const html = card({ state: "trial" });
    expect(html).toContain("Free trial — ends November 20, 2026, then $15/month.");
    expect(html).toContain('href="/billing/cancel"');
    expect(html).toContain("Cancel subscription");
    expect(html).toContain("Payment method &amp; invoices");
    expect(html).not.toContain("Resume subscription");
    expect(html).not.toContain("Manage subscription");
  });

  it("renewing: {price} · renews {date}", () => {
    const html = card({ state: "renewing", status: "ACTIVE", priceText: "$144.00/year", price: "$144.00/year" });
    expect(html).toContain("$144.00/year · renews November 20, 2026.");
    expect(html).toContain("Cancel subscription");
  });

  it("cancelling: access until {date}, not charged again; Resume replaces Cancel", () => {
    const html = card({ state: "cancelling", status: "TRIALING" });
    expect(html).toContain("Cancelled — access until November 20, 2026. You won&#x27;t be charged again.");
    // The badge spells it the way the sentence does.
    expect(html).toMatch(/>Cancelled<\/span>/);
    expect(html).not.toContain(">Canceled<");
    expect(html).toContain("Resume subscription");
    expect(html).not.toContain('href="/billing/cancel"');
    expect(html).toContain("Payment method &amp; invoices");
  });

  it("ended: says the plan ended and links to the plans", () => {
    const html = card({ state: "ended", status: "CANCELED" });
    expect(html).toContain("Your plan ended on November 20, 2026.");
    expect(html).toContain('href="#plans"');
    expect(html).not.toContain("Cancel subscription");
    expect(html).not.toContain("Resume subscription");
  });

  it("every locale has every state line, de-CH with no ß", () => {
    for (const locale of ["en", "fr", "de-CH"] as const) {
      const t = BILLING_COPY[locale];
      const lines = [
        t.stateTrial("X", "P"),
        t.stateRenewing("P", "X"),
        t.stateCancelling("X"),
        t.stateEnded("X"),
        t.cancelledBanner("X"),
        t.ownerOnly("O"),
        t.cancelPageTitle("Starter"),
        t.factAccess("X"),
        t.factResume("X"),
      ];
      for (const l of lines) expect(l.trim().length, locale).toBeGreaterThan(0);
      if (locale === "de-CH") expect(JSON.stringify(lines) + t.dismiss).not.toMatch(/ß/);
    }
  });
});

describe("fair play: the Cancel button", () => {
  it("has the same size and weight as the card's other button", () => {
    const html = card({ state: "renewing", status: "ACTIVE" });
    const cancel = html.match(/<a[^>]*data-testid="billing-cancel"[^>]*>/)![0];
    const portal = html.match(/<button[^>]*data-testid="billing-portal"[^>]*>/)![0];
    const cls = (tag: string) => new Set(tag.match(/class="([^"]+)"/)![1].split(/\s+/));
    const shared = ["border", "border-gray-300", "bg-white", "text-gray-700", "px-4", "py-2", "text-sm", "font-medium", "rounded-lg"];
    for (const c of shared) {
      expect(cls(cancel).has(c), `cancel lacks ${c}`).toBe(true);
      expect(cls(portal).has(c), `portal lacks ${c}`).toBe(true);
    }
    expect(OUTLINE_BUTTON_CLASS).not.toMatch(/opacity|text-gray-[34]00|sr-only|hidden/);
  });

  it("sits before the portal button, on the card itself, not in a menu", () => {
    const html = card({ state: "renewing", status: "ACTIVE" });
    expect(html.indexOf('data-testid="billing-cancel"')).toBeLessThan(html.indexOf('data-testid="billing-portal"'));
    expect(html).not.toMatch(/aria-haspopup|role="menu"/);
  });

  it("is absent for a role that cannot cancel, which is told who can", () => {
    const html = card({ state: "renewing", status: "ACTIVE", canManage: false, ownerName: "Ada Owner" });
    expect(html).not.toContain('data-testid="billing-cancel"');
    expect(html).not.toContain('data-testid="billing-portal"');
    expect(html).toContain("Only Ada Owner can cancel this subscription.");
  });

  it("the owner message has a fallback when the owner has no name", () => {
    expect(card({ state: "trial", canManage: false, ownerName: null })).toContain(
      "Only the account owner can cancel this subscription.",
    );
  });
});

// ── /billing/cancel ─────────────────────────────────────────────────────────

async function cancelPage() {
  const { default: Page } = await import("@/app/(dashboard)/billing/cancel/page");
  return renderToStaticMarkup((await Page()) as ReactElement);
}

beforeEach(() => {
  m.membership = { tenantId: "tA", userId: "u1", role: "OWNER", tenant: { id: "tA", planType: "NOSY_BAT", stripeCustomerId: "cus_A" } };
  m.sub = { productKind: "PLAN", planType: "NOSY_BAT", status: "TRIALING", cancelAtPeriodEnd: false, currentPeriodEnd: new Date(END), stripeSubscriptionId: "sub_A" };
  m.billing = { status: "TRIALING", hasSubscriptionRow: true, watcherOnly: false, needsPlanSelection: false };
  m.ownerName = "Ada Owner";
});

describe("/billing/cancel", () => {
  it("trial: the real facts from the subscription, an optional reason, two actions", async () => {
    const html = await cancelPage();
    expect(html).toContain("Cancel your Nosy Bat subscription");
    expect(html).toContain("You won&#x27;t be charged.");
    expect(html).not.toContain("charged again");
    expect(html).toContain("You keep full access until November 20, 2026.");
    expect(html).toContain("You can resume with one click any time before November 20, 2026.");
    expect(html).toContain("Why are you cancelling? (optional)");
    for (const r of ["Too expensive", "Missing a feature", "Only needed it once", "Switching to another tool", "Other"]) {
      expect(html).toContain(r);
    }
    // Optional: nothing on the form is required.
    expect(html).not.toMatch(/\brequired\b/);
    expect(html).toContain('href="/billing"');
    expect(html).toContain("Keep my plan");
    // No retention promise: there is no retention setting to quote.
    expect(html).not.toMatch(/days after that|Export them/);
  });

  it("paid: won't be charged AGAIN", async () => {
    m.sub = { ...m.sub, status: "ACTIVE", planType: "STARTER" };
    const html = await cancelPage();
    expect(html).toContain("Cancel your Starter subscription");
    expect(html).toContain("You won&#x27;t be charged again.");
  });

  it("no retention offer, no discount, no countdown, no contact-us", async () => {
    const html = (await cancelPage()).toLowerCase();
    for (const banned of ["discount", "% off", "offer", "contact us", "support@", "chat", "hours left", "are you sure"]) {
      expect(html, banned).not.toContain(banned);
    }
  });

  it("already cancelling: says so with the date, links back", async () => {
    m.sub = { ...m.sub, cancelAtPeriodEnd: true };
    const html = await cancelPage();
    expect(html).toContain("already cancelled. You keep access until November 20, 2026.");
    expect(html).not.toContain("billing-cancel-form");
  });

  it("a MEMBER is told who can, and gets no form", async () => {
    m.membership = { ...m.membership!, role: "MEMBER" };
    const html = await cancelPage();
    expect(html).toContain("Only Ada Owner can cancel this subscription.");
    expect(html).not.toContain("billing-cancel-form");
  });

  it("no subscription row, or an ended one: a plain notice, never a blank page", async () => {
    m.sub = null;
    expect(await cancelPage()).toContain("There is no active subscription to cancel.");
    m.sub = { productKind: "PLAN", planType: "STARTER", status: "CANCELED", cancelAtPeriodEnd: false, currentPeriodEnd: new Date(END), stripeSubscriptionId: "sub_A" };
    expect(await cancelPage()).toContain("There is no active subscription to cancel.");
  });
});

// ── a CANCELED tenant: /crawler, /billing, /dashboard ──────────────────────

function flatten(node: ReactNode): ReactElement[] {
  const out: ReactElement[] = [];
  const walk = (n: ReactNode) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (isValidElement(n)) {
      out.push(n);
      walk((n.props as { children?: ReactNode }).children);
    }
  };
  walk(node);
  return out;
}

describe("a CANCELED tenant gets a usable page, never an empty render", () => {
  beforeEach(() => {
    m.billing = { status: "CANCELED", hasSubscriptionRow: true, watcherOnly: false, needsPlanSelection: false };
    m.sub = { productKind: "PLAN", planType: "NOSY_BAT", status: "CANCELED", cancelAtPeriodEnd: false, currentPeriodEnd: new Date(END), stripeSubscriptionId: "sub_A" };
  });

  it("/crawler: the 'your plan has ended — resubscribe' screen, not the children", async () => {
    const { default: ToolsLayout } = await import("@/app/(dashboard)/visibility/tools/layout");
    const html = renderToStaticMarkup((await ToolsLayout({ children: createElement("p", null, "CRAWLER") })) as ReactElement);
    expect(html).not.toContain("CRAWLER");
    expect(html).toContain("Your plan has ended");
    expect(html).toContain("Resubscribe");
    expect(html).toContain('href="/billing#plans"');
  });

  it("/crawler for an unpaid, never-ended tenant keeps the upgrade wording", async () => {
    m.billing = { status: "PAST_DUE", hasSubscriptionRow: true, watcherOnly: false, needsPlanSelection: false };
    const { default: ToolsLayout } = await import("@/app/(dashboard)/visibility/tools/layout");
    const html = renderToStaticMarkup((await ToolsLayout({ children: null })) as ReactElement);
    expect(html).toContain("Go to billing");
    expect(html).not.toContain("Your plan has ended");
  });

  it("/dashboard and every other page: the ended banner above the page, page still rendered", async () => {
    m.pathname = "/reputation";
    m.membership = { ...m.membership!, tenant: { ...m.membership!.tenant, planType: "STARTER" } };
    const { default: DashboardLayout } = await import("@/app/(dashboard)/layout");
    const tree = (await DashboardLayout({ children: createElement("p", { id: "page" }, "PAGE") })) as ReactElement;
    const els = flatten((tree.props as { children: ReactNode }).children);
    const names = els.map((e) => (typeof e.type === "function" ? e.type.name : String(e.type)));
    expect(names).toContain("PlanEndedBanner");
    expect(els.some((e) => (e.props as { id?: string }).id === "page")).toBe(true);
    const banner = els.find((e) => typeof e.type === "function" && e.type.name === "PlanEndedBanner")!;
    const html = renderToStaticMarkup(banner);
    expect(html).toContain("Your plan has ended");
    expect(html).toContain('href="/billing#plans"');
  });

  it("/billing: no duplicate banner (the card says it), and the card renders the ended state", async () => {
    m.pathname = "/billing";
    const { default: DashboardLayout } = await import("@/app/(dashboard)/layout");
    const tree = (await DashboardLayout({ children: createElement("p", { id: "page" }, "PAGE") })) as ReactElement;
    const names = flatten((tree.props as { children: ReactNode }).children).map((e) =>
      typeof e.type === "function" ? e.type.name : String(e.type),
    );
    expect(names).not.toContain("PlanEndedBanner");
    const html = card({ state: "ended", status: "CANCELED" });
    expect(html).toContain("Your plan ended on");
    expect(html.length).toBeGreaterThan(200);
  });

  it.each(["/crawler", "/crawler/history", "/visibility/tools/site-crawler"])(
    "%s: no banner on top of the ended screen that already says it",
    async (path) => {
      m.pathname = path;
      const { default: DashboardLayout } = await import("@/app/(dashboard)/layout");
      const tree = (await DashboardLayout({ children: createElement("p", { id: "page" }, "PAGE") })) as ReactElement;
      const names = flatten((tree.props as { children: ReactNode }).children).map((e) =>
        typeof e.type === "function" ? e.type.name : String(e.type),
      );
      expect(names).not.toContain("PlanEndedBanner");
    },
  );

  it("/dashboard for the crawler-only plan goes to /crawler (which renders the ended screen)", async () => {
    m.pathname = "/dashboard";
    const { default: DashboardLayout } = await import("@/app/(dashboard)/layout");
    await expect(DashboardLayout({ children: null })).rejects.toThrow("REDIRECT /crawler");
  });
});
