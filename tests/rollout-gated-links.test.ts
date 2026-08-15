// tests/rollout-gated-links.test.ts
//
// NOTHING MAY LINK UNCONDITIONALLY TO A ROUTE THAT notFound()s.
//
// This is the same rule ai-tools.test.ts enforces for hub cards ("a locked card
// promises something that does not answer"), generalised to every link in the
// dashboard — because the rule was stated for cards and then broken twice by
// empty states, which are not cards and so were never checked.
//
// What went wrong: /visibility/tools/citation-finder and .../share-of-voice both
// shipped an empty state whose "Set up prompt tracking" link pointed at
// /visibility/ai-search/setup. That route calls notFound() when
// aiSearchEnabledFor() is false, which is the DEFAULT — so every tenant without
// the rollout got a 404 from the one CTA on an otherwise empty page.
//
// The fix in both was to make the link conditional on a server-resolved flag,
// and this test is what stops the next one being written unconditionally.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const APP = join(ROOT, "src", "app", "(dashboard)");
const COMPONENTS = join(ROOT, "src", "components");

/**
 * Source with comments removed.
 *
 * NECESSARY, not tidiness: the first version of this test scanned raw text and
 * classified citation-finder/page.tsx as rollout-gated because a COMMENT in it
 * says "whose route notFound()s when the rollout is off". That cascaded into a
 * false positive against citation-opportunities, which links to it perfectly
 * legitimately. A test that reports correct code as broken gets deleted by the
 * next person, so it has to read code as code.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Every .tsx/.ts under a directory, recursively, skipping backups. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sources(full));
      continue;
    }
    // .bak.* files are gitignored deploy backups, not code.
    if (/\.bak[.-]/.test(entry)) continue;
    if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Routes that call notFound() behind the answer-tracking rollout.
 *
 * Derived from the filesystem rather than listed, so a new gated route joins
 * this test the moment it is written.
 */
function gatedRoutes(): string[] {
  const routes: string[] = [];
  for (const file of sources(APP)) {
    if (!/page\.tsx$/.test(file)) continue;
    const src = stripComments(readFileSync(file, "utf8"));
    if (!src.includes("aiSearchEnabledFor")) continue;
    if (!src.includes("notFound()")) continue;
    // src/app/(dashboard)/visibility/ai-search/setup/page.tsx -> /visibility/ai-search/setup
    const route = file
      .slice(APP.length)
      .replace(/\/page\.tsx$/, "")
      .replace(/\\/g, "/");
    routes.push(route);
  }
  return routes;
}

describe("rollout-gated routes", () => {
  it("are discovered from the filesystem, so this test cannot silently cover nothing", () => {
    const routes = gatedRoutes();
    expect(routes.length).toBeGreaterThan(0);
    // The one the incident was about. If this stops being gated the test still
    // works — the list is derived — but its disappearance should be deliberate.
    expect(routes).toContain("/visibility/ai-search/setup");
  });

  it("are never the target of an unconditional href", () => {
    const routes = gatedRoutes();
    const offenders: string[] = [];

    for (const file of [...sources(APP), ...sources(COMPONENTS)]) {
      const src = stripComments(readFileSync(file, "utf8"));

      // A file that is itself behind the gate may link freely: anyone rendering
      // it has already passed the same check.
      if (src.includes("aiSearchEnabledFor") && src.includes("notFound()")) continue;

      for (const route of routes) {
        // Only a literal href. A conditional link renders the href inside a
        // ternary, which still matches here — so the second half of the check
        // is that the file resolves the flag at all.
        if (!src.includes(`href="${route}"`)) continue;

        // Threaded a server-resolved flag in? Then the link is conditional and
        // the page is responsible for its own correctness.
        const guarded =
          src.includes("answerTrackingEnabled") || src.includes("aiSearchEnabledFor");
        if (!guarded) offenders.push(`${file.slice(ROOT.length + 1)} → ${route}`);
      }
    }

    expect(offenders, `unconditional links to a route that 404s:\n${offenders.join("\n")}`)
      .toEqual([]);
  });
});

describe("the two empty states that were broken", () => {
  const CF = readFileSync(
    join(COMPONENTS, "seo-tools", "citation-finder-client.tsx"),
    "utf8",
  );
  const SOV = readFileSync(
    join(COMPONENTS, "seo-tools", "share-of-voice-client.tsx"),
    "utf8",
  );

  it.each([
    ["citation finder", CF],
    ["share of voice", SOV],
  ])("%s gates its setup link on the server-resolved flag", (_name, src) => {
    expect(src).toContain("answerTrackingEnabled");
    // The link and the fallback note are the two arms of the same ternary.
    expect(src).toContain("emptyRolloutNote");
  });

  it.each([
    ["citation finder page", join(APP, "visibility", "tools", "citation-finder", "page.tsx")],
    ["share of voice page", join(APP, "visibility", "tools", "share-of-voice", "page.tsx")],
  ])("%s resolves the flag server-side and passes it down", (_name, file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toContain("aiSearchEnabledFor");
    expect(src).toContain("answerTrackingEnabled={answerTrackingEnabled}");
  });
});
