// @vitest-environment jsdom
//
// tests/ai-visibility-brand.test.tsx — the Echorank AI Visibility sub-brand
// (src/lib/ai-visibility/brand.ts, public/ai-visibility/):
//   - the files: the 2026-11 artwork (light / on-dark logo at 1580:371 ≈4.26:1,
//     the mark), copied as-is (the light one differs from on-dark only in its
//     wordmark fill), the email PNG and the two OG cards at 1200x630;
//   - every placement renders, in en / fr / de-CH: homepage /01 card A, /09 and
//     /13, /ai-visibility, /ai-visibility-check (and its result page),
//     /free-audit, the in-app top bar / sidebar / tab icon, /learn and a
//     chapter, the AI-led solution pages; the two emails;
//   - the global Echorank logo is exactly where it was (sidebar header, top-nav
//     wordmark, footer, the landing page's own header), and the sub-brand is
//     kept off pricing, legal, reputation tools, Nosy Bat and the global chrome;
//   - no page shows the AI Visibility logo twice.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/visibility" }));
const m = vi.hoisted(() => ({
  run: null as unknown,
  sendMail: vi.fn<(o: { html: string }) => Promise<boolean>>(async () => true),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: vi.fn(),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/snapshot/store", () => ({ getByShareToken: async () => m.run }));
vi.mock("@/lib/mailer", () => ({ sendMail: m.sendMail }));
vi.mock("@/lib/notifications/adapters", () => ({ notifyPromptTransitions: vi.fn(async () => {}), notifyVisibilityAlert: vi.fn(async () => {}) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    alertEvent: { createMany: vi.fn(async () => ({ count: 2 })) },
    tenantRiskConfig: { findUnique: vi.fn(async () => null) },
    tenantMember: { findMany: vi.fn(async () => [{ role: "OWNER", user: { email: "owner@example.com" } }]) },
  },
}));

import { AV_BRAND, AV_EMAIL_BAND, AV_ICONS, avBrandedPath, avLogoWidthAt } from "@/lib/ai-visibility/brand";
import { TwoCrawlers } from "@/app/[locale]/TwoCrawlers";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { PublicNav } from "@/app/[locale]/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { SOLUTION_CATEGORIES, leadsWithAiVisibility } from "@/lib/solutions-taxonomy";
import { LEARN_CHAPTERS, LEARN_COURSE_NAME } from "@/lib/learn-content";
import { reportEmail } from "@/lib/snapshot/deliver";
import { recordPromptAlerts } from "@/lib/visibility-alerts";

const ROOT = join(__dirname, "..");
const DIR = join(ROOT, "public/ai-visibility");
const LOCALES = ["en", "fr", "de-CH"] as const;
const P = (locale: string, extra: Record<string, string> = {}) => ({ params: Promise.resolve({ locale, ...extra }) });

function pngSize(file: string): [number, number] {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString("latin1")).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
function viewBox(publicPath: string): number[] {
  const xml = readFileSync(join(ROOT, "public", publicPath), "utf8");
  return /viewBox="([^"]+)"/.exec(xml)![1]!.trim().split(/\s+/).map(Number);
}
/** The <img> tags of the AI Visibility logo that carry a name (decorative day-theme copies excluded). */
const namedLogos = (html: string) => [...html.matchAll(/<img[^>]*src="\/ai-visibility\/echorank-ai-visibility(?:-on-dark)?\.svg"[^>]*>/g)].map((x) => x[0]).filter((t) => !/alt=""/.test(t));
const doc = (html: string) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
};
/** The logo inside a container: the named <img>, at `height` with the 1580:371 width, on-dark first (themed). */
function checkLogo(container: Element | null, height: number, surface: "themed" | "dark" | "light" = "themed") {
  expect(container).not.toBeNull();
  const imgs = [...container!.querySelectorAll("img")];
  const main = imgs[0]!;
  expect(main.getAttribute("src")).toBe(surface === "light" ? AV_BRAND.logoOnLight : AV_BRAND.logoOnDark);
  expect(main.getAttribute("alt")).toBe(AV_BRAND.name);
  expect([main.getAttribute("width"), main.getAttribute("height")]).toEqual([String(avLogoWidthAt(height)), String(height)]);
  if (surface === "themed") {
    expect(imgs[1]!.getAttribute("src")).toBe(AV_BRAND.logoOnLight);
    expect([imgs[1]!.getAttribute("alt"), imgs[1]!.getAttribute("aria-hidden")]).toEqual(["", "true"]);
  }
}

