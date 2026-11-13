// Billing shows only the meters the plan includes (CANCEL-FAIR-PLAY, part 4).
// A crawler-only tenant used to see "Feedback Requests 0 / 10,000": a meter
// for a feature its plan does not have, with a limit from
// Tenant.monthlyRequestLimit that no plan sets.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const m = vi.hoisted(() => ({
  requireTenant: vi.fn(),
  tenantFind: vi.fn(),
  subscriptionFind: vi.fn(),
  feedbackCount: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: m.tenantFind },
    subscription: { findUnique: m.subscriptionFind },
    feedback: { count: m.feedbackCount },
  },
}));
vi.mock("@/lib/tenant", () => ({ requireTenant: m.requireTenant }));
vi.mock("@/lib/site-crawler/page-allowance", () => ({
  pageAllowance: vi.fn(async () => ({ used: 120, limit: 300_000, resetsAt: "2026-12-01T00:00:00.000Z" })),
}));
vi.mock("@/lib/billing/subscription-charge", () => ({ chargeForPrice: vi.fn(async () => ({ kind: "config" })) }));

import { UsageMeters } from "@/components/billing/usage-meters";
import { BILLING_COPY } from "@/lib/i18n/dashboard";

async function get(planType: string) {
  m.tenantFind.mockResolvedValue({ id: "t1", planType, billingStatus: "TRIALING", monthlyRequestLimit: 10_000 });
  const { GET } = await import("@/app/api/billing/route");
  return (await GET()).json();
}

beforeEach(() => {
  vi.clearAllMocks();
  m.requireTenant.mockResolvedValue({ tenantId: "t1" });
  m.subscriptionFind.mockResolvedValue({ id: "s1", status: "TRIALING", stripePriceId: "price_x", cancelAtPeriodEnd: false });
  m.feedbackCount.mockResolvedValue(3);
});

describe("GET /api/billing: which meters the plan includes", () => {
  it("NOSY_BAT: no feedback meter (and no count query), the page allowance only", async () => {
    const body = await get("NOSY_BAT");
    expect(body.usage.feedbackIncluded).toBe(false);
    expect(m.feedbackCount).not.toHaveBeenCalled();
    expect(body.usage.crawlPages).toMatchObject({ limit: 300_000 });
  });

  it("AI_VISIBILITY: no feedback meter", async () => {
    expect((await get("AI_VISIBILITY")).usage.feedbackIncluded).toBe(false);
  });

  it.each(["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"])("%s: the feedback meter, counted", async (plan) => {
    const body = await get(plan);
    expect(body.usage.feedbackIncluded).toBe(true);
    expect(body.usage.feedbackSent).toBe(3);
  });
});

describe("<UsageMeters>", () => {
  const t = BILLING_COPY.en;
  const pages = { used: 120, limit: 300_000, resetsAt: "2026-12-01T00:00:00.000Z" };

  it("a crawler-only tenant sees its page allowance and no Feedback Requests", () => {
    const html = renderToStaticMarkup(
      createElement(UsageMeters, { locale: "en", t, crawlerName: "Nosy Bat", feedback: null, crawlPages: pages }),
    );
    expect(html).not.toContain("Feedback Requests");
    expect(html).not.toContain("10,000");
    expect(html).toContain("120 / 300,000 pages this month");
  });

  it("a reputation plan sees both", () => {
    const html = renderToStaticMarkup(
      createElement(UsageMeters, { locale: "en", t, crawlerName: "Nosy Bat", feedback: { used: 3, limit: 500 }, crawlPages: pages }),
    );
    expect(html).toContain("Feedback Requests");
    expect(html).toContain("3 / 500");
  });

  it("no meter at all: no empty card", () => {
    expect(
      renderToStaticMarkup(createElement(UsageMeters, { locale: "en", t, crawlerName: "Nosy Bat", feedback: null, crawlPages: null })),
    ).toBe("");
  });
});
