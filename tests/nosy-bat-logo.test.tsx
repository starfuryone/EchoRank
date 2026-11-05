// @vitest-environment jsdom
//
// tests/nosy-bat-logo.test.tsx — the Nosy Bat v3 wordmark and emblem
// (public/nosy-bat/v3/):
//   - the files are there: the wordmark SVGs at viewBox 195 218 1915 266 (cropped
//     to the glyphs, ~7.2:1), the emblem SVGs with a square viewBox, the PNGs
//     at their stated sizes and the wordmarks' ratio;
//   - the old marks and the v2 raster folder are gone and nothing references
//     them (app code, scripts, tests, the sidecar's PDF code);
//   - every CRAWLER_BRAND asset field is a plain string path (or the two
//     numbers), so none can be passed where a string is expected and fail;
//   - og.png exists and is 1200x630; /crawler/* carries the emblem favicon;
//   - the top bar, the sidebar row, the /site-crawler hero and the Help modal
//     render in en / fr / de-CH (<img> with explicit width/height, byline as
//     text; the sidebar emblem takes the row's colour); the schedule email's
//     header is the 800 px PNG at 240 px.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/crawler" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import { CRAWLER_BRAND, NOSY_BAT_TEAL, logoWidthAt } from "@/lib/site-crawler/brand";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import CrawlerHelpModal from "@/components/seo-tools/site-crawler-help";
import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { CRAWLER_BYLINE } from "@/lib/site-crawler/marketing-copy";
import { CRAWLER_ICONS, crawlerMetadata } from "@/lib/site-crawler/page-metadata";
import { logoHeader, scheduleEmail } from "@/lib/site-crawler/schedule-email";

const ROOT = join(__dirname, "..");
const SIDECAR = "/opt/echorank/av-service";
const V3 = join(ROOT, "public/nosy-bat/v3");
const DELETED = ["nosy-bat-mark.svg", "nosy-bat-mark-on-dark.svg", "nosy-bat-mark-512.png", "nosy-bat/v2"];
const LOCALES = ["en", "fr", "de-CH"] as const;

function walk(dir: string, exts: RegExp, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".venv" || name.startsWith(".") || name.includes(".bak")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.test(name)) out.push(p);
  }
  return out;
}

/** PNG width/height from the IHDR chunk. */
function pngSize(file: string): [number, number] {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString("latin1")).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

