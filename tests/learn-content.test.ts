// Knowledge Hub config integrity + route table.
//
// Modelled on src/lib/__tests__/seo-tools.test.ts, which caught config/route
// drift before it shipped. The failure this suite exists to prevent: a chapter
// that lives in learn-content.ts, appears in the hub list and in sitemap.xml,
// and 404s when a visitor clicks it — or the reverse, a page nothing links to.
//
// Everything here reads the config. No test names a chapter title or a URL that
// is not derived from it, because a hand-kept expectation would drift the same
// way the thing it is guarding does.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ECHOPEDIA_DESCRIPTION,
  ECHOPEDIA_SLUG,
  ECHOPEDIA_TERMS,
  ECHOPEDIA_TITLE,
  LEARN_BASE,
  LEARN_CHAPTERS,
  LEARN_GUIDES,
  LEARN_PDF,
  chapterBySlug,
  chapterNeighbours,
  guideBySlug,
  headingId,
  learnRoutes,
  tableOfContents,
  type LearnBlock,
  type LearnLink,
} from "@/lib/learn-content";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const APP = join(process.cwd(), "src", "app", "[locale]", "learn");
const ALL = [...LEARN_CHAPTERS, ...LEARN_GUIDES];

/** Every path a learn link may point at, and where each one is proven to exist. */
const LOCALE_PREFIXED = new Set(LOCALIZED_ROUTES.map((r) => r.path));
/** App routes that are NOT locale-prefixed. Proven by the route file on disk. */
const APP_ROUTES: Record<string, string> = {
  "/register": "src/app/(auth)/register",
  "/visibility/tools": "src/app/(dashboard)/visibility/tools",
  "/visibility/tools/mcp-server": "src/app/(dashboard)/visibility/tools/mcp-server",
};
/** Caddy-served static pages, outside this repo (/opt/echorank/extension-dist). */
const CADDY_PAGES = new Set([
  "/extension/download.html",
  "/extension/help.html",
  "/extension/howto-import-reviews.html",
  "/extension/getting-reviews-in.html",
]);
const EXTENSION_DIST = "/opt/echorank/extension-dist";

function isLive(href: string): boolean {
  const [path, hash] = href.split("#");
  void hash;
  if (LOCALE_PREFIXED.has(path)) return true;
  if (path in APP_ROUTES) return true;
  if (CADDY_PAGES.has(path)) return true;
  // Learn's own pages are covered by the route-table test below.
  if (path === LEARN_BASE || path.startsWith(`${LEARN_BASE}/`)) return true;
  if (path.startsWith("/whitepapers/")) return true;
  return false;
}

function bodyLinks(body: readonly LearnBlock[]): string[] {
  const text: string[] = [];
  for (const b of body) {
    if (b.k === "p" || b.k === "h2" || b.k === "h3" || b.k === "code") text.push(b.t);
    if (b.k === "ul" || b.k === "ol") text.push(...b.items);
    if (b.k === "quote") text.push(...b.paras);
    if (b.k === "table") text.push(...b.head, ...b.rows.flat());
  }
  return [...text.join("\n").matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]);
}

describe("route table", () => {
  it("every config slug has a page that can render it", () => {
    // Four route files cover all seventeen paths: the hub, one dynamic chapter
    // segment, one dynamic guide segment, and Echopedia.
    expect(existsSync(join(APP, "page.tsx")), "hub page").toBe(true);
    expect(existsSync(join(APP, "[chapter]", "page.tsx")), "chapter route").toBe(true);
    expect(existsSync(join(APP, "guides", "[slug]", "page.tsx")), "guide route").toBe(true);
    expect(existsSync(join(APP, ECHOPEDIA_SLUG, "page.tsx")), "echopedia").toBe(true);
  });

  it("every rendered route is in the config — no orphan page directories", () => {
    const dirs = readdirSync(APP, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => d.name)
      .sort();
    // A new directory here is a page nothing in the config knows about. Add it
    // to the config (or to this list, deliberately) rather than deleting the
    // assertion.
    expect(dirs).toEqual(["[chapter]", ECHOPEDIA_SLUG, "guides"].sort());
  });

  it("learnRoutes() covers the hub, every chapter, every guide and Echopedia", () => {
    expect(learnRoutes()).toEqual([
      LEARN_BASE,
      ...LEARN_CHAPTERS.map((c) => `${LEARN_BASE}/${c.slug}`),
      ...LEARN_GUIDES.map((g) => `${LEARN_BASE}/guides/${g.slug}`),
      `${LEARN_BASE}/${ECHOPEDIA_SLUG}`,
    ]);
    expect(learnRoutes()).toHaveLength(1 + LEARN_CHAPTERS.length + LEARN_GUIDES.length + 1);
  });

  it("puts every learn route in the sitemap registry, once, for every locale", () => {
    const registered = LOCALIZED_ROUTES.map((r) => r.path);
    for (const path of learnRoutes()) {
      expect(registered.filter((p) => p === path), path).toHaveLength(1);
    }
    // The sitemap emits one URL per locale per registered path.
    expect(SUPPORTED_LOCALES.length).toBeGreaterThan(1);
  });

  it("resolves every slug through the lookup helpers", () => {
    for (const c of LEARN_CHAPTERS) expect(chapterBySlug(c.slug)).toBe(c);
    for (const g of LEARN_GUIDES) expect(guideBySlug(g.slug)).toBe(g);
    expect(chapterBySlug("does-not-exist")).toBeUndefined();
    expect(guideBySlug("does-not-exist")).toBeUndefined();
  });
});

