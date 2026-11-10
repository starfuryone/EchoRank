// tests/nosybat-facts.test.ts — the crawler's one source of numbers
// (src/lib/site-crawler/nosybat-facts.ts) and the by-plan table built on it
// (nosybat-plan-table.ts), which /site-crawler, /pricing and the in-app Help
// show.
//
// What this protects:
//   - every true enforcement marker names code that actually enforces it;
//   - no copy source types a number;
//   - a cap changed in plan-config reaches the table;
//   - a gated row hides when its limit is not enforced, and shows when it is;
//   - the AI Visibility plan never gets a crawler feature beyond the free crawl;
//   - the API is never claimed for every plan.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FLAGS } from "@/lib/flags";
import { comparisonTable } from "@/lib/pricing-page/compare";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { planAllowsArea } from "@/lib/plan-access";
import { NOSYBAT_ENFORCED as CLIENT_ENFORCED } from "@/lib/site-crawler/nosybat-enforced";
import { NOSYBAT_ENFORCED, buildNosybatFacts, nbNum, nosybatFacts, type NosybatGated } from "@/lib/site-crawler/nosybat-facts";
import { enterpriseLimits, everythingLabel, freeCrawlOnly, nosybatPlanTable } from "@/lib/site-crawler/nosybat-plan-table";

const ROOT = join(__dirname, "..");
const src = (f: string) => readFileSync(join(ROOT, f), "utf8");
const BASES = ["en", "fr", "de"] as const;

/** Every string literal and template chunk of a source file, comments and ${…} removed. */
function literals(file: string): string[] {
  const code = src(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...code.matchAll(/"([^"\n]*)"|`([^`]*)`/g)].map((m) => (m[1] ?? m[2])!.replace(/\$\{[^}]*\}/g, ""));
}