function viewBox(publicPath: string): number[] {
  const xml = readFileSync(join(ROOT, "public", publicPath), "utf8");
  const doc = new DOMParser().parseFromString(xml, "image/svg+xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc.documentElement.getAttribute("viewBox")!.trim().split(/\s+/).map(Number);
}

describe("the v3 files", () => {
  it("the three wordmark SVGs are cropped to the glyphs: viewBox 195 218 1915 266 (~7.2:1)", () => {
    for (const f of [CRAWLER_BRAND.logo, CRAWLER_BRAND.logoOnDark, CRAWLER_BRAND.logoOnDarkAccent]) {
      expect(viewBox(f)).toEqual([195, 218, 1915, 266]);
    }
    expect([CRAWLER_BRAND.logoWidth, CRAWLER_BRAND.logoHeight]).toEqual([1915, 266]);
    expect(CRAWLER_BRAND.logoWidth / CRAWLER_BRAND.logoHeight).toBeCloseTo(7.2, 1);
    expect(logoWidthAt(30)).toBe(216);
  });

  it("the emblem SVGs have a square viewBox; the mask one fills with currentColor", () => {
    for (const f of [CRAWLER_BRAND.mark, CRAWLER_BRAND.markOnDark, "/nosy-bat/v3/nosy-bat-emblem.svg"]) {
      const [, , w, h] = viewBox(f);
      expect(w).toBeGreaterThan(0);
      expect(w).toBe(h);
    }
    expect(readFileSync(join(ROOT, "public", CRAWLER_BRAND.mark), "utf8")).toContain('fill="currentColor"');
    expect(readFileSync(join(V3, "nosy-bat-emblem.svg"), "utf8")).toContain(`fill="${NOSY_BAT_TEAL}"`);
  });

  it("the PNGs are at their stated sizes", () => {
    for (const v of ["nosy-bat-logo", "nosy-bat-logo-on-dark", "nosy-bat-logo-on-dark-teal"]) {
      for (const w of [240, 480, 800, 1200]) expect(pngSize(join(V3, `${v}-${w}.png`))).toEqual([w, Math.round((w * 266) / 1915)]);
    }
    for (const s of [512, 64, 32, 20]) expect(pngSize(join(V3, `nosy-bat-emblem-${s}.png`))).toEqual([s, s]);
    expect(CRAWLER_BRAND.favicon).toBe("/nosy-bat/v3/nosy-bat-emblem-32.png");
    for (const u of [CRAWLER_BRAND.logoEmail, CRAWLER_BRAND.logoPdf]) expect(u).toMatch(/^https:\/\/.+\/nosy-bat\/v3\/nosy-bat-logo-800\.png$/);
  });

  it("every v3 file is world-readable (the build and the server run as other users)", () => {
    for (const f of readdirSync(V3)) expect(statSync(join(V3, f)).mode & 0o044, f).toBe(0o044);
  });

  it("og.png exists and is 1200x630", () => {
    expect(pngSize(join(ROOT, "public/nosy-bat/og.png"))).toEqual([1200, 630]);
  });
});

describe("the deleted files", () => {
  it("are gone", () => {
    for (const f of ["nosy-bat-mark.svg", "nosy-bat-mark-on-dark.svg", "nosy-bat-mark-512.png", "v2"]) expect(existsSync(join(ROOT, "public/nosy-bat", f))).toBe(false);
  });

  it("are referenced by no code: src, scripts, tests, the sidecar", () => {
    const files = [
      ...walk(join(ROOT, "src"), /\.(ts|tsx|js|mjs|css|json)$/),
      ...walk(join(ROOT, "scripts"), /\.(ts|mjs|js|sh)$/),
      ...walk(join(ROOT, "tests"), /\.(ts|tsx)$/).filter((f) => !f.endsWith("nosy-bat-logo.test.tsx")),
      ...walk(SIDECAR, /\.py$/),
    ];
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.filter((f) => {
      const s = readFileSync(f, "utf8");
      return DELETED.some((d) => s.includes(d)) || /\blogoOnLight\b/.test(s);
    });
    expect(offenders).toEqual([]);
  });
});

describe("CRAWLER_BRAND", () => {
  it("every asset field is a string (a path or URL), the size two numbers", () => {
    for (const [k, v] of Object.entries(CRAWLER_BRAND)) {
      if (k === "logoWidth" || k === "logoHeight") expect(typeof v, k).toBe("number");
      else expect(typeof v, k).toBe("string");
    }
    // Every public path it names exists.
    for (const v of Object.values(CRAWLER_BRAND)) if (typeof v === "string" && v.startsWith("/nosy-bat/")) expect(existsSync(join(ROOT, "public", v)), v).toBe(true);
  });

  it("/crawler/* carries the emblem as its tab icon", () => {
    expect(crawlerMetadata("en", "start").icons).toEqual(CRAWLER_ICONS);
    expect(JSON.stringify(CRAWLER_ICONS)).toContain(CRAWLER_BRAND.favicon);
  });
});

function checkImg(img: Element | null, src: string, height: number) {
  expect(img).not.toBeNull();
  expect(img!.tagName).toBe("IMG");
  expect(img!.getAttribute("src")).toBe(src);
  expect([img!.getAttribute("width"), img!.getAttribute("height")]).toEqual([String(logoWidthAt(height)), String(height)]);
}

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => null })));
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  nav.pathname = "/crawler";
  vi.unstubAllGlobals();
});

