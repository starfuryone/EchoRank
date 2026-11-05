// @vitest-environment jsdom
//
// tests/nosy-bat-logo.test.tsx — the Nosy Bat v2 logo (public/nosy-bat/v2/):
//   - the files are there at the sizes brand.ts declares (735:410);
//   - the old SVG lockups are gone and nothing references them (app code,
//     scripts, tests, the sidecar's PDF code);
//   - the brand's asset OBJECTS (logo, logoOnDark) are never used where a
//     string is expected — `src={CRAWLER_BRAND.logoOnDark}` is what broke a
//     deploy's type check; every use reads a field (.png, .webp, .sizes…) or
//     goes through <NosyBatLogo>;
//   - og.png exists and is 1200x630;
//   - the top bar, the /site-crawler hero and the Help modal render the logo
//     (<picture>, webp + png, explicit width/height) with the byline as text,
//     in en / fr / de-CH; the schedule email's header is the on-white PNG.
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

import { CRAWLER_BRAND, NOSY_BAT_LOGO_GLOW, logoWidth } from "@/lib/site-crawler/brand";
import { Header } from "@/components/layout/header";
import CrawlerHelpModal from "@/components/seo-tools/site-crawler-help";
import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { CRAWLER_BYLINE } from "@/lib/site-crawler/marketing-copy";
import { logoHeader, scheduleEmail } from "@/lib/site-crawler/schedule-email";

const ROOT = join(__dirname, "..");
const SIDECAR = "/opt/echorank/av-service";
const DELETED = ["nosy-bat-logo-on-dark.svg", "nosy-bat-logo-on-light.svg"];
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

describe("the v2 logo files", () => {
  it("exist at the sizes brand.ts declares, all 735:410", () => {
    const L = CRAWLER_BRAND.logo;
    expect(pngSize(join(ROOT, "public", L.png))).toEqual([L.width, L.height]);
    expect(L.width / L.height).toBeCloseTo(735 / 410, 6);
    for (const s of L.sizes) {
      const [w, h] = pngSize(join(ROOT, "public", s.src));
      expect(w).toBe(s.w);
      expect(Math.abs(h - (w * 410) / 735)).toBeLessThanOrEqual(1);
    }
    // WebP (VP8X): canvas width-1 / height-1, 24-bit little endian at 24 / 27.
    const webp = readFileSync(join(ROOT, "public", L.webp));
    expect(webp.subarray(8, 16).toString("latin1")).toBe("WEBPVP8X");
    expect([webp.readUIntLE(24, 3) + 1, webp.readUIntLE(27, 3) + 1]).toEqual([735, 410]);
    expect(CRAWLER_BRAND.logoOnDark).toBe(CRAWLER_BRAND.logo);
    expect(CRAWLER_BRAND.logoEmail).toMatch(/^https:\/\/.+\/nosy-bat\/v2\/nosy-bat-logo-on-white\.png$/);
    expect(pngSize(join(ROOT, "public/nosy-bat/v2/nosy-bat-logo-on-white.png"))).toEqual([735, 410]);
    expect("logoOnLight" in CRAWLER_BRAND).toBe(false);
    // The marks stay.
    for (const m of [CRAWLER_BRAND.mark, CRAWLER_BRAND.markOnDark]) expect(existsSync(join(ROOT, "public", m))).toBe(true);
  });

  it("og.png exists and is 1200x630", () => {
    expect(pngSize(join(ROOT, "public/nosy-bat/og.png"))).toEqual([1200, 630]);
  });
});

