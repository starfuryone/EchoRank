// The "Your plan" hub (PLAN-HUB Part 2): getPlanResources() per plan, the
// links it draws, and the hub's plan & billing card. Stripe is mocked.
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const m = vi.hoisted(() => ({ chargeForPrice: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/billing/subscription-charge", () => ({ chargeForPrice: m.chargeForPrice }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import type { PlanType } from "@/generated/prisma";
import { getPlanResources, RESOURCE_RELEVANCE, type PlanResources } from "@/lib/plan-resources";
import { pageNeed, planMeets, upgradeTarget } from "@/lib/upgrade-target";
import { planAllowsPage } from "@/lib/plan-access";
import { guideBySlug } from "@/lib/learn-content";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { AEO_BASE } from "@/lib/aeo-course-routes";
import { PROMPT_GUIDES_BASE } from "@/lib/prompt-guide-routes";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { PLAN_HUB_COPY } from "@/lib/i18n/plan-hub";
import { PlanHub, type PlanHubProps } from "@/components/plan-hub/plan-hub";
import { subscriptionCharge, clearChargeCache } from "@/lib/plan-usage";

const PLANS: PlanType[] = ["NOSY_BAT", "AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];
const ON = { ai_search: true, kof: true, assistant: true };
const OFF = { ai_search: false, kof: false, assistant: false };
const resources = (plan: PlanType, rollouts = ON) => getPlanResources(plan, { rollouts, monthlyRequestLimit: 300 });

const DASH = join(process.cwd(), "src", "app", "(dashboard)");
/** Every (dashboard) page route on disk. */
const ROUTES: string[] = (() => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === "page.tsx") out.push("/" + relative(DASH, dir).split("/").filter((s) => !s.startsWith("(")).join("/"));
    }
  };
  walk(DASH);
  return out.map((r) => (r === "/" ? "/" : r.replace(/\/$/, "")));
})();
const routeExists = (href: string) => ROUTES.includes(href.split(/[?#]/)[0]!);

describe("getPlanResources, per plan", () => {
  for (const plan of PLANS) {
    describe(plan, () => {
      const r = resources(plan);

      it("every included item passes the gate its route uses", () => {
        for (const i of r.included) {
          expect(planAllowsPage(plan, i.href), `${i.key}`).toBe(true);
          expect(planMeets(plan, pageNeed(i.href)), `${i.key}`).toBe(true);
        }
      });

      it("every locked item's suggested plan really unlocks it, and keeps everything", () => {
        for (const i of r.locked) {
          expect(planMeets(i.upgradeTo, pageNeed(i.href)), `${i.key} → ${i.upgradeTo}`).toBe(true);
          expect(upgradeTarget(plan, pageNeed(i.href)), i.key).toBe(i.upgradeTo);
        }
      });

      it("never sells a coming-soon tool as a reason to upgrade", () => {
        expect(r.locked.every((i) => i.status === "available")).toBe(true);
      });

      it("every href is a real route", () => {
        for (const href of [...r.included, ...r.locked].map((i) => i.href).concat(r.account.map((a) => a.href))) {
          expect(routeExists(href), href).toBe(true);
        }
      });

      it("a meter only for a limit the plan has (never a 0)", () => {
        for (const l of r.limits) {
          expect(l.limit, l.key).not.toBe(0);
          expect(r.included.some((i) => i.key === l.itemKey), l.key).toBe(true);
        }
      });
    });
  }

  it("item counts per plan (snapshot)", () => {
    const counts = Object.fromEntries(
      PLANS.map((p) => {
        const r = resources(p);
        return [p, { included: r.included.length, locked: r.locked.length, limits: r.limits.length, account: r.account.length, help: r.help.length, more: r.showMore }];
      }),
    );
    expect(counts).toMatchInlineSnapshot(`
      {
        "AGENCY": {
          "account": 7,
          "help": 11,
          "included": 53,
          "limits": 10,
          "locked": 0,
          "more": false,
        },
        "AI_VISIBILITY": {
          "account": 4,
          "help": 3,
          "included": 14,
          "limits": 3,
          "locked": 33,
          "more": true,
        },
        "ENTERPRISE": {
          "account": 7,
          "help": 11,
          "included": 53,
          "limits": 10,
          "locked": 0,
          "more": false,
        },
        "GROWTH": {
          "account": 5,
          "help": 11,
          "included": 48,
          "limits": 9,
          "locked": 5,
          "more": true,
        },
        "NOSY_BAT": {
          "account": 3,
          "help": 5,
          "included": 4,
          "limits": 1,
          "locked": 43,
          "more": true,
        },
        "STARTER": {
          "account": 5,
          "help": 11,
          "included": 46,
          "limits": 9,
          "locked": 7,
          "more": true,
        },
      }
    `);
  });
});

describe("confined plans", () => {
  it("NOSY_BAT: only crawler, account and help items; no feedback or review meter; no invite", () => {
    const r = resources("NOSY_BAT");
    expect(new Set(r.included.map((i) => i.group))).toEqual(new Set(["crawler", "team_account"]));
    expect(r.included.map((i) => i.href).sort()).toEqual(["/billing", "/crawler", "/help", "/settings"]);
    expect(r.limits.map((l) => l.key)).toEqual(["crawl_pages"]);
    expect(r.account.map((a) => a.key)).not.toContain("invite");
    expect(r.account.find((a) => a.key === "gsc")?.href).toBe("/settings");
  });

  it("AI_VISIBILITY: AI visibility, its one SEO tool, team and account", () => {
    const r = resources("AI_VISIBILITY");
    expect(new Set(r.included.map((i) => i.group))).toEqual(new Set(["ai_visibility", "seo_tools", "team_account"]));
    expect(r.included.filter((i) => i.group === "seo_tools").map((i) => i.href)).toEqual(["/visibility/tools/link-authority"]);
    expect(r.limits.map((l) => l.key)).not.toContain("feedback_requests");
    expect(r.locked.find((i) => i.href === "/crawler")?.upgradeTo).toBe("STARTER");
  });

  it("Agency and Enterprise get no 'More with another plan'", () => {
    expect(resources("AGENCY").showMore).toBe(false);
    expect(resources("ENTERPRISE").showMore).toBe(false);
  });

  it("Enterprise shows Custom where the config has no figure", () => {
    expect(resources("ENTERPRISE").limits.find((l) => l.key === "seo_searches")?.limit).toBe("custom");
    expect(resources("STARTER").limits.find((l) => l.key === "seo_searches")?.limit).toBe(PLAN_CONFIGS.STARTER.seoSearchesPerMonth);
  });
});

describe("rollouts hide, never lock", () => {
  it("a tenant outside every rollout sees neither KOF, AI Search Intelligence nor the assistant, open or locked", () => {
    for (const plan of PLANS) {
      const r = resources(plan, OFF);
      const hrefs = [...r.included, ...r.locked].map((i) => i.href);
      for (const h of ["/visibility/tools/keyword-opportunities", "/visibility/ai-search", "/assistant"]) expect(hrefs, `${plan} ${h}`).not.toContain(h);
    }
  });
});

describe("help resources", () => {
  it("every relevance slug exists, and the course and guide hubs are registered routes", () => {
    for (const r of RESOURCE_RELEVANCE) {
      if (r.kind === "learn") expect(guideBySlug(r.slug!), r.slug).toBeTruthy();
    }
    expect(LOCALIZED_ROUTES.map((x) => x.path)).toEqual(expect.arrayContaining([AEO_BASE, PROMPT_GUIDES_BASE]));
  });

  it("matches the plan: crawler guides for the crawler, the course for AI visibility, review guides for reputation", () => {
    const slugs = (p: PlanType) => resources(p).help.map((h) => h.slug ?? h.kind);
    expect(slugs("NOSY_BAT")).toContain("what-nosy-bat-checks");
    expect(slugs("NOSY_BAT")).not.toContain("aeo");
    expect(slugs("AI_VISIBILITY")).toEqual(["aeo", "how-to-get-cited-by-chatgpt", "prompt-guides"]);
    expect(slugs("STARTER")).toEqual(expect.arrayContaining(["csv-review-import", "install-browser-extension", "review-request-templates"]));
  });
});

// ── The hub's plan & billing card ───────────────────────────────────────────

function render(over: Partial<PlanHubProps> & { plan?: PlanType } = {}) {
  const plan = over.plan ?? "STARTER";
  const props: PlanHubProps = {
    locale: "en",
    t: PLAN_HUB_COPY.en,
    plan,
    resources: resources(plan) as PlanResources,
    usage: {},
    billing: { state: "renewing", periodEnd: "2026-12-14T00:00:00.000Z", charge: { cents: 7800, interval: "month" }, hasPortal: true, hasSubscription: true },
    canManage: true,
    canCancel: true,
    ownerName: null,
    welcome: false,
    steps: [],
    enterpriseEmail: null,
    ...over,
  };
  return renderToStaticMarkup(createElement(PlanHub, props));
}

describe("plan & billing card", () => {
  it("trialing: first charge date, the timeline with the 24 h reminder, Cancel", () => {
    const html = render({ billing: { state: "trial", periodEnd: "2026-11-21T00:00:00.000Z", charge: { cents: 7800, interval: "month" }, hasPortal: true, hasSubscription: true } });
    expect(html).toContain("Trial, first charge on November 21, 2026");
    expect(html).toContain("Reminder email on November 20, 2026");
    expect(html).toContain('data-testid="plan-timeline"');
    // Our own confirm dialog, not a link away (and never the Stripe portal).
    expect(html).toContain('data-testid="plan-cancel"');
    expect(html).not.toContain('href="/billing/cancel"');
  });

  it("active: renews on, Cancel, no timeline", () => {
    const html = render();
    expect(html).toContain("Renews on December 14, 2026");
    expect(html).toContain('data-testid="plan-cancel"');
    expect(html).not.toContain('data-testid="plan-timeline"');
  });

  it("cancel_at_period_end: access until, Resume, no Cancel", () => {
    const html = render({ billing: { state: "cancelling", periodEnd: "2026-12-14T00:00:00.000Z", charge: null, hasPortal: true, hasSubscription: true } });
    expect(html).toContain("Cancelled, access until December 14, 2026");
    expect(html).toContain('data-testid="plan-resume"');
    expect(html).not.toContain('data-testid="plan-cancel"');
  });

  it("past_due: the payment-issue line", () => {
    expect(render({ billing: { state: "past_due", periodEnd: null, charge: null, hasPortal: true, hasSubscription: true } })).toContain("Payment issue, update your card");
  });

  it("a grandfathered price: the subscription's own amount, not the config's", () => {
    const html = render({ billing: { state: "renewing", periodEnd: "2026-12-14T00:00:00.000Z", charge: { cents: 7900, interval: "month" }, hasPortal: true, hasSubscription: true } });
    expect(html).toContain("$79 / month");
    expect(html).not.toContain(`$${PLAN_CONFIGS.STARTER.monthlyPrice} / month`);
  });

  it("no amount known: the date alone", () => {
    const html = render({ billing: { state: "renewing", periodEnd: "2026-12-14T00:00:00.000Z", charge: null, hasPortal: true, hasSubscription: true } });
    expect(html).not.toContain('data-testid="plan-amount"');
    expect(html).toContain("Renews on December 14, 2026");
  });

  it("no stripeCustomerId: the portal button is hidden", () => {
    expect(render({ billing: { state: "renewing", periodEnd: null, charge: null, hasPortal: false, hasSubscription: true } })).not.toContain('data-testid="plan-portal"');
    expect(render()).toContain('data-testid="plan-portal"');
  });

  it("a MEMBER sees who can cancel, not buttons that act", () => {
    const html = render({ canManage: false, canCancel: false, ownerName: "Ada Owner" });
    expect(html).toContain("Only Ada Owner can cancel or resume this subscription.");
    expect(html).not.toContain('data-testid="plan-cancel"');
    expect(html).not.toContain('data-testid="plan-portal"');
  });

  it("an ADMIN keeps the portal but not Cancel or Resume: those are the OWNER's", () => {
    const renewing = render({ canManage: true, canCancel: false, ownerName: "Ada Owner" });
    expect(renewing).toContain('data-testid="plan-portal"');
    expect(renewing).not.toContain('data-testid="plan-cancel"');
    expect(renewing).toContain("Only Ada Owner can cancel or resume this subscription.");
    const cancelling = render({
      canManage: true,
      canCancel: false,
      billing: { state: "cancelling", periodEnd: "2026-12-14T00:00:00.000Z", charge: null, hasPortal: true, hasSubscription: true },
    });
    expect(cancelling).not.toContain('data-testid="plan-resume"');
  });

  it("no Stripe subscription (a manual plan): no Cancel, no Resume, no owner line", () => {
    for (const state of ["renewing", "trial", "cancelling"] as const) {
      const html = render({ billing: { state, periodEnd: "2026-12-14T00:00:00.000Z", charge: null, hasPortal: false, hasSubscription: false } });
      expect(html, state).not.toContain('data-testid="plan-cancel"');
      expect(html, state).not.toContain('data-testid="plan-resume"');
      expect(html, state).not.toContain('data-testid="plan-owner-only"');
    }
  });

  it("shows the cancel article's short-form answer, and claims no emailed receipt", () => {
    const html = render();
    expect(html).toContain('data-testid="plan-cancel-anytime"');
    expect(html).not.toMatch(/receipt/i);
    // Its markdown link is a link, locale-prefixed, never raw brackets.
    expect(html).toContain('href="/en/help/cancel-subscription"');
    expect(html).not.toMatch(/\]\(\/help\//);
  });

  it("meters read 'Label: value', so no number has to agree with a noun", () => {
    const html = render({ usage: { seo_searches: { used: 61 } } });
    expect(html).toContain("Searches this month: 61 / 250");
    expect(html).toContain("Brands tracked: 1");
    expect(html).not.toMatch(/\b1 brands\b/);
  });
});

describe("the hub's lists", () => {
  it("never gives a coming-soon tool an Open button", () => {
    for (const plan of PLANS) {
      const html = render({ plan });
      for (const i of resources(plan).included.filter((x) => x.status !== "available")) {
        expect(html, `${plan} ${i.key}`).not.toContain(`data-open="${i.key}"`);
      }
    }
  });

  it("names the computed plan on locked items, and hides the section on Agency", () => {
    const html = render({ plan: "AI_VISIBILITY" });
    expect(html).toContain('data-testid="plan-more"');
    expect(html).toContain('data-locked="seo:audit_funnels" data-upgrade-to="AGENCY"');
    expect(render({ plan: "AGENCY" })).not.toContain('data-testid="plan-more"');
  });

  it("the welcome banner only when asked for", () => {
    expect(render({ welcome: true })).toContain("Welcome to Starter. Your plan is active.");
    expect(render()).not.toContain('data-testid="plan-welcome"');
  });

  it("renders in fr and de-CH without a German ß", () => {
    const de = render({ locale: "de-CH", t: PLAN_HUB_COPY["de-CH"] });
    expect(de).toContain("Ihr Abo");
    expect(de.replace(/<[^>]+>/g, "")).not.toContain("ß");
    expect(render({ locale: "fr", t: PLAN_HUB_COPY.fr })).toContain("Votre forfait");
  });
});

describe("subscriptionCharge (the actual Stripe price, cached)", () => {
  beforeEach(() => {
    clearChargeCache();
    m.chargeForPrice.mockReset();
  });

  it("reads the subscription's own price and caches it for five minutes", async () => {
    m.chargeForPrice.mockResolvedValue({ kind: "charge", charge: { cents: 7900, interval: "month" } });
    expect(await subscriptionCharge("price_old", 0)).toEqual({ cents: 7900, interval: "month" });
    await subscriptionCharge("price_old", 60_000);
    expect(m.chargeForPrice).toHaveBeenCalledTimes(1);
    await subscriptionCharge("price_old", 6 * 60_000);
    expect(m.chargeForPrice).toHaveBeenCalledTimes(2);
  });

  it("is null when Stripe cannot say, or there is no price", async () => {
    m.chargeForPrice.mockResolvedValue({ kind: "unknown" });
    expect(await subscriptionCharge("price_x")).toBeNull();
    expect(await subscriptionCharge(null)).toBeNull();
  });
});