describe.each(LOCALES)("%s", (l) => {
  const t = SITE_CRAWLER_COPY[l];

  it("top bar on /crawler/*: the teal logo, 30 px high and 216 wide (alt = the name), then the byline text", async () => {
    nav.pathname = "/crawler/abc";
    await act(async () => root.render(createElement(Header, { title: CRAWLER_BRAND.name, byline: t.byline, locale: l })));
    const img = el.querySelector("header h1 img");
    checkImg(img, CRAWLER_BRAND.logo, 30);
    expect(img!.getAttribute("alt")).toBe(CRAWLER_BRAND.name);
    expect(el.querySelector("header h1")!.textContent).toBe(t.byline);
    expect(img!.compareDocumentPosition(el.querySelector("header h1 span:last-child")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("top bar elsewhere: the plain title, no logo", async () => {
    nav.pathname = "/dashboard";
    await act(async () => root.render(createElement(Header, { title: "Dashboard", locale: l })));
    expect(el.querySelector("header img")).toBeNull();
    expect(el.querySelector("header h1")!.textContent).toBe("Dashboard");
  });

  it("sidebar: the emblem at the lucide icons' 20 px, in the row's colour (gray, white on hover / active)", () => {
    for (const [path, active] of [["/dashboard", false], ["/crawler/abc", true]] as const) {
      nav.pathname = path;
      el.innerHTML = renderToStaticMarkup(createElement(Sidebar, { locale: l, paid: true, assistantVisible: false }));
      const row = el.querySelector('a[href="/crawler"]')!;
      expect(row.textContent).toContain(CRAWLER_BRAND.name);
      const icon = row.querySelector("[data-nb-emblem]")!;
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("class")).toBe("h-5 w-5 shrink-0");
      // Same size class as a lucide icon in a sibling row.
      expect(el.querySelector('a[href="/dashboard"] svg')!.getAttribute("class")).toContain("h-5 w-5 shrink-0");
      const style = icon.getAttribute("style") ?? "";
      expect(style).toContain(`url(&quot;${CRAWLER_BRAND.mark}&quot;)`.replace(/&quot;/g, '"'));
      expect(style).toContain("background-color:currentColor");
      expect(row.querySelector("img")).toBeNull();
      const cls = row.getAttribute("class") ?? "";
      if (active) expect(cls).toContain("text-white");
      else expect(cls).toMatch(/text-gray-400.*hover:text-white/);
    }
  });

  it("/site-crawler hero: the light-teal logo, 72 px high, the byline under it; teal under the day theme", async () => {
    const Page = (await import("@/app/[locale]/site-crawler/page")).default;
    el.innerHTML = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: l }) }));
    const lockup = el.querySelector('[data-testid="hero-lockup"]')!;
    const [main, day] = [...lockup.querySelectorAll("img")];
    checkImg(main ?? null, CRAWLER_BRAND.logoOnDarkAccent, 72);
    expect(main!.getAttribute("alt")).toBe(CRAWLER_BRAND.name);
    checkImg(day ?? null, CRAWLER_BRAND.logo, 72);
    expect([day!.getAttribute("alt"), day!.getAttribute("aria-hidden")]).toEqual(["", "true"]);
    expect(lockup.querySelector("p")!.textContent).toBe(CRAWLER_BYLINE[l === "fr" ? "fr" : "en"]);
    expect(main!.compareDocumentPosition(el.querySelector("h1")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Help modal: the 28 px teal logo (decorative — the title names the brand) and the byline", async () => {
    await act(async () =>
      root.render(createElement(CrawlerHelpModal, { t, locale: l, quota: null, guideHref: "/g", allGuidesHref: "/gs", onClose: () => {} })),
    );
    await vi.waitFor(() => expect(document.querySelector('[data-testid="crawler-help-brand"]')).not.toBeNull());
    const brand = document.querySelector('[data-testid="crawler-help-brand"]')!;
    const img = brand.querySelector("img");
    checkImg(img, CRAWLER_BRAND.logo, 28);
    expect([img!.getAttribute("alt"), img!.getAttribute("aria-hidden")]).toEqual(["", "true"]);
    expect(brand.textContent).toBe(t.byline);
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain(CRAWLER_BRAND.name);
  });

  it("schedule email: the 800 px PNG, absolute, shown 240 px wide, the byline as text", () => {
    const m = scheduleEmail({ locale: l, host: "x.com", crawlJobId: "j", pagesCrawled: 3, issues: { ERROR: 0, WARNING: 0, NOTICE: 0 }, comparison: null });
    expect(m.html).toContain(`<img src="${CRAWLER_BRAND.logoEmail}" width="240" height="33" alt="${CRAWLER_BRAND.name}"`);
    expect(m.html.indexOf("<img")).toBeLessThan(m.html.indexOf("x.com"));
    expect(logoHeader("by")).toMatch(/<p[^>]*>by<\/p>$/);
  });
});