describe("the files", () => {
  it("the logo SVGs are the supplied 1580:371 artwork; the mark is near-square", () => {
    expect([AV_BRAND.logoOnLight, AV_BRAND.logoOnDark, AV_BRAND.mark]).toEqual([
      "/ai-visibility/echorank-ai-visibility.svg",
      "/ai-visibility/echorank-ai-visibility-on-dark.svg",
      "/ai-visibility/echorank-ai-visibility-mark.svg",
    ]);
    for (const f of [AV_BRAND.logoOnDark, AV_BRAND.logoOnLight]) {
      const [, , w, h] = viewBox(f);
      expect([w, h]).toEqual([AV_BRAND.width, AV_BRAND.height]);
      expect(w! / h!).toBeCloseTo(4.26, 2);
    }
    const [, , mw, mh] = viewBox(AV_BRAND.mark);
    expect(Math.abs(mw! / mh! - 1)).toBeLessThan(0.02);
    // The light file is the on-dark artwork with only the wordmark's fill changed.
    const svg = (f: string) => readFileSync(join(ROOT, "public", f), "utf8");
    expect(svg(AV_BRAND.logoOnLight).replace('fill="#181A20"', 'fill="#FFFFFF"')).toBe(svg(AV_BRAND.logoOnDark));
    // Copied as-is from the supplied set when it is on this box.
    const SRC = "/opt/echorank/prompts/logo";
    if (existsSync(SRC)) {
      expect(svg(AV_BRAND.logoOnDark)).toBe(readFileSync(join(SRC, "echorank-ai-visibility-on-dark.svg"), "utf8"));
      expect(svg(AV_BRAND.mark)).toBe(readFileSync(join(SRC, "echorank-ai-visibility-mark.svg"), "utf8"));
    }
  });

  it("the PNGs are present at their sizes", () => {
    const [ew, eh] = pngSize(join(DIR, "echorank-ai-visibility-on-dark-800.png"));
    expect(ew).toBe(800);
    expect(Math.abs(eh - (800 * 371) / 1580)).toBeLessThanOrEqual(1);
    for (const s of [32, 64, 128, 512]) expect(pngSize(join(DIR, `echorank-ai-visibility-emblem-${s}.png`))).toEqual([s, s]);
    for (const og of ["og-ai-visibility.png", "og-ai-visibility-check.png"]) expect(pngSize(join(DIR, og))).toEqual([1200, 630]);
    expect(AV_BRAND.logoEmail).toMatch(/^https:\/\/.+\/ai-visibility\/echorank-ai-visibility-on-dark-800\.png$/);
    expect(AV_BRAND.logoPdf).toMatch(/^https:\/\/.+\/ai-visibility\/echorank-ai-visibility\.svg$/);
    for (const f of readdirSync(DIR)) expect(statSync(join(DIR, f)).mode & 0o044, f).toBe(0o044);
    for (const v of Object.values(AV_BRAND)) if (typeof v === "string" && v.startsWith("/ai-visibility/")) expect(existsSync(join(ROOT, "public", v)), v).toBe(true);
  });
});

