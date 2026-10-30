// tests/tool-counts.test.ts
//
// ONE TOOL COUNT, AND ONLY AVAILABLE TOOLS SOLD AS INCLUDED.
//
// The homepage once said "29 tools · 5 in construction" while /pricing said
// "34+ tools included": two pages, two formulas, one registry. Every count is
// now seoToolCounts() rendered through TOOL_COUNT_LINE, and every "included"
// surface reads seoToolStatus(), so a Google-blocked tool (GSC Insights, Web
// Analytics, GBP Monitor) is "coming" everywhere a buyer can see.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SEO_TOOL_GROUPS,
  isSeoToolLive,
  seoToolCounts,
  seoToolStatus,
} from "@/lib/seo-tools";
import {
  HOME_PRICING_CHROME,
  HOME_TOOLS,
  TOOL_COUNT_LINE,
  toolCountLine,
} from "@/lib/i18n/content";
import { SEO_TOOLS_COPY } from "@/lib/i18n/dashboard";
import { planFeatures } from "@/lib/plan-features";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const ALL = SEO_TOOL_GROUPS.flatMap((g) => g.tools);
const NOT_AVAILABLE = ALL.filter((t) => seoToolStatus(t) !== "available");
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("counts come from the registry", () => {
  it("splits available from coming by status", () => {
    const c = seoToolCounts();
    expect(c.available + c.coming).toBe(ALL.length);
    expect(c.available).toBe(ALL.filter((t) => !t.comingSoon && !t.requiresGoogleApproval).length);
  });

  it("treats Google-blocked tools as not available", () => {
    for (const id of ["gsc_insights", "web_analytics", "gbp_monitor"] as const) {
      expect(isSeoToolLive(id), id).toBe(false);
    }
  });

  it("renders the same sentence in every locale, filled with the same numbers", () => {
    const { available, coming } = seoToolCounts();
    for (const l of SUPPORTED_LOCALES) {
      const line = toolCountLine(l, { available, coming });
      expect(line).toContain(String(available));
      expect(line).toContain(String(coming));
      expect(line).not.toMatch(/\{(available|coming)\}/);
    }
    expect(toolCountLine("en", { available, coming })).toBe(
      `${available} tools available · ${coming} coming`,
    );
    expect(toolCountLine("fr", { available, coming })).toBe(
      `${available} outils disponibles · ${coming} à venir`,
    );
  });
});

describe("no literal tool count remains in copy", () => {
  // Any "<digits> tools" / "<digits>+ outils" in a catalog is a number someone
  // typed and will forget to move.
  const LITERAL = /\b\d+\+?\s*(SEO[- ]?(&|et|und)?\s*)?(AI |IA |KI-)?(tools|outils|Werkzeuge)\b/i;

  it("templates carry placeholders, not numbers", () => {
    for (const l of SUPPORTED_LOCALES) {
      expect(TOOL_COUNT_LINE[l]).not.toMatch(/\d/);
    }
  });

  it("homepage and pricing catalogs hold no typed count", () => {
    for (const l of SUPPORTED_LOCALES) {
      expect(JSON.stringify(HOME_TOOLS[l])).not.toMatch(LITERAL);
      expect(JSON.stringify(HOME_PRICING_CHROME[l])).not.toMatch(LITERAL);
    }
  });

  it("home, /pricing and the in-app hub all print toolCountLine(seoToolCounts())", () => {
    for (const file of [
      "src/app/[locale]/page.tsx",
      "src/app/[locale]/pricing/page.tsx",
      "src/app/[locale]/ClassicSeoTools.tsx",
      "src/app/(dashboard)/visibility/tools/page.tsx",
    ]) {
      const body = src(file);
      expect(body, file).toMatch(/toolCountLine\([^)]*seoToolCounts\(\)\)/);
      expect(body, file).not.toMatch(/liveToolCount/);
    }
    expect(src("src/app/[locale]/PricingSection.tsx")).not.toMatch(/liveToolCount/);
  });
});

describe("only available tools are sold as included", () => {
  // Every catalog name of a tool that is not available today, in en and fr.
  const blockedNames = NOT_AVAILABLE.flatMap((t) => [
    SEO_TOOLS_COPY.en.items[t.id].name,
    SEO_TOOLS_COPY.fr.items[t.id].name,
  ]);

  it("no plan bullet names a tool that is not available", () => {
    for (const plan of ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) {
      for (const l of ["en", "fr"]) {
        const bullets = planFeatures(plan, l).join("\n");
        for (const name of blockedNames) {
          expect(bullets, `${plan}/${l} names ${name}`).not.toContain(name);
        }
        expect(bullets).not.toMatch(/Search Console|Business Profile|Google Analytics/);
      }
    }
  });

  it("the homepage's featured cards do not feature a tool that is not available", () => {
    for (const l of SUPPORTED_LOCALES) {
      for (const card of HOME_TOOLS[l].featured) {
        const text = `${card.k} ${card.h} ${card.p}`;
        expect(text, `${l}: ${card.k}`).not.toMatch(/Search Console|Business Profile|GA4/);
        expect(blockedNames, `${l}: ${card.k}`).not.toContain(card.k);
      }
    }
  });

  it("the homepage grid badges LIVE from status, not from comingSoon alone", () => {
    expect(src("src/app/[locale]/ClassicSeoTools.tsx")).toMatch(
      /seoToolStatus\(tool\) !== "available"/,
    );
  });
});
