// Industry prompt setup guides — config integrity (src/lib/prompt-guides.ts).
//
// The config is the single source for the hub, the ten guides, their charts
// and tables, the JSON-LD and the sitemap, so the structure the pages rely on
// is asserted here once: 10 guides × 12 prompts × 4 research questions × 6 tag
// rows, the use totals the hub's totals row prints, and the copy rules (brand
// casing, no package domain, no competitor, no "GEO Checker").
// Routes, JSON-LD and rendered HTML: tests/prompt-guides-pages.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FIX_BUILD,
  GUIDE_COPY,
  GUIDE_FAQ,
  GUIDE_SECTIONS,
  HUB_COPY,
  MEASUREMENT_PRINCIPLES,
  MEASUREMENT_STAGES,
  METHOD_STEPS,
  PROMPT_GUIDES,
  PROMPT_GUIDES_UPDATED_AT,
  PROMPT_GUIDE_ICONS,
  PROMPT_MODES,
  PROMPT_ROLES,
  PROMPT_USES,
  ROLLOUT_PLAN,
  SCORECARD,
  guideBySlug,
  guideNeighbours,
  relatedGuides,
  totalPrompts,
  updatedLabel,
  countsByUse,
  totalsByUse,
} from "@/lib/prompt-guides";
import { PROMPT_GUIDE_SLUGS } from "@/lib/prompt-guide-routes";
import { INK, USE_STYLES } from "@/components/prompt-guides/use-colors";
import { matchesQuery } from "@/components/prompt-guides/GuideFilter";

const SLUGS = [
  "automotive",
  "b2b-software",
  "consumer-packaged-goods",
  "financial-services",
  "healthcare",
  "pharma-life-sciences",
  "publishing-media",
  "retail",
  "telecom",
  "travel-hospitality",
];

/** Every string the config can produce, functions called with sample arguments. */
function allStrings(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "function") walk((v as (...a: unknown[]) => unknown)("[sector]", 12));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk([PROMPT_GUIDES, GUIDE_COPY, HUB_COPY, GUIDE_SECTIONS, PROMPT_ROLES, SCORECARD, ROLLOUT_PLAN, FIX_BUILD, GUIDE_FAQ, METHOD_STEPS, PROMPT_MODES, MEASUREMENT_PRINCIPLES, MEASUREMENT_STAGES]);
  return out;
}

const words = (s: string) => s.trim().split(/\s+/).length;

describe("structure", () => {
  it("has the ten guides, in order, with unique slugs that match the edge-safe route module", () => {
    expect(PROMPT_GUIDES.map((g) => g.slug)).toEqual(SLUGS);
    expect([...PROMPT_GUIDE_SLUGS]).toEqual(SLUGS);
    expect(new Set(SLUGS).size).toBe(SLUGS.length);
  });

  it("gives every guide 12 prompts, 4 research questions, 6 tag rows and 4 actions", () => {
    for (const g of PROMPT_GUIDES) {
      expect(g.prompts, g.slug).toHaveLength(12);
      expect(g.researchQuestions, g.slug).toHaveLength(4);
      expect(g.tags, g.slug).toHaveLength(6);
      expect(g.actions, g.slug).toHaveLength(4);
      for (const t of g.tags) expect(t.labels.length, `${g.slug} ${t.dimension}`).toBeGreaterThan(0);
      expect(new Set(g.prompts.map((p) => p.topic)).size, `${g.slug}: topics are row keys`).toBe(12);
    }
  });

  it("keeps the ten sections of the package, in order", () => {
    expect(GUIDE_SECTIONS.map((s) => s.id)).toEqual(["strategy", "topics", "refinement", "categories", "tags", "measurement", "actions", "research", "plan", "faq"]);
  });

  it("sums the uses to 41 / 32 / 11 / 5 / 10 / 14 / 7 = 120", () => {
    expect([...PROMPT_USES]).toEqual(["Discovery", "Education", "Evaluation", "Comparison", "Validation", "Fact check", "Local"]);
    const totals = totalsByUse();
    expect(PROMPT_USES.map((u) => totals[u])).toEqual([41, 32, 11, 5, 10, 14, 7]);
    expect(totalPrompts()).toBe(120);
    // The per-guide counts add up to the same totals the hub's totals row prints.
    for (const u of PROMPT_USES) expect(PROMPT_GUIDES.reduce((n, g) => n + countsByUse(g)[u], 0)).toBe(totals[u]);
    for (const g of PROMPT_GUIDES) expect(PROMPT_USES.reduce((n, u) => n + countsByUse(g)[u], 0)).toBe(12);
  });

  it("uses only the closed set of uses", () => {
    const allowed = new Set<string>(PROMPT_USES);
    for (const g of PROMPT_GUIDES) for (const p of g.prompts) expect(allowed.has(p.use), `${g.slug}: ${p.use}`).toBe(true);
  });

  it("gives every guide an icon from the typed map", () => {
    for (const g of PROMPT_GUIDES) expect(PROMPT_GUIDE_ICONS[g.icon]?.length, g.slug).toBeGreaterThan(0);
  });
});