describe("the old SVG lockups", () => {
  it("are deleted", () => {
    for (const f of DELETED) expect(existsSync(join(ROOT, "public/nosy-bat", f))).toBe(false);
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

describe("the brand's asset objects", () => {
  it("are never used where a string is expected", () => {
    // Which CRAWLER_BRAND fields are objects, read from brand.ts itself, so a
    // new object field is covered without editing this test.
    const objectFields = Object.entries(CRAWLER_BRAND)
      .filter(([, v]) => typeof v === "object")
      .map(([k]) => k);
    expect(objectFields).toEqual(expect.arrayContaining(["logo", "logoOnDark"]));
    const bare = new RegExp(`CRAWLER_BRAND\\.(${objectFields.join("|")})\\b(?!\\s*\\.)`, "g");
    // The one sanctioned bare read: <NosyBatLogo> takes the object to read its fields.
    const allowed = new Set(["src/components/brand/NosyBatLogo.tsx:const L = CRAWLER_BRAND.logo;"]);
    const offenders: string[] = [];
    for (const f of walk(join(ROOT, "src"), /\.(ts|tsx)$/)) {
      const rel = f.slice(ROOT.length + 1);
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (bare.test(line) && !allowed.has(`${rel}:${line.trim()}`)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
          bare.lastIndex = 0;
        });
    }
    expect(offenders).toEqual([]);
    // And every string field really is a string (a src, an alt, the UA).
    for (const [k, v] of Object.entries(CRAWLER_BRAND)) if (!objectFields.includes(k)) expect(typeof v, k).toBe("string");
  });

  it("does not type as a string (checked by tsc, which runs before every build)", () => {
    // @ts-expect-error — the logo is an object; pass .png / .webp, or use <NosyBatLogo>.
    const asSrc: string = CRAWLER_BRAND.logoOnDark;
    // @ts-expect-error — same for the light/dark-neutral logo.
    const asSrc2: string = CRAWLER_BRAND.logo;
    expect(typeof asSrc).toBe("object");
    expect(typeof asSrc2).toBe("object");
  });
});

/** The <img> inside a <picture> with the webp source, and its declared size. */
function checkPicture(img: Element | null, height: number) {
  expect(img).not.toBeNull();
  const pic = img!.closest("picture")!;
  expect(pic).not.toBeNull();
  expect(pic.querySelector('source[type="image/webp"]')!.getAttribute("srcset")).toContain(CRAWLER_BRAND.logo.webp);
  expect(img!.getAttribute("src")).toBe(CRAWLER_BRAND.logo.png);
  const srcset = img!.getAttribute("srcset") ?? img!.getAttribute("srcSet") ?? "";
  for (const s of CRAWLER_BRAND.logo.sizes) expect(srcset).toContain(`${s.src} ${s.w}w`);
  expect([img!.getAttribute("width"), img!.getAttribute("height")]).toEqual([String(logoWidth(height)), String(height)]);
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

  it("top bar on /crawler/*: the 44 px logo (alt = the name) and the byline as text", async () => {
    nav.pathname = "/crawler/abc";
    await act(async () => root.render(createElement(Header, { title: CRAWLER_BRAND.name, byline: t.byline, locale: l })));
    const img = el.querySelector("header h1 img");
    checkPicture(img, 44);
    expect(img!.getAttribute("alt")).toBe(CRAWLER_BRAND.name);
    expect(el.querySelector("header h1")!.textContent).toBe(t.byline);
    // No glow on the white top bar.
    expect(img!.hasAttribute("data-glow")).toBe(false);
  });

  it("top bar elsewhere: the plain title, no logo", async () => {
    nav.pathname = "/dashboard";
    await act(async () => root.render(createElement(Header, { title: "Dashboard", locale: l })));
    expect(el.querySelector("header img")).toBeNull();
    expect(el.querySelector("header h1")!.textContent).toBe("Dashboard");
  });

  it("/site-crawler hero: the 120 px logo with the glow, the byline under it", async () => {
    const Page = (await import("@/app/[locale]/site-crawler/page")).default;
    el.innerHTML = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: l }) }));
    const lockup = el.querySelector('[data-testid="hero-lockup"]')!;
    const img = lockup.querySelector("img");
    checkPicture(img, 120);
    expect(img!.getAttribute("alt")).toBe(CRAWLER_BRAND.name);
    expect(img!.getAttribute("data-glow")).toBe(NOSY_BAT_LOGO_GLOW);
    expect(NOSY_BAT_LOGO_GLOW).toBe("drop-shadow(0 0 24px rgba(240,185,11,.35))");
    expect(lockup.querySelector("p")!.textContent).toBe(CRAWLER_BYLINE[l === "fr" ? "fr" : "en"]);
    // The logo precedes the h1.
    expect(img!.compareDocumentPosition(el.querySelector("h1")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Help modal: the 40 px logo (decorative — the title names the brand) and the byline", async () => {
    await act(async () =>
      root.render(createElement(CrawlerHelpModal, { t, locale: l, quota: null, guideHref: "/g", allGuidesHref: "/gs", onClose: () => {} })),
    );
    await vi.waitFor(() => expect(document.querySelector('[data-testid="crawler-help-brand"]')).not.toBeNull());
    const brand = document.querySelector('[data-testid="crawler-help-brand"]')!;
    const img = brand.querySelector("img");
    checkPicture(img, 40);
    expect([img!.getAttribute("alt"), img!.getAttribute("aria-hidden")]).toEqual(["", "true"]);
    expect(brand.textContent).toBe(t.byline);
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain(CRAWLER_BRAND.name);
  });

  it("schedule email: the on-white PNG, 240 px wide, absolute, the byline as text", () => {
    const m = scheduleEmail({ locale: l, host: "x.com", crawlJobId: "j", pagesCrawled: 3, issues: { ERROR: 0, WARNING: 0, NOTICE: 0 }, comparison: null });
    expect(m.html).toContain(`<img src="${CRAWLER_BRAND.logoEmail}" width="240" height="134" alt="${CRAWLER_BRAND.name}"`);
    expect(m.html.indexOf("<img")).toBeLessThan(m.html.indexOf("x.com"));
    expect(logoHeader("by")).toMatch(/<p[^>]*>by<\/p>$/);
  });
});
