// Every dotted key the config declares resolves, in all three locales.
//
// marketingLabel() returns the KEY when it cannot resolve one, which makes a
// missing translation visible in the UI rather than blank. That fallback is
// good behaviour and a bad thing to ship, so this suite asserts nothing ever
// takes it.
import { describe, it, expect } from "vitest";
import { MARKETING_CATEGORIES, categoryVariables } from "@/lib/marketing-templates";
import {
  MARKETING_COPY,
  marketingLabel,
  marketingVarHint,
  type DashLocale,
} from "@/lib/i18n/dashboard";

const LOCALES: DashLocale[] = ["en", "fr", "de-CH"];

describe("marketing copy", () => {
  it("covers all three dashboard locales and no more", () => {
    // Four catalogs here would be unreachable code: dashboardLocale() folds
    // fr* to fr, de* to de-CH and everything else — en-CA included — to en.
    expect(Object.keys(MARKETING_COPY).sort()).toEqual(["de-CH", "en", "fr"]);
  });

  it("resolves every category name and role in every locale", () => {
    for (const locale of LOCALES) {
      const copy = MARKETING_COPY[locale];
      for (const category of MARKETING_CATEGORIES) {
        for (const key of [category.nameKey, category.roleKey]) {
          const label = marketingLabel(copy, key);
          expect(label, `${locale} ${key}`).not.toBe(key);
          expect(label.trim().length, `${locale} ${key} is empty`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("resolves every variable label in every locale", () => {
    for (const locale of LOCALES) {
      const copy = MARKETING_COPY[locale];
      for (const category of MARKETING_CATEGORIES) {
        for (const variable of categoryVariables(category)) {
          const label = marketingLabel(copy, variable.labelKey);
          expect(label, `${locale} ${variable.labelKey}`).not.toBe(variable.labelKey);
          expect(label.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("returns the key itself for something it genuinely cannot resolve", () => {
    const copy = MARKETING_COPY.en;
    expect(marketingLabel(copy, "marketing.nope.name")).toBe("marketing.nope.name");
    expect(marketingLabel(copy, "marketing.var.nothing")).toBe("marketing.var.nothing");
    expect(marketingLabel(copy, "garbage")).toBe("garbage");
  });

  it("gives the three pasted-corpus fields a format hint in every locale", () => {
    // These are the fields where the user has to guess what to paste, and
    // guessing wrong means a validation error rather than a result.
    for (const locale of LOCALES) {
      const copy = MARKETING_COPY[locale];
      for (const key of [
        "marketing.var.writingSamples",
        "marketing.var.data",
        "marketing.var.rawFeedback",
        "marketing.var.startDate",
      ]) {
        expect(marketingVarHint(copy, key), `${locale} ${key}`).toBeTruthy();
      }
    }
    expect(marketingVarHint(MARKETING_COPY.en, "marketing.var.topic")).toBeNull();
  });

  it("uses ss and never ß in the Swiss catalog", () => {
    // House rule, and the reason de-CH is its own catalog rather than a de one.
    expect(JSON.stringify(MARKETING_COPY["de-CH"])).not.toContain("ß");
  });

  it("says Echorank, never EchoRank", () => {
    for (const locale of LOCALES) {
      expect(JSON.stringify(MARKETING_COPY[locale])).not.toMatch(/EchoRank/);
    }
  });

  it("interpolates the usage lines in every locale", () => {
    for (const locale of LOCALES) {
      const copy = MARKETING_COPY[locale];
      expect(copy.usageLine("1,200", "200,000")).toContain("1,200");
      expect(copy.usageLine("1,200", "200,000")).toContain("200,000");
      expect(copy.usageUnlimited("42")).toContain("42");
    }
  });

  it("keeps fr and de-CH genuinely translated, not English passed through", () => {
    // A catalog that type-checks but was copy-pasted from en would pass every
    // test above. These are strings whose English is distinctive enough that a
    // match means someone forgot to translate.
    for (const locale of ["fr", "de-CH"] as DashLocale[]) {
      const copy = MARKETING_COPY[locale];
      expect(copy.hubIntro).not.toBe(MARKETING_COPY.en.hubIntro);
      expect(copy.lockedBody).not.toBe(MARKETING_COPY.en.lockedBody);
      expect(copy.modeHeuristicNote).not.toBe(MARKETING_COPY.en.modeHeuristicNote);
      for (const category of MARKETING_CATEGORIES) {
        expect(
          marketingLabel(copy, category.roleKey),
          `${locale} ${category.id} role is still English`,
        ).not.toBe(marketingLabel(MARKETING_COPY.en, category.roleKey));
      }
    }
  });
});
