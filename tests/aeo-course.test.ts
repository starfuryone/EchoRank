// The Echorank AEO course — config integrity (src/lib/aeo-course.ts).
//
// The config is the single source for the hub, the twelve lessons, the
// worksheet, the print view, the JSON-LD and the sitemap, so its shape is
// asserted here: 5 modules, 12 lessons, a table and a resolvable graphic per
// lesson, three single-answer questions, a practice task, 700–1,100 words, and
// the course's copy rules (no camel-case brand, no competitor, no statistic,
// no borrowed course material). Routes, JSON-LD and HTML:
// tests/aeo-course-pages.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AEO_COPY,
  AEO_COURSE,
  AEO_LESSONS,
  AEO_MODULES,
  AEO_PLAN,
  AEO_PROGRESS_KEY,
  MRCA_STAGES,
  aeoInternalHrefs,
  aeoNeighbours,
  lessonMinutes,
  lessonWordCount,
} from "@/lib/aeo-course";
import { AEO_ALL, AEO_LESSON_SLUGS, AEO_WORKSHEET } from "@/lib/aeo-course-routes";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { isSeoToolLive } from "@/lib/seo-tools";
import { AEO_ANIMATIONS, AEO_GRAPHICS } from "@/components/aeo-course/graphics";
import { lessonMatches } from "@/components/aeo-course/HubLessons";
import { planAsText } from "@/components/aeo-course/Worksheet";

/** The brief's pattern, verbatim. */
const FORBIDDEN = /EchoRank|Ahrefs|Semrush|Profound|Moz\b|transcript|source course|\d+(\.\d+)?\s?%/;

function allStrings(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "function") walk((v as (...a: unknown[]) => unknown)(3, 12));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk([AEO_COURSE, AEO_MODULES, AEO_LESSONS, AEO_PLAN, AEO_COPY, MRCA_STAGES]);
  return out;
}

describe("structure", () => {
  it("has five modules and twelve lessons, in the routes module's order", () => {
    expect(AEO_MODULES.map((m) => m.n)).toEqual([1, 2, 3, 4, 5]);
    expect(AEO_LESSONS.map((l) => l.slug)).toEqual([...AEO_LESSON_SLUGS]);
    expect(new Set(AEO_LESSON_SLUGS).size).toBe(12);
    for (const m of AEO_MODULES) expect(AEO_LESSONS.filter((l) => l.module === m.n).length, `module ${m.n}`).toBeGreaterThan(0);
    // Modules run in order through the course.
    expect(AEO_LESSONS.map((l) => l.module)).toEqual([...AEO_LESSONS.map((l) => l.module)].sort());
  });

  it("gives every lesson a table, a resolvable graphic, three objectives and three takeaways", () => {
    for (const l of AEO_LESSONS) {
      const tables = l.body.filter((b) => b.k === "table");
      const graphics = l.body.filter((b) => b.k === "graphic");
      expect(tables.length, l.slug).toBeGreaterThanOrEqual(1);
      expect(graphics.length, l.slug).toBeGreaterThanOrEqual(1);
      for (const g of graphics) if (g.k === "graphic") expect(AEO_GRAPHICS[g.id], `${l.slug}: ${g.id}`).toBeTypeOf("function");
      for (const t of tables) if (t.k === "table") {
        expect(t.caption.length, l.slug).toBeGreaterThan(0);
        for (const r of t.rows) expect(r.length, `${l.slug}: ${t.caption}`).toBe(t.head.length);
      }
      expect(l.objectives, l.slug).toHaveLength(3);
      expect(l.takeaways, l.slug).toHaveLength(3);
      expect(l.produces.length, l.slug).toBeGreaterThan(0);
    }
  });

  it("uses each graphic once, and every graphic has an animation described", () => {
    const ids = AEO_LESSONS.flatMap((l) => l.body.flatMap((b) => (b.k === "graphic" ? [b.id] : [])));
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(AEO_GRAPHICS).sort()).toEqual([...ids].sort());
    expect(Object.keys(AEO_ANIMATIONS).sort()).toEqual([...ids].sort());
  });

  it("writes 700 to 1,100 words per lesson and computes minutes from them", () => {
    for (const l of AEO_LESSONS) {
      const n = lessonWordCount(l);
      expect(n, `${l.slug}: ${n} words`).toBeGreaterThanOrEqual(700);
      expect(n, `${l.slug}: ${n} words`).toBeLessThanOrEqual(1100);
      expect(lessonMinutes(l)).toBe(Math.ceil(lessonMinutes(l)));
      expect(lessonMinutes(l)).toBeGreaterThanOrEqual(Math.ceil(n / 200));
    }
  });

  it("asks three questions per lesson, each with exactly one correct answer", () => {
    for (const l of AEO_LESSONS) {
      expect(l.quiz, l.slug).toHaveLength(3);
      for (const q of l.quiz) {
        expect(q.options.length, q.q).toBeGreaterThanOrEqual(3);
        expect(new Set(q.options).size, q.q).toBe(q.options.length);
        expect(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length, q.q).toBe(true);
        expect(q.explain.length, q.q).toBeGreaterThan(0);
      }
    }
  });

  it("gives every lesson a practice task that fills a worksheet section", () => {
    const sections = new Set(AEO_PLAN.map((s) => s.section));
    expect([...sections].sort()).toEqual(["baseline", "engines", "evidence", "program", "site", "summary"]);
    for (const l of AEO_LESSONS) {
      expect(l.practice.steps.length, l.slug).toBeGreaterThanOrEqual(2);
      expect(sections.has(l.practice.section), l.slug).toBe(true);
    }
    // The modules' sections each get at least one task.
    for (const s of sections) expect(AEO_LESSONS.some((l) => l.practice.section === s), s).toBe(true);
  });

  it("chains prev/next through all twelve lessons", () => {
    expect(aeoNeighbours(AEO_LESSONS[0].slug).prev).toBeUndefined();
    expect(aeoNeighbours(AEO_LESSONS[11].slug).next).toBeUndefined();
    for (let i = 0; i < 11; i++) {
      expect(aeoNeighbours(AEO_LESSONS[i].slug).next?.slug).toBe(AEO_LESSONS[i + 1].slug);
      expect(aeoNeighbours(AEO_LESSONS[i + 1].slug).prev?.slug).toBe(AEO_LESSONS[i].slug);
    }
  });

  it("keeps the MRCA model in its order", () => {
    expect(MRCA_STAGES.map((s) => s.name)).toEqual(["Mentioned", "Recommended", "Cited", "Accurate"]);
  });
});

