// tests/landing-theme.test.ts
//
// The Night/Day layer across the standalone landing documents.
//
// ── WHY A TEST AND NOT A SHARED MODULE ────────────────────────────────────
// Each landing-html.ts is one hand-written HTML document embedded in a
// template literal, and the payload MAY NOT CONTAIN `${` — tests/landing-
// links.test.ts enforces exactly that, because the markup is pasted in
// verbatim and an interpolation in the source would break out of the literal.
// So the theme layer cannot be imported; it is copied into each document, the
// same way the in-page nav is a static clone of PublicNav.
//
// Copied code drifts. This is the thing that notices.
//
// It also checks the two properties that make the layer safe to serve from a
// route handler at all: the guard runs before paint, and the switch is
// client-only. These responses are cached at the edge — one of them for a
// year — so the HTML must be byte-identical for every visitor, which rules
// out a cookie and rules out any server-side branch on the theme.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src", "app", "[locale]");

/** Every standalone landing document, discovered rather than listed. */
function landingDocs(): { slug: string; file: string }[] {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ slug: entry.name, file: join(ROOT, entry.name, "landing-html.ts") }))
    .filter((doc) => existsSync(doc.file))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Not yet themed, and named rather than skipped silently.
 *
 * src/app/[locale]/seo-guide/ is owned by root with mode 755, so the `deploy`
 * account this repo is edited from cannot write into that directory at all —
 * not the file, not a sibling to rename over it. It is the only one of the
 * nine in that state. The fix is one command as root:
 *
 *   chown -R deploy:deploy 'src/app/[locale]/seo-guide'
 *
 * after which this entry comes out and the page gets the same treatment as
 * its eight siblings. The assertion below is deliberately two-sided: it fails
 * if the page is still unthemed AND it fails once the page IS themed, so the
 * exception cannot outlive the reason for it.
 */
const PENDING = new Set(["seo-guide"]);

const GUARD = 'localStorage.getItem("er-theme")==="day"';
const DAY_BLOCK = '[data-theme="day"]{';
const BUTTON = 'id="er-theme"';

describe("standalone landing documents carry the theme layer", () => {
  const docs = landingDocs();

  it("finds the family", () => {
    // If this number moves, a page was added or removed and the rest of this
    // file should be read again rather than trusted.
    expect(docs.length).toBeGreaterThanOrEqual(9);
  });

  for (const { slug, file } of docs) {
    const html = readFileSync(file, "utf8");
    const pending = PENDING.has(slug);

    it(`${slug}${pending ? " — PENDING, see the note above" : ""}`, () => {
      const themed = html.includes(GUARD) && html.includes(DAY_BLOCK) && html.includes(BUTTON);
      if (pending) {
        expect(themed, `${slug} is themed now — remove it from PENDING`).toBe(false);
        return;
      }
      expect(html, "FOUC guard").toContain(GUARD);
      expect(html, "day override block").toContain(DAY_BLOCK);
      expect(html, "toggle button").toContain(BUTTON);
    });

    if (pending) continue;

    it(`${slug} runs the guard in <head>, before anything paints`, () => {
      const head = html.indexOf("<head>");
      const bodyTag = html.indexOf("<body");
      expect(head).toBeGreaterThan(-1);
      expect(html.indexOf(GUARD)).toBeGreaterThan(head);
      // Anything after <body> paints night first and then flips, which on a
      // dark-to-light change is a full-screen flash.
      expect(html.indexOf(GUARD)).toBeLessThan(bodyTag);
    });

    it(`${slug} keeps night as the DEFAULT`, () => {
      // Night is the absence of the attribute, never data-theme="night" — the
      // uncached, unscripted, crawler-visible render must be the page that
      // shipped before the toggle existed.
      expect(html).not.toContain('data-theme="night"');
      expect(html).not.toContain("<html lang=\"en\" data-theme");
    });

    it(`${slug} stays client-only, so the edge cache stays sound`, () => {
      // A cookie would make the response vary per visitor; these are cached
      // for up to a year and served from Cloudflare, so there is exactly one
      // body and the browser decides the theme.
      expect(html).not.toContain("document.cookie");
      expect(html).not.toContain("prefers-color-scheme");
    });

    it(`${slug} defines the ink tokens the day block overrides`, () => {
      // The fill/text split is the whole point: --gold paints a button and is
      // 1.6:1 as text on white. Every document declares its own night values
      // for these, equal to the fills, so night does not move.
      for (const token of ["--ink-accent", "--ink-good", "--ink-bad", "--ink-on-gold"]) {
        expect(html, token).toContain(`${token}:`);
      }
      // --ink-on-gold is theme-INVARIANT: it sits on gold, which does not move.
      const day = html.slice(html.indexOf(DAY_BLOCK));
      const dayBlock = day.slice(0, day.indexOf("}"));
      expect(dayBlock).not.toContain("--ink-on-gold");
    });
  }
});

describe("the copied layer is identical everywhere", () => {
  // The reason this file exists. Two documents that disagree about the storage
  // key are two documents that forget each other's theme on every link.
  const docs = landingDocs().filter((d) => !PENDING.has(d.slug));

  it("uses one storage key, and it is the React one", () => {
    for (const { slug, file } of docs) {
      const html = readFileSync(file, "utf8");
      expect(html, slug).toContain('var KEY="er-theme"');
      expect(html, slug).toContain(GUARD);
    }
  });

  it("ships the same day palette in every document", () => {
    const blocks = docs.map(({ file }) => {
      const html = readFileSync(file, "utf8");
      const start = html.indexOf(DAY_BLOCK);
      return html.slice(start, start + html.slice(start).indexOf("}") + 1);
    });
    for (const block of blocks) expect(block).toBe(blocks[0]);
  });

  it("agrees with globals.css on what day looks like", () => {
    // The React pages and these documents are the same site. A visitor who
    // switches to day on /pricing and follows a link to /glossary must not
    // cross a seam.
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const day = globals.slice(globals.indexOf('[data-theme="day"]'));
    const html = readFileSync(docs[0].file, "utf8");
    const block = html.slice(html.indexOf(DAY_BLOCK));

    for (const [landing, global] of [
      ["--bg:#FFFFFF", "--er-bg: #ffffff"],
      ["--surface:#F5F6F8", "--er-surface: #f5f6f8"],
      ["--text:#1E2329", "--er-text: #1e2329"],
      ["--muted:#5A6270", "--er-text-muted: #5a6270"],
      ["--ink-accent:#8A6100", "--er-accent-text: #8a6100"],
    ] as const) {
      expect(block, landing).toContain(landing);
      expect(day, global).toContain(global);
    }
  });
});