describe("the global Echorank logo is exactly where it was", () => {
  it("the sidebar header, the top-nav wordmark, the footer", () => {
    nav.pathname = "/visibility";
    const side = doc(renderToStaticMarkup(createElement(Sidebar, { locale: "en", paid: true, assistantVisible: false })));
    const brandImg = side.querySelector("aside img")!;
    expect([brandImg.getAttribute("src"), brandImg.getAttribute("alt")]).toEqual(["/echorank-logo-light.svg", "Echorank360"]);
    expect([...side.querySelectorAll("img")].map((i) => i.getAttribute("src"))).toEqual(["/echorank-logo-light.svg"]);
    for (const l of LOCALES) {
      const navHtml = renderToStaticMarkup(createElement(PublicNav, { locale: l }));
      // The wordmark plus its ™ (decorative: the accessible text stays "ECHORANK").
      const brand = doc(navHtml).querySelector("a")!;
      expect(brand.textContent).toBe("ECHORANK™");
      brand.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      expect(brand.textContent).toBe("ECHORANK");
      expect(navHtml).not.toContain("/ai-visibility/echorank-ai-visibility");
      const foot = renderToStaticMarkup(createElement(PublicFooter, { locale: l }));
      expect(foot).toContain("ECHORANK");
      expect(foot).not.toContain("/ai-visibility/echorank-ai-visibility");
    }
  });

  it("the /ai-visibility page uses the shared PublicNav wordmark and footer (2026-11-10)", async () => {
    const Page = (await import("@/app/[locale]/ai-visibility/page")).default;
    const html = renderToStaticMarkup(await Page(P("en") as never));
    const nav = renderToStaticMarkup(createElement(PublicNav, { locale: "en" }));
    expect(html).toContain(nav);
    expect(html).toContain(renderToStaticMarkup(createElement(PublicFooter, { locale: "en" })));
    expect(html).not.toContain('src="/echorank-logo-light.svg"');
  });

  it("is not on pricing, legal, reputation tools, Nosy Bat or the global chrome (by source)", () => {
    const walk = (d: string, out: string[] = []): string[] => {
      if (!existsSync(d)) return out;
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(ts|tsx)$/.test(n) && !n.includes(".bak")) out.push(p);
      }
      return out;
    };
    const kept = [
      ...walk(join(ROOT, "src/app/[locale]/pricing")),
      ...walk(join(ROOT, "src/app/[locale]/legal")),
      ...walk(join(ROOT, "src/app/[locale]/reputation-tools")),
      ...walk(join(ROOT, "src/app/(dashboard)/reputation")),
      ...walk(join(ROOT, "src/app/[locale]/site-crawler")),
      ...walk(join(ROOT, "src/app/(dashboard)/crawler")),
      ...walk(join(ROOT, "src/app/[locale]/learn/guides")),
      join(ROOT, "src/app/[locale]/PricingSection.tsx"),
      join(ROOT, "src/app/[locale]/PublicNav.tsx"),
      join(ROOT, "src/components/PublicFooter.tsx"),
    ].filter((f) => existsSync(f));
    expect(kept.length).toBeGreaterThan(10);
    const offenders = kept.filter((f) => /ai-visibility\/brand|AiVisibilityLogo|\/ai-visibility\/echorank-ai-visibility/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe.each(LOCALES)("%s", (l) => {
  it("homepage /01: card A's header is the logo at the Nosy Bat lockup's 36 px, top-left", () => {
    const el = doc(renderToStaticMarkup(TwoCrawlers({ locale: l, sectionNumber: "01" })));
    const cards = el.querySelectorAll("article");
    const head = cards[0]!.firstElementChild!;
    checkLogo(head.querySelector('[data-testid="two-crawlers-av-logo"]'), 36);
    // Same height as card B's Nosy Bat logo.
    expect(cards[1]!.querySelector("img")!.getAttribute("height")).toBe("36");
    expect(head.textContent).toBe("");
  });

  it("homepage: /09 and /13 carry the gold emblem (40 px) as their section icon; the page shows the logo once", async () => {
    const Home = (await import("@/app/[locale]/page")).default;
    const html = renderToStaticMarkup(await Home(P(l) as never));
    const el = doc(html);
    for (const id of ["home-09-av", "home-13-av"]) {
      const em = el.querySelector(`[data-testid="${id}"] img`)!;
      expect([em.getAttribute("src"), em.getAttribute("width"), em.getAttribute("height"), em.getAttribute("alt")]).toEqual([AV_BRAND.mark, "40", "40", ""]);
    }
    expect(el.querySelector('[data-testid="home-09-av"] p')!.textContent).toContain("/ 09");
    expect(el.querySelector('[data-testid="home-13-av"] p')!.textContent).toContain("/ 13");
    expect(namedLogos(html)).toHaveLength(1);
  });

  it("/ai-visibility: the logo (72 px) above the H1, no text eyebrow naming the product", async () => {
    const Page = (await import("@/app/[locale]/ai-visibility/page")).default;
    const html = renderToStaticMarkup(await Page(P(l) as never));
    const el = doc(html);
    const logo = el.querySelector('[data-testid="av-hero-logo"]');
    checkLogo(logo, 72);
    expect(logo!.compareDocumentPosition(el.querySelector("h1")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // No text eyebrow naming the product between the logo and the H1.
    expect(logo!.nextElementSibling!.tagName).toBe("H1");
    expect(namedLogos(html)).toHaveLength(1);
  });

  it("/ai-visibility-check: hero logo 56 px; the result page header 40 px", async () => {
    const Check = (await import("@/app/[locale]/ai-visibility-check/page")).default;
    const html = renderToStaticMarkup(await Check(P(l) as never));
    const el = doc(html);
    checkLogo(el.querySelector('[data-testid="av-check-logo"]'), 56);
    expect(el.querySelector('[data-testid="av-check-logo"]')!.compareDocumentPosition(el.querySelector("h1")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(namedLogos(html)).toHaveLength(1);
    const Result = (await import("@/app/[locale]/ai-visibility-check/r/[token]/page")).default;
    for (const run of [null, { id: "s1", shareExpiresAt: new Date("2026-12-01"), report: { ...REPORT, sources: [{ domain: "checkatrade.com", timesCited: 4, competitors: [], userCited: false }], actions: [] } }]) {
      m.run = run;
      const r = renderToStaticMarkup(await Result(P(l, { token: "tok" }) as never));
      checkLogo(doc(r).querySelector('[data-testid="av-result-logo"]'), 40);
      expect(namedLogos(r)).toHaveLength(1);
    }
  });

  it("/free-audit: the logo (48 px) directly above the widget", async () => {
    const FreeAudit = (await import("@/app/[locale]/free-audit/page")).default;
    const html = renderToStaticMarkup(await FreeAudit(P(l) as never));
    const el = doc(html);
    const logo = el.querySelector('[data-testid="av-free-audit-logo"]')!;
    checkLogo(logo, 48);
    expect(logo.parentElement!.nextElementSibling).not.toBeNull();
    expect(namedLogos(html)).toHaveLength(1);
  });

  it("in-app: the top bar on /visibility shows the emblem (28 px, currentColor) and the existing title; the sidebar AI row's icon is the emblem", async () => {
    const dash = l === "de-CH" ? "de-CH" : l;
    nav.pathname = "/visibility";
    const el = document.createElement("div");
    const root = createRoot(el);
    await act(async () => root.render(createElement(Header, { title: "AI Visibility", locale: dash })));
    const h1 = el.querySelector("header h1")!;
    const icon = h1.querySelector("[data-av-emblem-current]")!;
    expect(icon.getAttribute("class")).toBe("h-7 w-7 shrink-0");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(h1.textContent).toBe("AI Visibility");
    act(() => root.unmount());
    // Not on the SEO Tools pages that live under /visibility/tools.
    nav.pathname = "/visibility/tools/site-audit";
    const tools = doc(renderToStaticMarkup(createElement(Header, { title: "Site Audit", locale: dash })));
    expect(tools.querySelector("[data-av-emblem-current]")).toBeNull();

    for (const [path, active] of [["/dashboard", false], ["/visibility", true]] as const) {
      nav.pathname = path;
      const side = doc(renderToStaticMarkup(createElement(Sidebar, { locale: dash, paid: true, assistantVisible: false })));
      const row = side.querySelector('a[href="/ai"]')!;
      const em = row.querySelector("[data-av-emblem-current]")!;
      expect(em.getAttribute("class")).toBe("h-5 w-5 shrink-0");
      expect(em.getAttribute("style") ?? "").toContain(`url("${AV_BRAND.mark}")`);
      expect(em.getAttribute("style") ?? "").toContain("background-color:currentColor");
      expect(row.querySelector("svg, img")).toBeNull();
      expect(row.getAttribute("class") ?? "").toContain(active ? "text-white" : "text-gray-400");
    }
  });

  it("/learn: the gold emblem (24 px) beside the course title; a chapter header carries it beside the course name", async () => {
    const Learn = (await import("@/app/[locale]/learn/page")).default;
    const el = doc(renderToStaticMarkup(await Learn(P(l) as never)));
    const title = el.querySelector('[data-testid="learn-course-title"]')!;
    const em = title.querySelector("img")!;
    expect([em.getAttribute("src"), em.getAttribute("width"), em.getAttribute("height")]).toEqual([AV_BRAND.mark, "24", "24"]);
    const base = l === "fr" ? "fr" : "en";
    expect(title.textContent).toBe(LEARN_COURSE_NAME[base]);
    const Chapter = (await import("@/app/[locale]/learn/[chapter]/page")).default;
    const ch = doc(renderToStaticMarkup(await Chapter(P(l, { chapter: LEARN_CHAPTERS[0]!.slug }) as never)));
    const line = ch.querySelector('[data-testid="learn-chapter-course"]')!;
    expect(line.querySelector("img")!.getAttribute("src")).toBe(AV_BRAND.mark);
    expect(line.querySelector("img")!.getAttribute("width")).toBe("24");
    expect(line.textContent).toBe(LEARN_COURSE_NAME[base]);
  });

  it("solutions: the AI-led pages carry the gold emblem (32 px) in the hero eyebrow row; the others do not", async () => {
    const Sol = (await import("@/app/[locale]/solutions/[category]/[slug]/page")).default;
    const items = SOLUTION_CATEGORIES.flatMap((c) => c.items);
    const led = items.filter(leadsWithAiVisibility);
    expect(led.map((i) => i.slug)).toEqual(expect.arrayContaining(["get-cited-by-ai", "understand-your-market", "saas-b2b"]));
    expect(led).toHaveLength(13); // + dentists (2026-11-09), led like professional-services
    const render = async (i: (typeof items)[number]) => doc(renderToStaticMarkup(await Sol(P(l, { category: i.category, slug: i.slug }) as never)));
    const yes = await render(items.find((i) => i.slug === "get-cited-by-ai")!);
    const em = yes.querySelector('[data-testid="solution-av-emblem"] img')!;
    expect([em.getAttribute("src"), em.getAttribute("width"), em.getAttribute("height")]).toEqual([AV_BRAND.mark, "32", "32"]);
    expect(yes.querySelector('[data-testid="solution-av-emblem"]')!.compareDocumentPosition(yes.querySelector("h1")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const no = await render(items.find((i) => i.slug === "healthcare")!);
    expect(no.querySelector('[data-testid="solution-av-emblem"]')).toBeNull();
  });
});

const REPORT = {
  brand: "Acme Plumbing",
  domain: "acmeplumbing.co.uk",
  category: "emergency plumber",
  location: "Leeds",
  engines: [{ engine: "openai", model: "m", asked: 10, answered: 10, mentioned: 0, cited: 0, mentionRate: 0, citationRate: 0 }],
  competitors: [{ name: "Pipeworks Ltd", count: 6, byEngine: { openai: 6 } }],
  prompts: [{ index: 0, kind: "best", text: "q", results: {} }],
  sources: [{ domain: "checkatrade.com", timesCited: 4, competitors: [], userCited: false }],
  actions: [],
  capped: false,
  generatedAt: "2026-11-02T05:00:00Z",
};

describe("in-app tab icon and scope", () => {
  it("/visibility and /visibility/ai-search set the 32 px emblem as the tab icon; the SEO Tools pages are not the product", async () => {
    expect(JSON.stringify(AV_ICONS)).toContain(AV_BRAND.favicon);
    expect(AV_BRAND.favicon).toBe("/ai-visibility/echorank-ai-visibility-emblem-32.png");
    for (const f of ["src/app/(dashboard)/visibility/page.tsx", "src/app/(dashboard)/visibility/ai-search/page.tsx"]) {
      expect(readFileSync(join(ROOT, f), "utf8")).toContain("export const metadata: Metadata = { icons: AV_ICONS };");
    }
    expect([avBrandedPath("/visibility"), avBrandedPath("/visibility/ai-search")]).toEqual([true, true]);
    expect([avBrandedPath("/visibility/tools"), avBrandedPath("/visibility/tools/site-audit"), avBrandedPath("/visibility/keywords"), avBrandedPath("/ai"), avBrandedPath("/crawler")]).toEqual([false, false, false, false, false]);
  });
});

describe("emails: the on-dark logo, 60 px high (as before), on a dark strip", () => {
  const header = (html: string) => {
    expect(html).toContain(`background:${AV_EMAIL_BAND}`);
    expect(html).toMatch(new RegExp(`<img src="${AV_BRAND.logoEmail.replace(/[.?]/g, "\\$&")}" width="256" height="60" alt="${AV_BRAND.name}"`));
  };

  it("the AI Visibility Check report email (en, fr)", () => {
    for (const l of ["en", "fr", "de-CH"]) {
      const { html } = reportEmail(REPORT as never, l, "https://echorank360.com/r/x");
      header(html);
      expect(html.indexOf("<img")).toBeLessThan(html.indexOf("Acme Plumbing"));
    }
  });

  it("the prompt-alert digest", async () => {
    m.sendMail.mockClear();
    await recordPromptAlerts("t1", [
      { promptId: "p1", promptText: "best plumber in Leeds", kind: "visibility_lost", prevRank: 2, newRank: null },
      { promptId: "p2", promptText: "emergency plumber", kind: "visibility_regained", prevRank: null, newRank: 3 },
    ] as never);
    expect(m.sendMail).toHaveBeenCalledTimes(1);
    const html = m.sendMail.mock.calls[0]![0].html;
    header(html);
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("<pre"));
  });
});

beforeEach(() => {
  nav.pathname = "/visibility";
  m.run = null;
});
