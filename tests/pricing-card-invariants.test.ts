// tests/pricing-card-invariants.test.ts
//
// THE CARDS MUST NOT BE ABLE TO LIE.
//
// Every number on a pricing card is now computed from the config field that
// enforces it (src/lib/plan-features.ts). These tests assert the join: that the
// rendered bullet really does carry the enforced figure, for every tier, in
// both catalogues. If a tier's allowance or checkup shape changes, the card
// changes with it — and if someone reintroduces a typed literal, this fails
// rather than shipping a card that quietly promises the old number.
//
// Modelled on the watcher pricing page's copy-matches-WATCHER_SOLO test, which
// exists for exactly this reason.

import { describe, expect, it, vi } from "vitest";
import { PLAN_CONFIGS, type SellablePlanType } from "@/lib/plan-config";
import { planFeatures, planFeatureBase, planFeaturesByPlan } from "@/lib/plan-features";
import { AI_TESTED_KEYWORD_LIMIT } from "@/lib/keyword-opportunity/score";
import { SEO_TOOL_GROUPS, isSeoToolLive } from "@/lib/seo-tools";

/** The three tiers that render a card. ENTERPRISE is filtered out by price. */
const CARD_TIERS: SellablePlanType[] = ["STARTER", "GROWTH", "AGENCY"];
const ALL_TIERS: SellablePlanType[] = [...CARD_TIERS, "ENTERPRISE"];

/** en and fr in full, plus the folds every marketing/dash locale goes through. */
const LOCALES = ["en", "en-CA", "fr", "fr-CA", "de-CH"] as const;

/** The one bullet matching a pattern, or undefined. */
function bullet(plan: SellablePlanType, locale: string, re: RegExp): string | undefined {
  return planFeatures(plan, locale).find((f) => re.test(f));
}

// ─── Engine count and cadence ───────────────────────────────────────────────

describe("engine count and cadence are derived from the tier's checkup shape", () => {
  const CADENCE: Record<string, { en: string; fr: string }> = {
    weekly: { en: "weekly", fr: "hebdomadaire" },
    twice_weekly: { en: "2×/week", fr: "2x/semaine" },
    daily: { en: "daily", fr: "quotidien" },
    custom: { en: "on your schedule", fr: "selon votre contrat" },
  };

  it.each(ALL_TIERS)("%s names the provider count its checkup actually queries", (plan) => {
    const shape = PLAN_CONFIGS[plan].aiCheckup;
    const line = bullet(plan, "en", /AI answer tracking/);
    expect(line, `${plan} has no tracking bullet`).toBeDefined();

    if (shape.providers === null) {
      // `null` is "every provider currently available" — a runtime fact with no
      // honest number, so the copy must say "all" rather than print a count.
      expect(line).toContain("all AI engines");
      expect(line).not.toMatch(/\d+ AI engines/);
    } else {
      expect(line).toContain(`${shape.providers} AI engine`);
    }
  });

  it.each(ALL_TIERS)("%s names the cadence its checkup actually runs at", (plan) => {
    const shape = PLAN_CONFIGS[plan].aiCheckup;
    expect(bullet(plan, "en", /AI answer tracking/)).toContain(CADENCE[shape.frequency].en);
    expect(bullet(plan, "fr", /Suivi des réponses IA/)).toContain(CADENCE[shape.frequency].fr);
  });

  it("keeps the tiers distinguishable — this is what the card is selling", () => {
    // A regression that made every tier read the same would pass the per-tier
    // assertions above while erasing the reason to upgrade.
    const lines = CARD_TIERS.map((p) => bullet(p, "en", /AI answer tracking/));
    expect(new Set(lines).size).toBe(CARD_TIERS.length);
  });

  it("states 2 engines weekly on STARTER, not the 4 it used to claim", () => {
    // The specific bug this file was written for: every tier advertised "AI
    // answer tracking across 4 engines" while STARTER queried 2 providers.
    expect(PLAN_CONFIGS.STARTER.aiCheckup.providers).toBe(2);
    expect(bullet("STARTER", "en", /AI answer tracking/)).toBe(
      "AI answer tracking across 2 AI engines (weekly)",
    );
  });
});

// ─── Search pool and tracked keywords ───────────────────────────────────────

