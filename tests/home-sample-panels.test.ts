// tests/home-sample-panels.test.ts
//
// Every invented number on the homepage sits in a panel marked
// data-sample="true" with an "Illustrative example" caption; real numbers come
// only from src/lib/home-stats.ts and render only when filled. Plus the mobile
// rules for the two new blocks (there is no browser layout suite in this repo,
// so the breakpoints are asserted on the stylesheet).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_STATS, filledHomeStats, type HomeStats } from "@/lib/home-stats";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const HOME = src("src/app/[locale]/HomeClient.tsx");
const CSS = src("src/app/[locale]/home2.module.css");

describe("illustrative panels are marked and captioned", () => {
  // hero score card, the four product frames (one JSX node rendered 4x),
  // trajectory, simulator, recommendation history, roadmap.
  const PANELS = ["s.dash", "s.frame", "s.timeline", "s.sim", "s.hist", "s.roadmap"];

  it.each(PANELS)("%s carries data-sample", (cls) => {
    expect(HOME).toMatch(new RegExp(`className=\\{${cls.replace(".", "\\.")}\\}[^>]*data-sample="true"`));
  });

  it("has one caption per panel", () => {
    expect(HOME.match(/<SampleCaption text=\{t\.sample\.caption\} \/>/g)).toHaveLength(PANELS.length);
  });

  it("captions in English and French", () => {
    expect(HOME).toContain('caption: "Illustrative example"');
    expect(HOME).toContain('caption: "Exemple illustratif"');
  });

  it("the invented business still only appears inside sample copy", () => {
    // Acme / ProFlow / City Drain are the mock's cast. They live in the copy
    // table and in the hero card, which is marked.
    const hero = HOME.slice(HOME.indexOf("<div className={s.dash}"), HOME.indexOf("</header>"));
    expect(hero).toContain('data-sample="true"');
    expect(hero).toContain("ProFlow Services");
  });
});

describe("real numbers render only where they exist", () => {
  it("ships the owner readability score with its date", () => {
    expect(HOME_STATS.ownerReadability.value).toBe(98);
    expect(HOME_STATS.ownerReadability.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filledHomeStats()).toEqual(["ownerReadability"]);
  });

  it("drops a slot with no value, no date, or (for findings) no label", () => {
    const empty: HomeStats = {
      ownerReadability: { value: null, asOf: null, source: "" },
      freeAuditsRun: { value: 12, asOf: null, source: "" },
      echopilotFindings: { value: 41, asOf: "2026-11-01", label: null, href: "", source: "" },
    };
    expect(filledHomeStats(empty)).toEqual([]);
    const full: HomeStats = {
      ...empty,
      freeAuditsRun: { value: 1200, asOf: "2026-11-01", source: "" },
      echopilotFindings: { ...empty.echopilotFindings, label: { en: "x", fr: "y" } },
    };
    expect(filledHomeStats(full)).toEqual(["freeAuditsRun", "echopilotFindings"]);
  });

  it("the strip is not itself marked as a sample", () => {
    const strip = HOME.slice(HOME.indexOf("function HomeStatsStrip"), HOME.indexOf("/* ---------- copy"));
    expect(strip).not.toContain("data-sample");
    expect(strip).toContain("if (keys.length === 0) return null;");
  });
});

describe("mobile layout for the changed home sections", () => {
  it("collapses the stats strip to one column and left-aligns captions at phone width", () => {
    const rule = /@media\(max-width:560px\)\{\.homeStatsRow\{grid-template-columns:1fr\}\.sampleCaption\{text-align:left\}\}/;
    expect(CSS).toMatch(rule);
  });

  it("lets the strip wrap on its own above that (auto-fit, no fixed column count)", () => {
    expect(CSS).toMatch(/\.homeStatsRow\{[^}]*repeat\(auto-fit,minmax\(180px,1fr\)\)/);
  });
});
