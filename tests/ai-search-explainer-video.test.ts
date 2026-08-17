// tests/ai-search-explainer-video.test.ts
//
// The "Watch Explainer Video" button on /visibility/ai-search/setup.
//
// Two things this guards that nothing else would:
//
// 1. THE ASSETS ARE ON DISK. public/videos/ is gitignored wholesale, so the mp4
//    and its poster ship outside git — the same arrangement as the chapter
//    videos, which tests/learn-content.test.ts checks the same way. A rename in
//    the component is therefore a silent 404 rather than a build error.
//
// 2. IT DOES NOT RE-IMPLEMENT THE DIALOG. components/ui/modal.tsx owns
//    role="dialog", aria-modal, the focus trap, Escape, backdrop click and focus
//    restore. This page already carries one hand-rolled dialog
//    (AiSearchSetupHelp), and a second copy is how those behaviours drift apart.
//    Asserted against the source because the accessible behaviour lives in the
//    primitive, not in markup this test could render.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AI_SEARCH_EXPLAINER_COPY } from "@/lib/i18n/dashboard";

const ROOT = process.cwd();
const COMPONENT = join(
  ROOT,
  "src",
  "app",
  "(dashboard)",
  "visibility",
  "ai-search",
  "setup",
  "ExplainerVideoButton.tsx",
);
const SRC = readFileSync(COMPONENT, "utf8");
const LOCALES = ["en", "fr", "de-CH"] as const;

/**
 * Source with comments removed, in the style of tests/rollout-gated-links.test.ts.
 *
 * Needed for the "hand-rolls nothing" assertion below: the component's own header
 * comment NAMES the behaviours it delegates (role="dialog", aria-modal, Escape),
 * and matching prose that documents the delegation would fail the test that
 * checks the delegation happened.
 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("explainer video assets", () => {
  it("references both assets site-relative, under /videos/", () => {
    expect(SRC).toContain('"/videos/ai-search-tracking-explainer.mp4"');
    expect(SRC).toContain('"/videos/ai-search-tracking-explainer-poster.jpg"');
  });

  it.each([
    "/videos/ai-search-tracking-explainer.mp4",
    "/videos/ai-search-tracking-explainer-poster.jpg",
  ])("ships %s on disk, non-empty", (asset) => {
    // public/videos/ is gitignored, so this asserts the deploy box, exactly as
    // the chapter-video guard in tests/learn-content.test.ts does.
    const file = join(ROOT, "public", asset);
    expect(existsSync(file), `${asset} is missing`).toBe(true);
    expect(statSync(file).size, `${asset} is empty`).toBeGreaterThan(0);
  });
});

describe("the player", () => {
  it("uses native controls, and never autoplays", () => {
    // A narrated 61-second clip: standard controls, and sound only on a click.
    expect(CODE).toContain("controls");
    expect(CODE).toContain("playsInline");
    expect(CODE).toContain('preload="metadata"');
    // The component comment mentions HomeVideo's controls={false}, so the
    // negative assertion in particular has to read comment-free source.
    expect(CODE).not.toMatch(/autoPlay/i);
    expect(CODE).toContain("<video");
  });

  it("stops and rewinds playback on close", () => {
    // The modal unmounts its children, so this is belt-and-braces — but the
    // audio must stop on the click, not whenever the detached element is GC'd.
    expect(SRC).toContain("video.pause()");
    expect(SRC).toContain("video.currentTime = 0");
  });

  it("holds the frame in a 16:9 box that survives mobile widths", () => {
    expect(SRC).toContain("aspect-video");
    expect(SRC).toContain("max-w-3xl");
  });
});

describe("the dialog", () => {
  it("delegates to the shared Modal primitive", () => {
    expect(SRC).toContain('from "@/components/ui/modal"');
    expect(SRC).toContain("<Modal");
  });

  it("hand-rolls none of the behaviour the primitive already owns", () => {
    // If any of these appear here, the primitive stopped being the single place
    // the dialog contract lives.
    for (const smell of ['role="dialog"', "aria-modal", '"Escape"', "addEventListener"]) {
      expect(CODE, `${smell} belongs in components/ui/modal.tsx`).not.toContain(smell);
    }
  });

  it("uses the dashboard Button primitive, not a bare button", () => {
    expect(SRC).toContain('from "@/components/ui/button"');
    expect(SRC).toContain("<Button");
  });
});

describe("copy", () => {
  it("covers the three dashboard locales and no more", () => {
    // dashboardLocale() folds everything else to these three, so a fourth
    // catalog would be unreachable code.
    expect(Object.keys(AI_SEARCH_EXPLAINER_COPY).sort()).toEqual(["de-CH", "en", "fr"]);
  });

  it("resolves every label in every locale", () => {
    for (const locale of LOCALES) {
      const copy = AI_SEARCH_EXPLAINER_COPY[locale];
      for (const [key, value] of Object.entries(copy)) {
        expect(value.trim().length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("labels the trigger as specified in English", () => {
    expect(AI_SEARCH_EXPLAINER_COPY.en.watch).toBe("Watch Explainer Video");
  });

  it("says Echorank, never EchoRank, and uses ss over ß in de-CH", () => {
    // Both house rules, asserted the same way the other catalogs assert them.
    expect(JSON.stringify(AI_SEARCH_EXPLAINER_COPY)).not.toMatch(/EchoRank/);
    expect(JSON.stringify(AI_SEARCH_EXPLAINER_COPY["de-CH"])).not.toMatch(/ß/);
  });
});
