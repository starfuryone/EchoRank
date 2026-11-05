// @vitest-environment jsdom
//
// tests/onboarding-crawl-step.test.tsx — the crawler step on the dashboard's
// "Your first steps" card (src/lib/onboarding.ts, crawl_site;
// src/components/onboarding/onboarding-checklist.tsx):
//   - order: right after the AI Visibility audit, every other step kept in place;
//   - done = at least one COMPLETED crawl_jobs row, showing its pages and health
//     with a link to those results; a running crawl shows "Crawling…" with a
//     live count, and the card flips to done when it completes;
//   - the button: "Start a crawl" → /crawler?url=<domain> on a plan that can
//     crawl (paid, or a real trial), "See plans" → /pricing otherwise;
//   - en / fr / de-CH, the crawler's name untranslated, the rule count from
//     the registry;
//   - on /dashboard the crawler's name is the accessible name of the sidebar
//     row only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));
const db = vi.hoisted(() => ({
  paid: true,
  completed: null as null | { id: string; pagesCrawled: number; summary: unknown },
  running: null as null | { id: string; pagesCrawled: number; urlCap: number },
  auditDomain: "acme.com" as string | null,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/paid-plan", () => ({ hasPaidPlan: vi.fn(async () => db.paid) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(async () => ({
        id: "t1",
        createdAt: new Date(),
        planType: "STARTER",
        onboardingIntent: "business",
        auditDomain: db.auditDomain,
        welcomeSeenAt: new Date(),
        onboardingDismissedAt: null,
        onboarding: {},
        marketingConsent: true,
        defaultLanguage: "en",
        name: "Acme",
        billingStatus: "ACTIVE",
      })),
    },
    visibilityAudit: { count: vi.fn(async () => 1) },
    reviewLink: { count: vi.fn(async () => 0) },
    trackedPrompt: { count: vi.fn(async () => 0) },
    monitoringSource: { count: vi.fn(async () => 0) },
    importJob: { count: vi.fn(async () => 0) },
    tenantMember: { count: vi.fn(async () => 1) },
    crawlJob: {
      findFirst: vi.fn(async ({ where }: { where: { status: unknown } }) =>
        where.status === "COMPLETED" ? db.completed : db.running,
      ),
    },
  },
}));