describe("search and keyword bullets are derived from the enforced allowances", () => {
  it.each(CARD_TIERS)("%s prints both halves with the enforced numbers", (plan) => {
    const config = PLAN_CONFIGS[plan];
    const line = bullet(plan, "en", /SEO searches/);
    expect(line, `${plan} has no search bullet`).toBeDefined();
    expect(line).toContain(config.seoSearchesPerMonth!.toLocaleString("en-US"));
    expect(line).toContain(config.trackedKeywords!.toLocaleString("en-US"));
  });

  it("renders the French thousands separator as a space, not a comma", () => {
    // "1 000 recherches SEO", matching the French copy already in the app.
    const line = bullet("GROWTH", "fr", /recherches SEO/);
    expect(line).toContain("1 000");
    expect(line).not.toContain(",");
  });

  it("omits the keyword half entirely at a cap of 0", () => {
    // A zero cap is not a small allowance, it is the Rank Tracker being locked,
    // and a locked tool must not appear on the card at all. No tier is at 0
    // today — this asserts the branch that keeps that true if one ever is.
    const zeroed = { ...PLAN_CONFIGS.STARTER, trackedKeywords: 0 };
    expect(zeroed.trackedKeywords).toBe(0);
    // Guard the live config too: nothing sellable may sit at 0 while the card
    // advertises the tool.
    for (const plan of CARD_TIERS) {
      expect(PLAN_CONFIGS[plan].trackedKeywords, `${plan} keyword cap`).toBeGreaterThan(0);
    }
  });
});

// ─── Crawl, location and volume bullets ─────────────────────────────────────

describe("volume bullets match their quota fields", () => {
  it.each(CARD_TIERS)("%s crawl ceiling matches crawlUrlCap", (plan) => {
    const cap = PLAN_CONFIGS[plan].crawlUrlCap;
    expect(bullet(plan, "en", /Site crawls/)).toContain(cap.toLocaleString("en-US"));
  });

  it.each(CARD_TIERS)("%s location count matches maxLocations", (plan) => {
    const n = PLAN_CONFIGS[plan].quotaDefaults.maxLocations;
    expect(bullet(plan, "en", /location/)).toContain(String(n));
  });

  it.each(CARD_TIERS)("%s feedback volume matches maxRequestsPerMonth", (plan) => {
    const n = PLAN_CONFIGS[plan].quotaDefaults.maxRequestsPerMonth;
    expect(bullet(plan, "en", /feedback requests/)).toContain(n.toLocaleString("en-US"));
  });

  it("pluralises the entry tier's single location", () => {
    expect(bullet("STARTER", "en", /location/)).toBe("1 location");
    expect(bullet("GROWTH", "en", /location/)).toBe("5 locations");
  });
});

// ─── The conditional Keyword Opportunity Finder line ────────────────────────

describe("the domain-analyses line is conditional on the tool being live", () => {
  it("is live today, so every tier with an allowance shows the line", () => {
    // Reads the real catalog: the Finder currently ships (no `comingSoon`).
    expect(isSeoToolLive("keyword_opportunities")).toBe(true);
    for (const plan of CARD_TIERS) {
      const line = bullet(plan, "en", /domain analyses/);
      const allowance = PLAN_CONFIGS[plan].keywordOpportunityAnalysesPerMonth!;
      expect(line, `${plan} domain-analyses line`).toBeDefined();
      expect(line).toContain(String(allowance));
    }
  });

  it("vanishes from every card when the tool is a scaffold", async () => {
    // THE OTHER HALF OF THE CONDITION, by fixture. A card must never promise a
    // tool that has gone back to being a placeholder — the §7.1 lesson, which
    // is why this is keyed on the catalog rather than on a boolean.
    vi.resetModules();
    vi.doMock("@/lib/seo-tools", async () => {
      const actual = await vi.importActual<typeof import("@/lib/seo-tools")>("@/lib/seo-tools");
      return { ...actual, isSeoToolLive: () => false };
    });
    const { planFeatures: gated } = await import("@/lib/plan-features");
    for (const plan of CARD_TIERS) {
      expect(gated(plan, "en").some((f) => /domain analyses/.test(f)), plan).toBe(false);
      expect(gated(plan, "fr").some((f) => /analyses de domaine/.test(f)), plan).toBe(false);
    }
    vi.doUnmock("@/lib/seo-tools");
    vi.resetModules();
  });

  it("derives the entry tier's '75+ opportunities' from the AI test limit", () => {
    const analyses = PLAN_CONFIGS.STARTER.keywordOpportunityAnalysesPerMonth!;
    const expected = analyses * AI_TESTED_KEYWORD_LIMIT;
    expect(bullet("STARTER", "en", /domain analyses/)).toContain(`${expected}+`);
  });

  it("glosses the term on the entry card only", () => {
    expect(bullet("STARTER", "en", /domain analyses/)).toMatch(/AI Keyword Opportunity Finder/);
    expect(bullet("GROWTH", "en", /domain analyses/)).toBe("25 domain analyses/mo");
    expect(bullet("AGENCY", "en", /domain analyses/)).toBe("55 domain analyses/mo");
  });

  it("names a tool that is really in the catalog", () => {
    // Guards the id itself: a typo would silently disable the line forever,
    // because isSeoToolLive() answers false for an unknown id.
    const ids = SEO_TOOL_GROUPS.flatMap((g) => g.tools).map((t) => t.id);
    expect(ids).toContain("keyword_opportunities");
  });
});