describe("enforcement markers", () => {
  it("the client copy and the server copy are the same object", () => {
    expect(NOSYBAT_ENFORCED).toBe(CLIENT_ENFORCED);
  });

  // Each marker that is true must point at code that enforces it.
  const ENFORCING: Record<NosybatGated, () => void> = {
    pagesPerMonth: () => {
      expect(src("src/lib/site-crawler/service.ts")).toMatch(/throw new CrawlPageAllowanceError\(/);
      expect(src("src/lib/site-crawler/page-allowance.ts")).toMatch(/export async function pagesUsedThisMonth/);
    },
    crawlsAtOnce: () => {
      const t = src("src/lib/site-crawler/tenant-caps.ts");
      expect(t).toMatch(/export async function claimCrawlSlot/);
      expect(t).toMatch(/pg_advisory_xact_lock/);
    },
    crawlsKept: () => {
      expect(src("src/lib/site-crawler/retention.ts")).toMatch(/crawlsToPurge\(crawls, effectiveCaps\([^)]*\)\.crawlsKept/);
    },
  };
  it.each(Object.keys(ENFORCING) as NosybatGated[])("%s: true only with its enforcement in code", (g) => {
    if (NOSYBAT_ENFORCED[g]) ENFORCING[g]();
  });
});

describe("no typed numbers", () => {
  it.each(["src/lib/site-crawler/nosybat-plan-table.ts", "src/lib/site-crawler/nosybat-enforced.ts"])("%s: no digit in any literal", (file) => {
    for (const l of literals(file)) expect(l, l).not.toMatch(/\d/);
  });
});

describe("the by-plan table", () => {
  const cells = (f = nosybatFacts(), id: string, b: (typeof BASES)[number] = "en") => {
    const r = nosybatPlanTable(f, b).find((x) => x.id === id)!;
    return f.crawlPlans.map((p) => r.cell!(p));
  };

  it("has today's rows, in order, the three gated ones shown because each is enforced", () => {
    expect(nosybatPlanTable(nosybatFacts(), "en").map((r) => r.id)).toEqual(["urls", "crawls", "pages", "at-once", "kept", "rendered", "schedules", "everything"]);
  });

  it("the columns are the self-serve crawl plans: no AI Visibility, no Enterprise", () => {
    expect(nosybatFacts().crawlPlans.map((p) => p.id)).toEqual(["STARTER", "GROWTH", "AGENCY"]);
  });

  it("reads plan-config: a changed cap reaches every row", () => {
    const plans = {
      ...PLAN_CONFIGS,
      STARTER: { ...PLAN_CONFIGS.STARTER, crawlUrlCap: 3_333, crawlPagesPerMonth: 44_444, crawlConcurrency: 7, crawlsKept: 9, crawlRenderedPages: 222 },
    };
    const f = buildNosybatFacts({ plans });
    expect(cells(f, "urls")[0]).toBe("3,333");
    expect(cells(f, "pages")[0]).toBe("44,444");
    expect(cells(f, "at-once")[0]).toBe("7");
    expect(cells(f, "kept")[0]).toBe(`9 newest + ${f.pinnedMax} pinned`);
    expect(cells(f, "rendered")[0]).toBe("222");
    expect(cells(f, "urls", "de")[0]).toBe(nbNum(3_333, "de"));
  });

  it("the live table equals plan-config", () => {
    const f = nosybatFacts();
    expect(cells(f, "urls")).toEqual(f.crawlPlans.map((p) => PLAN_CONFIGS[p.id].crawlUrlCap.toLocaleString("en-US")));
    expect(cells(f, "at-once")).toEqual(f.crawlPlans.map((p) => String(PLAN_CONFIGS[p.id].crawlConcurrency)));
  });

  it.each(["pagesPerMonth", "crawlsAtOnce", "crawlsKept"] as const)("hides the %s row while it is not enforced, shows it when it is", (g) => {
    const id = { pagesPerMonth: "pages", crawlsAtOnce: "at-once", crawlsKept: "kept" }[g];
    const off = buildNosybatFacts({ enforced: { ...NOSYBAT_ENFORCED, [g]: false } });
    const on = buildNosybatFacts({ enforced: { ...NOSYBAT_ENFORCED, [g]: true } });
    for (const b of BASES) {
      expect(nosybatPlanTable(off, b).map((r) => r.id)).not.toContain(id);
      expect(nosybatPlanTable(on, b).map((r) => r.id)).toContain(id);
    }
  });

  it("the schedules row follows its flag", () => {
    expect(nosybatPlanTable(nosybatFacts(), "en", { ...FLAGS, "crawl.schedule": false }).map((r) => r.id)).not.toContain("schedules");
  });

  it("the last row spans every plan: 'Every plan from' the first crawl plan, and names no API", () => {
    const f = nosybatFacts();
    const last = nosybatPlanTable(f, "en").at(-1)!;
    expect(last.all).toBe(`Every plan from ${f.firstPlan.name}`);
    expect(f.everyPlan.api).toBe(false);
    for (const b of BASES) expect(everythingLabel(f, b)).not.toMatch(/API|MCP/);
    // Were every crawl plan to get api_access, the label would say so.
    expect(everythingLabel({ ...f, everyPlan: { ...f.everyPlan, api: true } }, "en")).toMatch(/API & MCP/);
  });

  it("Enterprise is custom limits, never a number", () => {
    for (const b of BASES) expect(enterpriseLimits(b)).not.toMatch(/\d/);
    expect(nosybatFacts().plans.ENTERPRISE.custom).toBe(true);
  });

  it("real copy in every base, de-CH with ss", () => {
    const labels = BASES.map((b) => nosybatPlanTable(nosybatFacts(), b).map((r) => r.label).join("|"));
    expect(new Set(labels).size).toBe(3);
    expect(labels[2]).not.toContain("ß");
  });
});

describe("/pricing's crawler group is the same table", () => {
  const group = (l: "en" | "fr" | "de-CH") => comparisonTable(l).groups.find((g) => g.id === "crawler")!;

  it.each([
    ["en", "en"],
    ["fr", "fr"],
    ["de-CH", "de"],
  ] as const)("%s: the same rows and labels as /site-crawler's", (l, b) => {
    const rows = nosybatPlanTable(nosybatFacts(), b);
    expect(group(l).rows.map((r) => r.id)).toEqual(rows.map((r) => (r.id === "pages" ? "crawl-pages" : r.id)));
    // French: the page's own thousands space, not fr-CA's narrow one.
    expect(group(l).rows.map((r) => r.label)).toEqual(rows.map((r) => r.label.replace(/ /g, " ")));
  });

  it("the AI Visibility plan: the free crawl only, nothing more, on every locale", () => {
    const f = nosybatFacts();
    expect(planAllowsArea("AI_VISIBILITY", "crawler")).toBe(false);
    for (const [l, b] of [["en", "en"], ["fr", "fr"], ["de-CH", "de"]] as const) {
      const cells = group(l).rows.map((r) => r.plans.AI_VISIBILITY!);
      expect(cells[0]).toMatchObject({ kind: "text", text: freeCrawlOnly(f, b).replace(/ /g, " ") });
      for (const c of cells.slice(1)) expect(c.kind).toBe("no");
    }
  });
});