describe("links between guides", () => {
  it("points related, prev and next at real guides, never at itself", () => {
    for (const g of PROMPT_GUIDES) {
      const related = relatedGuides(g.slug);
      expect(related, g.slug).toHaveLength(3);
      for (const r of related) {
        expect(guideBySlug(r.slug), r.slug).toBeDefined();
        expect(r.slug).not.toBe(g.slug);
      }
      const { prev, next } = guideNeighbours(g.slug);
      for (const x of [prev, next]) if (x) expect(guideBySlug(x.slug)).toBeDefined();
    }
    expect(guideNeighbours(SLUGS[0]).prev).toBeUndefined();
    expect(guideNeighbours(SLUGS[SLUGS.length - 1]).next).toBeUndefined();
    expect(guideBySlug("nope")).toBeUndefined();
  });
});

describe("copy rules", () => {
  it("contains no camel-case brand, package domain, competitor or GEO Checker anywhere", () => {
    const strings = allStrings();
    expect(strings.length).toBeGreaterThan(400);
    for (const s of strings) {
      // The spec's pattern, case-sensitive: "Echorank" is the brand, "EchoRank" is banned.
      expect(s).not.toMatch(/EchoRank|echorank\.com|tryprofound|GEO Checker/);
      // And the same names in any casing, where casing cannot make them legitimate.
      expect(s).not.toMatch(/echorank\.com|tryprofound|\bprofound\b|geo checker/i);
    }
  });

  it("keeps every metaDescription to 165 characters with the right article", () => {
    for (const g of PROMPT_GUIDES) {
      expect(g.metaDescription.length, g.slug).toBeLessThanOrEqual(165);
      expect(g.metaDescription, g.slug).not.toMatch(/\ban (?![aeiou])/i);
      expect(g.metaDescription, g.slug).not.toMatch(/\ba (?=[aeiou])/i);
      expect(g.metaDescription).not.toMatch(/&amp;/);
    }
    expect(HUB_COPY.metaDescription(PROMPT_GUIDES.length).length).toBeLessThanOrEqual(165);
  });

  it("keeps the synthetic-example disclaimers", () => {
    expect(GUIDE_COPY.topics.introAfter).toMatch(/not as observed user-search-volume data/);
    expect(GUIDE_COPY.refinement.note).toMatch(/synthetic example/);
    expect(GUIDE_COPY.research.introAfter).toMatch(/not evidence that Echorank has automatically performed/);
  });

  it("states no number on the funnel and no percentage anywhere in the scorecard copy", () => {
    for (const s of MEASUREMENT_STAGES) expect(s).not.toMatch(/\d/);
    for (const r of SCORECARD) expect(`${r.definition} ${r.note}`).not.toMatch(/%|\d/);
  });

  it("sources the Updated chip from one date", () => {
    expect(PROMPT_GUIDES_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(updatedLabel()).toBe("Updated November 2026");
  });
});

describe("condensations written for the hub and the guide tables", () => {
  it("keeps safeguardShort and cadenceShort to 12 words", () => {
    for (const g of PROMPT_GUIDES) {
      expect(words(g.safeguardShort), `${g.slug}: ${g.safeguardShort}`).toBeLessThanOrEqual(12);
      expect(words(g.cadenceShort), `${g.slug}: ${g.cadenceShort}`).toBeLessThanOrEqual(12);
    }
  });

  it("keeps every Why it matters to 10 words, against the package's own lists", () => {
    expect(FIX_BUILD.filter((r) => r.priority === "Fix now")).toHaveLength(3);
    expect(FIX_BUILD.filter((r) => r.priority === "Build next")).toHaveLength(3);
    for (const r of FIX_BUILD) expect(words(r.why), r.why).toBeLessThanOrEqual(10);
  });

  it("splits sourceOfTruth into rows taken from the sentence itself, in order", () => {
    for (const g of PROMPT_GUIDES) {
      expect(g.sourceRows.length, g.slug).toBeGreaterThanOrEqual(4);
      let at = 0;
      for (const r of g.sourceRows) {
        const i = g.sourceOfTruth.toLowerCase().indexOf(r.source.toLowerCase(), at);
        expect(i, `${g.slug}: "${r.source}"`).toBeGreaterThanOrEqual(0);
        at = i + r.source.length;
        expect(words(r.claim), r.claim).toBeLessThanOrEqual(4);
      }
      // Nothing left over: every source in the sentence has a row.
      const listed = g.sourceRows.map((r) => r.source.toLowerCase()).join(", ");
      const sentence = g.sourceOfTruth.toLowerCase().replace(/\.$/, "").replace(/ and (?=[^,]*$)/, ", ");
      expect(sentence, g.slug).toBe(listed);
    }
  });
});

describe("the use colour map", () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };

  it("covers the seven uses with distinct fills and distinct patterns", () => {
    expect(Object.keys(USE_STYLES).sort()).toEqual([...PROMPT_USES].sort());
    expect(new Set(Object.values(USE_STYLES).map((s) => s.fill)).size).toBe(7);
    expect(new Set(Object.values(USE_STYLES).map((s) => s.pattern)).size).toBe(7);
  });

  it("reads on #181A20 (≥ 3:1) and carries #181A20 count text (≥ 4.5:1)", () => {
    expect(INK).toBe("#181A20");
    for (const [use, { fill }] of Object.entries(USE_STYLES)) {
      expect(contrast(fill, "#181A20"), `${use} ${fill}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("drops the package's teal and mint", () => {
    for (const { fill } of Object.values(USE_STYLES)) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));
      // teal / mint: green and blue both high, red low
      expect(r < 90 && g > 150 && b > 120 && Math.abs(g - b) < 60, fill).toBe(false);
    }
  });
});

describe("the CSS module", () => {
  it("keeps every selector pure (a local class in each), which Turbopack requires and vitest does not check", () => {
    // A bare `a{}` in the print block built fine under vitest and failed
    // `next build` — the one check that bundles. This holds the rule here.
    const css = readFileSync(join(process.cwd(), "src/components/prompt-guides/prompt-guides.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const preludes = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((p) => !p.startsWith("@"));
    expect(preludes.length).toBeGreaterThan(50);
    for (const p of preludes) for (const sel of p.split(",")) expect(sel.trim(), sel).toMatch(/[.#][A-Za-z]/);
  });
});

describe("the hub filter", () => {
  const auto = { name: "Automotive", description: "Vehicle research, ownership costs", eyebrow: "Mobility & vehicle shopping" };
  it("matches on title, description and eyebrow, case-insensitively", () => {
    expect(matchesQuery(auto, "")).toBe(true);
    expect(matchesQuery(auto, "  ")).toBe(true);
    expect(matchesQuery(auto, "AUTO")).toBe(true);
    expect(matchesQuery(auto, "ownership")).toBe(true);
    expect(matchesQuery(auto, "mobility")).toBe(true);
    expect(matchesQuery(auto, "pharma")).toBe(false);
  });

  it("finds the package's own placeholder examples", () => {
    const hits = (q: string) => PROMPT_GUIDES.filter((g) => matchesQuery({ name: g.name, description: g.cardDescription, eyebrow: g.eyebrow }, q)).length;
    for (const q of ["healthcare", "pricing", "travel", "local"]) expect(hits(q), q).toBeGreaterThan(0);
    expect(hits("zzzz")).toBe(0);
  });
});