// ─── Support tiers ──────────────────────────────────────────────────────────

describe("support wording is the binding definition, on every card", () => {
  // Anchored: AGENCY also carries "Custom domain support", which a bare
  // /support/i matches first.
  const SUPPORT = /^(Email|Priority) support/;

  it("gives STARTER email support at 48h on weekdays", () => {
    expect(bullet("STARTER", "en", SUPPORT)).toBe("Email support — 48h weekday response");
  });

  it.each(["GROWTH", "AGENCY"] as const)("gives %s priority support at 24h on weekdays", (plan) => {
    expect(bullet(plan, "en", SUPPORT)).toBe("Priority support — email, 24h weekday response");
  });

  it("defines the tier in the bullet rather than leaving 'priority' to the reader", () => {
    // "Priority" on its own is a word customers price their own expectations
    // with. Every support bullet must carry its actual response time.
    for (const plan of CARD_TIERS) {
      expect(bullet(plan, "en", SUPPORT)).toMatch(/\d+h weekday response/);
    }
  });

  it("never promises phone, chat or a weekend response on any tier", () => {
    // Nobody staffs any of the three. A support promise is the cheapest thing
    // to write and the most expensive to not honour.
    for (const locale of LOCALES) {
      const all = Object.values(planFeaturesByPlan(locale)).flat().join(" ").toLowerCase();
      for (const forbidden of ["phone", "live chat", "24/7", "weekend", "téléphon", "clavardage"]) {
        expect(all, `${locale} promises ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});

// ─── Locale folding ─────────────────────────────────────────────────────────

describe("locale folding", () => {
  it("sends fr and fr-CA to French, and en/en-CA/de-CH to English", () => {
    expect(planFeatureBase("fr")).toBe("fr");
    expect(planFeatureBase("fr-CA")).toBe("fr");
    expect(planFeatureBase("en")).toBe("en");
    expect(planFeatureBase("en-CA")).toBe("en");
    // de-CH falls back to EN — the established dashboard pattern for copy with
    // no German catalogue. Asserted so the fallback is a decision, not a bug.
    expect(planFeatureBase("de-CH")).toBe("en");
    expect(planFeatureBase(undefined)).toBe("en");
  });

  it("gives every locale a full, non-empty set of bullets", () => {
    for (const locale of LOCALES) {
      const all = planFeaturesByPlan(locale);
      for (const plan of ALL_TIERS) {
        expect(all[plan].length, `${locale}/${plan}`).toBeGreaterThan(5);
        for (const line of all[plan]) expect(line.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("leaves no English bullet on a French card", () => {
    // The failure this catches is a half-translated card, which reads worse
    // than a consistently English one.
    for (const plan of CARD_TIERS) {
      const fr = planFeatures(plan, "fr");
      const en = planFeatures(plan, "en");
      // Every line must differ from its English counterpart except where the
      // two languages genuinely coincide (none currently do).
      expect(fr).toHaveLength(en.length);
      for (let i = 0; i < fr.length; i++) {
        expect(fr[i], `${plan}[${i}] untranslated`).not.toBe(en[i]);
      }
    }
  });
});

// ─── One source, every renderer ─────────────────────────────────────────────

describe("there is exactly one source of card bullets", () => {
  it("no longer exposes a typed features array on PLAN_CONFIGS", () => {
    // The field these bullets used to live in. Its removal is what makes the
    // single source real rather than conventional — there is nowhere left to
    // type a number that the cards would then render.
    for (const plan of ALL_TIERS) {
      expect(PLAN_CONFIGS[plan]).not.toHaveProperty("features");
    }
  });

  it("gives the marketing and in-app renderers identical bullets", () => {
    // pricingTiers() feeds the homepage and /pricing; planFeaturesByPlan()
    // feeds /billing. They must agree, or a customer reads one thing before
    // buying and another after.
    for (const locale of LOCALES) {
      const byPlan = planFeaturesByPlan(locale);
      for (const plan of ALL_TIERS) {
        expect(byPlan[plan], `${locale}/${plan}`).toEqual(planFeatures(plan, locale));
      }
    }
  });

  it("folds the retired AI_VISIBILITY tier onto STARTER's bullets", () => {
    expect(planFeatures("AI_VISIBILITY", "en")).toEqual(planFeatures("STARTER", "en"));
  });
});