import { buildOnboardingSteps, crawlerStartHref, getOnboardingSnapshot, type OnboardingCrawl } from "@/lib/onboarding";
import { CRAWL_STEP_POLL_MS, OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { DashboardPageClient } from "@/app/(dashboard)/dashboard/page-client";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { ruleCountLabel } from "@/lib/site-crawler/rule-count";
import { ONBOARDING_COPY, type DashLocale } from "@/lib/i18n/dashboard";

const LOCALES: DashLocale[] = ["en", "fr", "de-CH"];
const NB = CRAWLER_BRAND.name;
const TODO: OnboardingCrawl = { canCrawl: true, rules: "340+", latest: null, running: null };
const BASE = {
  plan: "STARTER" as const,
  json: {},
  counts: { audits: 0, reviewLinks: 0, prompts: 0, monitoringSources: 0, importJobs: 0, tenantMembers: 1, userMemberships: 1 },
};

beforeEach(() => {
  db.paid = true;
  db.completed = null;
  db.running = null;
  db.auditDomain = "acme.com";
});

describe("buildOnboardingSteps: the crawl_site step", () => {
  it("sits right after the AI Visibility audit; every other step keeps its place", () => {
    for (const intent of ["business", "agency", null] as const) {
      const keys = buildOnboardingSteps({ ...BASE, intent, crawl: TODO, domain: "acme.com" }).map((s) => s.key);
      expect(keys[0]).toBe("first_audit");
      expect(keys[1]).toBe("crawl_site");
      expect(keys.filter((k) => k !== "crawl_site")).toEqual([
        "first_audit",
        "download_pdf",
        "add_prompts",
        "connect_source",
        intent === "agency" ? "add_client" : "invite_teammate",
      ]);
    }
  });

  it("targets: /crawler?url=<domain> when the plan can crawl, /pricing when not, the crawl's own page once one runs or is done", () => {
    const at = (crawl: OnboardingCrawl, domain: string | null = "acme.com") =>
      buildOnboardingSteps({ ...BASE, intent: "business", crawl, domain })[1]!;
    expect(at(TODO)).toMatchObject({ href: "/crawler?url=acme.com", done: false });
    expect(at(TODO, null).href).toBe("/crawler");
    expect(at({ ...TODO, canCrawl: false })).toMatchObject({ href: "/pricing", done: false });
    expect(at({ ...TODO, running: { id: "c9", pages: 12, cap: 2500 } })).toMatchObject({ href: "/crawler/c9", done: false });
    expect(at({ ...TODO, latest: { id: "c7", pages: 1234, health: 87 } })).toMatchObject({ href: "/crawler/c7", done: true });
    // A lapsed plan with a finished crawl is still done.
    expect(at({ ...TODO, canCrawl: false, latest: { id: "c7", pages: 1, health: null } }).done).toBe(true);
    expect(crawlerStartHref("https://www.Acme.com/shop?x=1")).toBe("/crawler?url=acme.com");
  });
});

describe("getOnboardingSnapshot", () => {
  it("the step flips to done on a completed crawl, with its pages and health", async () => {
    let step = (await getOnboardingSnapshot("t1", "u1")).steps[1]!;
    expect(step).toMatchObject({ key: "crawl_site", done: false, href: "/crawler?url=acme.com" });
    expect(step.crawl).toEqual({ canCrawl: true, rules: ruleCountLabel(), latest: null, running: null });
    expect(ruleCountLabel()).toMatch(/^\d+\+?$/);

    db.running = { id: "c9", pagesCrawled: 40, urlCap: 2500 };
    step = (await getOnboardingSnapshot("t1", "u1")).steps[1]!;
    expect(step.done).toBe(false);
    expect(step.crawl!.running).toEqual({ id: "c9", pages: 40, cap: 2500 });

    db.running = null;
    db.completed = { id: "c7", pagesCrawled: 1234, summary: { health: { score: 87 } } };
    const snap = await getOnboardingSnapshot("t1", "u1");
    step = snap.steps[1]!;
    expect(step).toMatchObject({ done: true, href: "/crawler/c7" });
    expect(step.crawl!.latest).toEqual({ id: "c7", pages: 1234, health: 87 });
    expect(snap.completedCount).toBe(2);
    expect(snap.steps).toHaveLength(6);
  });

  it("a tenant whose plan cannot crawl (unpaid, or a trial with no Stripe row) still gets the step, aimed at /pricing", async () => {
    db.paid = false;
    const step = (await getOnboardingSnapshot("t1", "u1")).steps[1]!;
    expect(step).toMatchObject({ key: "crawl_site", done: false, href: "/pricing" });
    expect(step.crawl!.canCrawl).toBe(false);
  });
});

// ── the card ──────────────────────────────────────────────────────────────
type Fetcher = (url: string) => unknown;
let root: Root | null = null;
let host: HTMLElement | null = null;

function stubFetch(handler: Fetcher) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const body = handler(String(input));
      return { ok: body !== undefined, json: async () => body } as Response;
    }),
  );
}
async function onboardingBody(crawl: OnboardingCrawl, domain: string | null = "acme.com") {
  const steps = buildOnboardingSteps({ ...BASE, intent: "business", crawl, domain });
  const done = steps.filter((s) => s.done).length;
  return { steps, completedCount: done, totalCount: steps.length, allComplete: false, dismissed: false, hidden: false, intent: "business" };
}
async function mount(node: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(node));
  return host;
}
const row = () => document.querySelector('[data-testid="onboarding-step-crawl_site"]') as HTMLElement | null;

afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.each(LOCALES)("the card, %s", (l) => {
  const t = ONBOARDING_COPY[l];

  it("renders the step: the emblem at the other icons' size, the name, the one line, Start a crawl → /crawler?url=", async () => {
    const body = await onboardingBody(TODO);
    stubFetch((u) => (u === "/api/onboarding" ? body : undefined));
    await mount(createElement(OnboardingChecklist, { locale: l }));
    await vi.waitFor(() => expect(row()).not.toBeNull());
    const r = row()!;
    expect(r.dataset.state).toBe("todo");
    const emblem = r.querySelector("[data-nb-emblem]")!;
    expect(emblem.getAttribute("aria-hidden")).toBe("true");
    expect(emblem.getAttribute("class")).toContain("h-5 w-5");
    // The size of the status circles beside it.
    const circle = document.querySelector("li:not([data-testid]) svg")!;
    expect(circle.getAttribute("class")).toContain("h-5 w-5");
    expect(emblem.getAttribute("style")).toMatch(/background-color:\s*currentcolor/i);
    expect(r.textContent).toContain(t.steps.crawl_site);
    expect(t.steps.crawl_site).toContain(NB);
    expect(r.textContent).toContain(t.crawl.line("340+"));
    const cta = r.querySelector('[data-testid="crawl-step-cta"]')!;
    expect(cta.textContent).toBe({ en: "Start a crawl", fr: "Lancer une exploration", "de-CH": "Crawl starten" }[l]);
    expect(cta.getAttribute("href")).toBe("/crawler?url=acme.com");
    // Second in the list.
    expect([...document.querySelectorAll("ul > li")].indexOf(r)).toBe(1);
  });

  it("a plan that cannot crawl: See plans → /pricing", async () => {
    const body = await onboardingBody({ ...TODO, canCrawl: false });
    stubFetch((u) => (u === "/api/onboarding" ? body : undefined));
    await mount(createElement(OnboardingChecklist, { locale: l }));
    await vi.waitFor(() => expect(row()).not.toBeNull());
    const cta = row()!.querySelector('[data-testid="crawl-step-cta"]')!;
    expect(cta.textContent).toBe(t.crawl.seePlans);
    expect(cta.textContent).toBe({ en: "See plans", fr: "Voir les forfaits", "de-CH": "Pläne ansehen" }[l]);
    expect(cta.getAttribute("href")).toBe("/pricing");
  });

  it("done: Crawled N pages · health NN/100 with a link to the latest results, no button", async () => {
    const body = await onboardingBody({ ...TODO, latest: { id: "c7", pages: 1234, health: 87 } });
    stubFetch((u) => (u === "/api/onboarding" ? body : undefined));
    await mount(createElement(OnboardingChecklist, { locale: l }));
    await vi.waitFor(() => expect(row()).not.toBeNull());
    const r = row()!;
    expect(r.dataset.state).toBe("done");
    expect(r.querySelector('[data-testid="crawl-step-cta"]')).toBeNull();
    const line = r.querySelector('[data-testid="crawl-step-done"]')!;
    const n = l === "en" ? "1,234" : new Intl.NumberFormat(l).format(1234);
    expect(line.textContent).toContain(t.crawl.done(n, "87"));
    if (l === "en") expect(line.textContent).toContain("Crawled 1,234 pages · health 87/100");
    const a = line.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("/crawler/c7");
    expect(a.textContent).toBe(t.crawl.results);
    // The fixture has no audit yet: the crawl is the one step done, of six.
    expect(document.body.textContent).toContain(t.progress(1, 6));
  });
});