describe("config integrity", () => {
  it("has ten chapters numbered 1..10 in order, and five guides", () => {
    expect(LEARN_CHAPTERS.map((c) => c.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(LEARN_GUIDES).toHaveLength(5);
    expect(LEARN_GUIDES.map((g) => g.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps slugs unique across chapters and guides", () => {
    const slugs = ALL.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every article a title, a description and a reading time", () => {
    for (const a of ALL) {
      expect(a.title.trim().length, a.slug).toBeGreaterThan(0);
      expect(a.description.trim().length, a.slug).toBeGreaterThan(0);
      expect(a.readingTime, a.slug).toBeGreaterThan(0);
      expect(a.body.length, a.slug).toBeGreaterThan(3);
    }
  });

  it("chains prev/next through the course without wrapping around", () => {
    expect(chapterNeighbours(LEARN_CHAPTERS[0].slug).prev).toBeUndefined();
    expect(chapterNeighbours(LEARN_CHAPTERS.at(-1)!.slug).next).toBeUndefined();
    for (let i = 1; i < LEARN_CHAPTERS.length; i++) {
      expect(chapterNeighbours(LEARN_CHAPTERS[i].slug).prev).toBe(LEARN_CHAPTERS[i - 1]);
    }
  });

  it("says Echorank, never EchoRank", () => {
    // The house rule, enforced the same way tests/marketing-i18n.test.ts does.
    const everything = JSON.stringify([LEARN_CHAPTERS, LEARN_GUIDES, ECHOPEDIA_TERMS]);
    expect(everything).not.toMatch(/EchoRank/);
    expect(ECHOPEDIA_TITLE + ECHOPEDIA_DESCRIPTION).not.toMatch(/EchoRank/);
  });
});

describe("in-page anchors", () => {
  it("gives every h2 in an article a unique, non-empty anchor", () => {
    for (const a of ALL) {
      const toc = tableOfContents(a.body);
      const ids = toc.map((h) => h.id);
      for (const id of ids) expect(id.length, `${a.slug}: empty anchor`).toBeGreaterThan(0);
      // Duplicate ids would send two TOC entries to the same place.
      expect(new Set(ids).size, `${a.slug}: duplicate h2 anchors`).toBe(ids.length);
    }
  });

  it("gives every glossary term a unique anchor", () => {
    const ids = ECHOPEDIA_TERMS.map((t) => headingId(t.term));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("defines every glossary term", () => {
    expect(ECHOPEDIA_TERMS.length).toBeGreaterThan(10);
    for (const t of ECHOPEDIA_TERMS) {
      expect(t.term.trim().length).toBeGreaterThan(0);
      expect(t.definition.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("calls to action", () => {
  it("offers the free audit on chapters 1, 2, 7 and 8, and a trial elsewhere", () => {
    // The brief's rule. The audit needs no account, so it is the honest CTA on
    // the chapters that tell a reader to go and measure something.
    const audit = LEARN_CHAPTERS.filter((c) => c.cta === "audit").map((c) => c.order);
    expect(audit).toEqual([1, 2, 7, 8]);
    for (const g of LEARN_GUIDES) expect(g.cta, g.slug).toBe("register");
  });
});

describe("internal links", () => {
  const links = (a: { related: readonly LearnLink[]; body: readonly LearnBlock[] }) => [
    ...a.related.map((r) => r.href),
    ...bodyLinks(a.body),
  ];

  it("links every chapter to at least one live Echorank surface", () => {
    for (const c of LEARN_CHAPTERS) {
      expect(c.related.length, `${c.slug} has no related links`).toBeGreaterThan(0);
    }
  });

  it("points every link at something that exists", () => {
    for (const a of ALL) {
      for (const href of links(a)) {
        if (href.startsWith("http")) {
          // Absolute links are to our own domain or an external reference; the
          // only ones the pack uses are echorank360.com Caddy pages.
          expect(href, `${a.slug}: ${href}`).toMatch(/^https:\/\/echorank360\.com\//);
          const path = href.replace("https://echorank360.com", "");
          expect(CADDY_PAGES.has(path), `${a.slug}: unknown extension page ${path}`).toBe(true);
          continue;
        }
        expect(isLive(href), `${a.slug}: ${href} is not a known live surface`).toBe(true);
      }
    }
  });

  it("points every learn-internal link at a route that exists", () => {
    const known = new Set(learnRoutes());
    for (const a of ALL) {
      for (const href of links(a)) {
        const path = href.split("#")[0];
        if (path.startsWith(`${LEARN_BASE}/`) || path === LEARN_BASE) {
          expect(known.has(path), `${a.slug}: ${path} is not a learn route`).toBe(true);
        }
      }
    }
  });

  it("marks locale-prefixed links internal and Caddy pages not", () => {
    for (const a of ALL) {
      for (const r of a.related) {
        if (r.href.startsWith("/extension/")) {
          expect(r.internal, `${a.slug}: ${r.href} must not be locale-prefixed`).toBeFalsy();
        }
        if (r.href.startsWith("/learn")) {
          expect(r.internal, `${a.slug}: ${r.href} must be locale-prefixed`).toBe(true);
        }
      }
    }
  });

  it("finds the non-locale app routes it links to on disk", () => {
    for (const [href, dir] of Object.entries(APP_ROUTES)) {
      expect(existsSync(join(process.cwd(), dir)), `${href} → ${dir}`).toBe(true);
    }
  });

  it("ships the PDF the hub CTA links to", () => {
    expect(LEARN_PDF.startsWith("/whitepapers/")).toBe(true);
    expect(existsSync(join(process.cwd(), "public", LEARN_PDF))).toBe(true);
  });
});

describe("video", () => {
  const withVideo = ALL.filter((a) => a.video);

  it("carries the install walkthrough on chapter 3 and the extension guide only", () => {
    expect(withVideo.map((a) => a.slug).sort()).toEqual(
      ["import-your-review-history", "install-browser-extension"].sort(),
    );
  });

  it("references the mp4 absolutely — it is Caddy-served, not bundled", () => {
    for (const a of withVideo) {
      // Copying this into public/videos/ is the mistake this guards: no build
      // ships the file, and a relative path would 404 in the app.
      expect(a.video!.src).toBe("https://echorank360.com/extension/echorank-extension-install.mp4");
      expect(a.video!.poster).toBe("https://echorank360.com/extension/install-video-poster.jpg");
      expect(a.video!.uploadDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.video!.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("puts a video marker in the prose of every article that has a video, and only those", () => {
    for (const a of ALL) {
      const marked = a.body.some((b) => b.k === "video");
      expect(marked, `${a.slug}`).toBe(Boolean(a.video));
    }
  });

  it("serves the mp4 and its poster from the Caddy directory", () => {
    // Best-effort: this box serves them off disk from outside the repo, so the
    // check runs only where that directory is present.
    if (!existsSync(EXTENSION_DIST)) return;
    expect(existsSync(join(EXTENSION_DIST, "echorank-extension-install.mp4"))).toBe(true);
    expect(existsSync(join(EXTENSION_DIST, "install-video-poster.jpg"))).toBe(true);
  });
});

describe("FAQ", () => {
  it("carries a FAQ on the extension guide only, with a marker in the prose", () => {
    for (const g of LEARN_GUIDES) {
      const marked = g.body.some((b) => b.k === "faq");
      expect(marked, `${g.slug}`).toBe(Boolean(g.faq));
    }
    expect(LEARN_GUIDES.filter((g) => g.faq).map((g) => g.slug)).toEqual([
      "install-browser-extension",
    ]);
  });

  it("gives every FAQ entry a question and an answer", () => {
    for (const g of LEARN_GUIDES.filter((g) => g.faq)) {
      expect(g.faq!.length).toBeGreaterThan(2);
      for (const entry of g.faq!) {
        expect(entry.q.trim().length).toBeGreaterThan(0);
        expect(entry.a.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
