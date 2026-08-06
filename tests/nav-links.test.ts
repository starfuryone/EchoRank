// Knowledge-base entry points: the Help row in the app sidebar, and the Learn
// link in the public top nav.
//
// Both navs are config-driven (navItems + dashNav for the sidebar, the NAV
// catalog for the public one), so these assert the rendered output rather than
// the config — a label present in a catalog but filtered out of the markup is
// exactly the failure worth catching.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The sidebar reads the current route from next/navigation. Each test sets the
// path it wants before rendering.
const pathname = { current: "/dashboard" };
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

import { Sidebar } from "@/components/layout/sidebar";
import { PublicNav } from "@/app/[locale]/PublicNav";
import { dashNav } from "@/lib/i18n/dashboard";
import type { PlanType } from "@/generated/prisma";

const PLANS: PlanType[] = ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];

function sidebar(opts: { path?: string; plan?: PlanType; locale?: "en" | "fr" | "de-CH" } = {}) {
  pathname.current = opts.path ?? "/dashboard";
  return renderToStaticMarkup(
    createElement(Sidebar, {
      locale: opts.locale ?? "en",
      plan: opts.plan ?? "GROWTH",
      paid: true,
    }),
  );
}

/** The rendered <a> for a given href, so class assertions target one row. */
function anchor(html: string, href: string): string {
  const m = html.match(new RegExp(`<a[^>]*href="${href.replace("/", "\\/")}"[^>]*>`));
  return m ? m[0] : "";
}

describe("dashboard sidebar", () => {
  it("renders a Help row linking to /help", () => {
    const html = sidebar();
    expect(html).toContain('href="/help"');
    expect(html).toContain(dashNav.en["/help"]);
  });

  it("puts it last, below Billing", () => {
    const html = sidebar();
    expect(html.indexOf('href="/help"')).toBeGreaterThan(html.indexOf('href="/billing"'));
    // Nothing in the nav list follows it.
    const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
    expect(nav.lastIndexOf('href="/help"')).toBeGreaterThan(nav.lastIndexOf('href="/billing"'));
  });

  it("highlights it when the current route is /help", () => {
    // Same active treatment every other row gets: the filled background.
    const active = anchor(sidebar({ path: "/help" }), "/help");
    expect(active).toContain("bg-gray-800");
    expect(active).toContain("text-white");
  });

  it("leaves it unhighlighted elsewhere", () => {
    const inactive = anchor(sidebar({ path: "/dashboard" }), "/help");
    expect(inactive).toContain("text-gray-400");
    expect(inactive).not.toContain("bg-gray-800 text-white");
  });

  it("shows on every plan, including the confined AI_VISIBILITY tier", () => {
    // Help is never plan-gated. The sidebar hides what canAccessPath() refuses,
    // so this is the visible half of the /help allowlist entry.
    for (const plan of PLANS) {
      expect(sidebar({ plan }), plan).toContain('href="/help"');
    }
  });

  it("labels it in every dashboard locale", () => {
    for (const locale of ["en", "fr", "de-CH"] as const) {
      expect(sidebar({ locale }), locale).toContain(dashNav[locale]["/help"]);
    }
  });

  it("still hides rows a plan cannot reach, so the test above means something", () => {
    // AI_VISIBILITY is confined to /visibility, /settings, /billing, /team and
    // /help — Reputation Tools must not appear for it.
    expect(sidebar({ plan: "AI_VISIBILITY" })).not.toContain('href="/reputation"');
    expect(sidebar({ plan: "GROWTH" })).toContain('href="/reputation"');
  });
});

describe("public top nav", () => {
  const render = (locale: string) =>
    renderToStaticMarkup(createElement(PublicNav, { locale }));

  it("renders a locale-aware Learn link", () => {
    expect(render("en")).toContain('href="/en/learn"');
    expect(render("fr")).toContain('href="/fr/learn"');
  });

  it("labels it per locale base", () => {
    expect(render("en")).toContain(">Learn<");
    expect(render("fr")).toContain(">Apprendre<");
    // de-CH shows English chrome, per the house fold.
    expect(render("de-CH")).toContain(">Learn<");
  });

  it("folds regional locales onto their base label but keeps their own URL", () => {
    const caHtml = render("en-CA");
    expect(caHtml).toContain('href="/en-CA/learn"');
    expect(caHtml).toContain(">Learn<");
  });

  it("places it among the primary links, before the login and signup CTAs", () => {
    const html = render("en");
    const learn = html.indexOf('href="/en/learn"');
    // Pricing is a real page now, not a homepage anchor, and the signup CTA
    // routes through it — every marketing CTA does. Login is untouched.
    expect(learn).toBeGreaterThan(html.indexOf('href="/en/pricing"'));
    expect(learn).toBeLessThan(html.indexOf('href="/login"'));
  });

  it("marks it current on the Learn pages themselves", () => {
    const html = renderToStaticMarkup(
      createElement(PublicNav, { locale: "en", current: "learn" }),
    );
    expect(html).toMatch(/href="\/en\/learn"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/en\/learn"/);
  });

  it("needs no auth to render the link", () => {
    // The nav's only auth-aware piece is the right-hand CTA, which server-
    // renders as the logged-out "Join Now". Learn is a plain link either way.
    expect(render("en")).toContain('href="/en/learn"');
    // Signed out, the CTA is "Join Now" -> /pricing (it was /register before
    // the CTAs were rerouted). Signed in it swaps to /dashboard.
    expect(render("en")).toContain('href="/en/pricing"');
  });
});
