// AI-tracking claims on public pages match config (ECHORANK-AI-VISIBILITY-
// PAGES.md Phase 3, 2026-11-10). The sweep removed "six engines … Microsoft
// Copilot", "four engines", "ChatGPT, Perplexity and Google AI every day",
// "weekly" for plans that check daily and "10 prompts × 2 engines × weekly";
// these tests fail the build if a sentence and the config come apart again.
//
// Where copy cannot read config (static HTML payloads, the client homepage's
// sentences), the sentence names only what config guarantees and this file
// checks the guarantee.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/en", useRouter: () => ({ push: () => {} }), useSearchParams: () => new URLSearchParams() }));

import HomeClient from "@/app/[locale]/HomeClient";
import { HOME_PRICING_CHROME, HOME_TOOLS } from "@/lib/i18n/content";
import { engineNames } from "@/lib/pricing-page/headlines";
import { PLAN_CONFIGS, WATCHER_PRICES_CENTS, WATCHER_SOLO } from "@/lib/plan-config";
import { SNAPSHOT_COPY, trackHref } from "@/lib/snapshot/copy";
import { PROMPT_COUNT } from "@/lib/snapshot/prompts";
import { SNAPSHOT_ENGINES } from "@/lib/snapshot/types";
import { fitsTracking, parseTrackParam, CHECKUPS_PER_WEEK } from "@/lib/snapshot/tracking";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const SELF_SERVE = ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"] as const;

/** Public surfaces that make AI-tracking claims. */
const SURFACES = [
  "src/app/[locale]/faq-data.ts",
  "src/lib/i18n/content.ts",
  "src/app/[locale]/HomeClient.tsx",
  "src/app/[locale]/technical-geo/landing-html.ts",
  "src/app/[locale]/live-monitoring/page.tsx",
  "src/app/[locale]/guide/page.tsx",
  "src/app/[locale]/ai-assistant/page.tsx",
  "src/app/[locale]/blog/_shared/copy.ts",
  "src/lib/snapshot/copy.ts",
  "src/lib/ai-visibility-landing/copy.ts",
  "src/lib/free-audit/copy.ts",
];

describe("engines", () => {
  it("no public surface claims an engine nothing queries, or a count it cannot back", () => {
    for (const f of SURFACES) {
      const src = read(f);
      expect(src, f).not.toMatch(/Copilot/);
      expect(src, f).not.toMatch(/six (AI )?engines|six moteurs|sechs Engines|four engines|quatre moteurs|vier Engines|MONITORING 6|6 MOTEURS|across 6 engines|sur 6 moteurs|\/6 (engines|moteurs)/i);
      // The tracking claim ("runs against … every day"), not the descriptive
      // "customers ask ChatGPT, Perplexity and Google AI…".
      expect(src, f).not.toMatch(/(against|sur|gegen) ChatGPT, Perplexity (and|et|und) Google AI/);
    }
  });

  it("the engines the copy says every plan tracks are the head of the registry for the cheapest plan", () => {
    // "Every plan tracks ChatGPT and Google AI Overviews" (faq-data, content.ts, the cards, live-monitoring, the guide).
    const cheapest = engineNames(PLAN_CONFIGS.AI_VISIBILITY.aiCheckup)!;
    expect(cheapest.slice(0, 2)).toEqual(["ChatGPT", "Google AI Overviews"]);
    // technical-geo's FAQ: "Every plan tracks ChatGPT, Google AI Overviews and Gemini; higher plans add Claude".
    expect(cheapest).toEqual(["ChatGPT", "Google AI Overviews", "Gemini"]);
    expect(engineNames(PLAN_CONFIGS.STARTER.aiCheckup)).toContain("Claude");
    expect(read("src/app/[locale]/technical-geo/landing-html.ts")).toContain("Every plan tracks ChatGPT, Google AI Overviews and Gemini; higher plans add Claude");
  });

  it("the homepage names only the engines it is given, and counts them", () => {
    const html = renderToStaticMarkup(
      createElement(HomeClient, {
        locale: "en",
        pricing: [],
        priceChrome: HOME_PRICING_CHROME.en,
        toolCountLine: "",
        toolsSection: null,
        crawlersSection: null,
        playerLabels: HOME_TOOLS.en.player,
        trackedEngines: ["ChatGPT", "Google AI Overviews", "Gemini"],
      }),
    );
    expect(html).toContain("LIVE — MONITORING 3 AI ENGINES");
    expect(html).not.toMatch(/Copilot|Perplexity<\/span>/);
    expect(read("src/app/[locale]/page.tsx")).toContain("trackedEngines={allLiveEngineNames()}");
  });
});

describe("cadence", () => {
  it("every self-serve plan checks daily, so 'daily' / 'every day' claims hold", () => {
    for (const p of SELF_SERVE) expect(PLAN_CONFIGS[p].aiCheckup.frequency, p).toBe("daily");
    expect(read("src/app/[locale]/blog/_shared/copy.ts")).toContain("daily on every plan");
    expect(read("src/app/[locale]/faq-data.ts")).toContain("answers are tracked daily");
  });

  it("the AI Visibility Check's upsell is its own prompts and engines at the plan's cadence, and the plan covers it", () => {
    const en = SNAPSHOT_COPY.en.upsell;
    expect(en.cta).toBe(`Track these ${PROMPT_COUNT} prompts daily`);
    expect(en.planLine).toBe(`${PROMPT_COUNT} prompts × ${SNAPSHOT_ENGINES.length} engines × daily`);
    expect(SNAPSHOT_COPY.fr.upsell.cta).toBe(`Suivre ces ${PROMPT_COUNT} questions chaque jour`);
    const want = parseTrackParam(new URL(`https://x${trackHref("en")}`).searchParams.get("track"));
    expect(want).toEqual({ prompts: PROMPT_COUNT, engines: SNAPSHOT_ENGINES.length, perWeek: CHECKUPS_PER_WEEK.daily });
    const av = PLAN_CONFIGS.AI_VISIBILITY.aiCheckup;
    expect(fitsTracking({ prompts: av.prompts, providers: av.providers, perWeek: CHECKUPS_PER_WEEK[av.frequency] }, want!)).toBe(true);
  });

  it("the AI Search Watcher pages (static) state the Watcher's own config: weekly, its prompts, its runs, its price", () => {
    expect(WATCHER_SOLO.frequency).toBe("weekly");
    const page = read("src/app/[locale]/setup-ai-search-tracking/landing-html.ts");
    expect(page).toContain(`up to ${WATCHER_SOLO.prompts} tracked prompts`);
    expect(page).toContain(`Weekly checkups, ${WATCHER_SOLO.repetitions} runs per prompt`);
    expect(page).toContain(`$${WATCHER_PRICES_CENTS.monthly / 100}<small>/mo</small>`);
    expect(page).toContain(`$${WATCHER_PRICES_CENTS.annual / 100}/yr`);
    expect(read("src/app/[locale]/PublicNav.tsx")).toContain(`One brand, watched weekly. $${WATCHER_PRICES_CENTS.monthly / 100}/mo.`);
  });
});