describe("the card, live", () => {
  it("a running crawl shows Crawling… with the live count, then flips to done when it completes", async () => {
    const t = ONBOARDING_COPY.en;
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let crawl: { status: string; pagesCrawled: number } = { status: "RUNNING", pagesCrawled: 12 };
    let onboarding = await onboardingBody({ ...TODO, running: { id: "c9", pages: 12, cap: 2500 } });
    stubFetch((u) => (u === "/api/onboarding" ? onboarding : u === "/api/seo/v1/crawl/c9" ? crawl : undefined));
    await mount(createElement(OnboardingChecklist, { locale: "en" }));
    await vi.waitFor(() => expect(row()?.dataset.state).toBe("running"));
    expect(row()!.textContent).toContain("Crawling… 12 of 2,500 pages");
    expect(row()!.querySelector('[data-testid="crawl-step-cta"]')).toBeNull();
    expect(row()!.querySelector("a")!.getAttribute("href")).toBe("/crawler/c9");

    crawl = { status: "RUNNING", pagesCrawled: 340 };
    await act(async () => vi.advanceTimersByTime(CRAWL_STEP_POLL_MS));
    await vi.waitFor(() => expect(row()!.textContent).toContain(t.crawl.crawling("340", "2,500")));

    crawl = { status: "COMPLETED", pagesCrawled: 2500 };
    onboarding = await onboardingBody({ ...TODO, latest: { id: "c9", pages: 2500, health: 91 } });
    await act(async () => vi.advanceTimersByTime(CRAWL_STEP_POLL_MS));
    await vi.waitFor(() => expect(row()?.dataset.state).toBe("done"));
    expect(row()!.textContent).toContain("Crawled 2,500 pages · health 91/100");
  });
});

// ── accessible names on /dashboard ─────────────────────────────────────────
function accessibleNames(scope: ParentNode): { el: Element; name: string }[] {
  const named = scope.querySelectorAll("a, button, [role], img, [aria-label], h1, h2, h3, h4, h5, h6, input, summary");
  return [...named]
    .filter((el) => el.getAttribute("aria-hidden") !== "true" && !el.closest('[aria-hidden="true"]'))
    .map((el) => {
      const labelledBy = el.getAttribute("aria-labelledby");
      const name =
        el.getAttribute("aria-label") ??
        (labelledBy ? labelledBy.split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ") : null) ??
        (el.tagName === "IMG" ? el.getAttribute("alt") : null) ??
        el.textContent ??
        "";
      return { el, name };
    });
}

describe.each(LOCALES)("/dashboard, %s", (l) => {
  it("the crawler's name is an accessible name in the sidebar only", async () => {
    nav.pathname = "/dashboard";
    const body = await onboardingBody(TODO);
    stubFetch((u) =>
      u === "/api/onboarding"
        ? body
        : u === "/api/analytics"
          ? { totalSent: 0, totalResponses: 0, avgRating: 0, positiveCount: 0, negativeCount: 0, recoveryOpen: 0, recentFeedback: [] }
          : u === "/api/notifications/unread-count"
            ? { count: 0 }
            : undefined,
    );
    const page = await mount(
      createElement(
        "div",
        null,
        createElement("div", { "data-zone": "sidebar", dangerouslySetInnerHTML: { __html: renderToStaticMarkup(createElement(Sidebar, { locale: l, paid: true, assistantVisible: false })) } }),
        createElement(Header, { title: "Dashboard", locale: l }),
        createElement(DashboardPageClient, { locale: l }),
      ),
    );
    await vi.waitFor(() => expect(row()).not.toBeNull());
    // The step itself is on the page, name and all…
    expect(row()!.textContent).toContain(NB);
    // …but nothing outside the sidebar is NAMED by it.
    const hits = accessibleNames(page).filter((x) => x.name.includes(NB));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.filter((x) => !x.el.closest('[data-zone="sidebar"]')).map((x) => x.name)).toEqual([]);
    expect(accessibleNames(page.querySelector('[data-zone="sidebar"]')!).filter((x) => x.el.tagName === "A" && x.name.includes(NB))).toHaveLength(1);
  });
});