describe("copy rules", () => {
  it("contains no camel-case brand, competitor, borrowed course material or percentage", () => {
    const strings = allStrings();
    expect(strings.length).toBeGreaterThan(600);
    for (const s of strings) {
      expect(s).not.toMatch(FORBIDDEN);
      // The competitors in any casing (the brand check above must stay case-sensitive).
      expect(s).not.toMatch(/\b(ahrefs|semrush|profound|moz|similarweb|brightedge|conductor)\b/i);
    }
  });

  it("keeps metaDescriptions to 165 characters and unique", () => {
    const metas = [AEO_COURSE.metaDescription, ...AEO_LESSONS.map((l) => l.metaDescription)];
    for (const m of metas) expect(m.length, m).toBeLessThanOrEqual(165);
    expect(new Set(metas).size).toBe(metas.length);
  });

  it("works one example per lesson, with the course's fictional brands", () => {
    for (const l of AEO_LESSONS) {
      const text = JSON.stringify(l.body);
      expect(text, l.slug).toMatch(/Northwind Dental|Northwind|Lumen CRM|Lumen/);
      expect(l.body.some((b) => b.k === "h2" && /^Worked example/.test(b.t)), l.slug).toBe(true);
    }
  });

  it("separates fact, recommendation and the unproven in every lesson", () => {
    for (const l of AEO_LESSONS) {
      const tones = new Set(l.body.flatMap((b) => (b.k === "callout" ? [b.tone] : [])));
      expect(tones.has("recommendation"), l.slug).toBe(true);
      expect(tones.has("unproven"), l.slug).toBe(true);
      expect(tones.has("fact"), l.slug).toBe(true);
    }
    // llms.txt is marked unproven where it is taught.
    const crawler = AEO_LESSONS.find((l) => l.slug === "crawler-access")!;
    expect(crawler.body.some((b) => b.k === "callout" && b.tone === "unproven" && /llms\.txt/.test(b.t))).toBe(true);
  });

  it("never promises a ranking, a citation or revenue", () => {
    // Promises only: "it does not guarantee a mention" is the course doing its job.
    for (const s of allStrings()) {
      expect(s).not.toMatch(/\b(we|echorank|this course) (guarantee|promise)s?\b/i);
      expect(s).not.toMatch(/\bguaranteed (rankings?|citations?|mentions?|results|revenue)\b/i);
      expect(s).not.toMatch(/\bwill (rank|be cited|be recommended) (first|#1|number one)\b/i);
    }
    // And the course says out loud that it cannot promise one.
    expect(JSON.stringify(AEO_LESSONS[0].body)).toMatch(/does not guarantee a mention, a ranking or a citation/);
  });

  it("puts no price in lesson copy", () => {
    for (const l of AEO_LESSONS) expect(JSON.stringify(l), l.slug).not.toMatch(/\$\s?\d+\s?\/\s?mo|per month|\/mo\b/i);
  });
});

describe("tool tie-ins and links", () => {
  it("names only LIVE tools, linked to public pages, never the app", () => {
    for (const l of AEO_LESSONS) {
      const t = l.tool;
      if (t.kind === "seo") expect(isSeoToolLive(t.tool), `${l.slug}: ${t.tool}`).toBe(true);
      if (t.kind === "external") expect(t.href).toMatch(/^https:\/\/[a-z0-9.-]+\.echorank360\.com\//);
      else expect(t.href.startsWith("/visibility") || t.href.startsWith("/dashboard") || t.href.startsWith("/register")).toBe(false);
    }
    // The tie-ins dropped as not LIVE stay dropped.
    expect(AEO_LESSONS.some((l) => l.tool.kind === "seo" && ["gsc_insights", "gbp_monitor", "report_builder"].includes(l.tool.tool))).toBe(false);
  });

  it("resolves every internal href in the config to a registered route", () => {
    const registered = new Set(LOCALIZED_ROUTES.map((r) => r.path));
    // The two noindex utility pages are real routes kept out of the sitemap on purpose.
    const utility = new Set([AEO_WORKSHEET, AEO_ALL]);
    for (const href of aeoInternalHrefs()) {
      expect(registered.has(href) || utility.has(href), href).toBe(true);
    }
    expect(aeoInternalHrefs()).toContain("/prompt-guides");
  });
});

describe("browser state", () => {
  it("keeps progress under the documented key", () => {
    expect(AEO_PROGRESS_KEY).toBe("echorank.aeo.progress.v1");
  });

  it("copies the worksheet as text in page order, with blanks marked", () => {
    const sections = AEO_PLAN.map((s) => ({ section: s.section, title: s.title, fields: s.fields }));
    const text = planAsText(sections, { "summary.goal": "Be recommended for family dentistry near Riverside" }, "Your AEO plan");
    expect(text.startsWith("Your AEO plan\n")).toBe(true);
    expect(text).toContain("SUMMARY\nOur one-line AEO goal:\nBe recommended for family dentistry near Riverside");
    expect(text).toContain("Top three priorities this quarter:\n—");
    expect(text.indexOf("SUMMARY")).toBeLessThan(text.indexOf("RUNNING THE PROGRAM"));
  });

  it("filters hub lessons on title, summary and objectives", () => {
    const l = { title: "Crawler access", summary: "Decide which AI crawlers may read your site", keywords: "robots.txt user agents" };
    expect(lessonMatches(l, "")).toBe(true);
    expect(lessonMatches(l, "ROBOTS")).toBe(true);
    expect(lessonMatches(l, "crawlers")).toBe(true);
    expect(lessonMatches(l, "reviews")).toBe(false);
  });
});

describe("the CSS module", () => {
  const css = readFileSync(join(process.cwd(), "src/components/aeo-course/aeo.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("keeps every selector pure (Turbopack requires a local class in each)", () => {
    const preludes = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((p) => !p.startsWith("@") && !/^(from|to|\d+%(,\d+%)*)$/.test(p));
    expect(preludes.length).toBeGreaterThan(100);
    for (const p of preludes) for (const sel of p.split(",")) expect(sel.trim(), sel).toMatch(/[.#][A-Za-z]/);
  });

  it("switches every animation off under reduced motion, and never loops forever", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\s*\.motion\[data-motion\] \*\{animation:none !important\}/);
    expect(css).not.toMatch(/infinite/);
    // Only transform, opacity and stroke-dashoffset are animated.
    for (const kf of css.matchAll(/@keyframes [\w-]+\{([\s\S]*?)\}\}/g)) {
      for (const prop of kf[1].matchAll(/([a-z-]+):/g)) expect(["transform", "opacity", "stroke-dashoffset"], kf[0].slice(0, 40)).toContain(prop[1]);
    }
  });
});
