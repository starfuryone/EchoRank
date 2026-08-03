// Prompt assembly, and the boundary that keeps pasted corpora out of it.
//
// The privacy claim this module makes on screen — "what you paste never leaves
// this server" — is enforced in exactly one place: promptTemplate() drops
// multiline parts, so the assembled prompt cannot carry them. These tests hold
// that line for all 12 categories at once, so a new category with a pasted
// field cannot be added without either honouring the rule or turning this red.
import { describe, it, expect } from "vitest";
import {
  MARKETING_CATEGORIES,
  categoryVariables,
  findMarketingCategory,
  templateText,
  AUDIT_INSTRUCTION,
} from "@/lib/marketing-templates";
import {
  assemblePrompt,
  collectValues,
  fillTemplate,
  promptTemplate,
  MarketingValidationError,
} from "@/lib/marketing/prompt";

const CORPUS = "SECRET-CORPUS-MARKER customers said the onboarding was slow.";

/** Every non-multiline variable filled with a recognisable value. */
function fullValues(categoryId: string): Record<string, string> {
  const category = findMarketingCategory(categoryId)!;
  const out: Record<string, string> = {};
  for (const v of categoryVariables(category)) {
    out[v.k] = v.multiline ? CORPUS : `value-${v.k}`;
  }
  return out;
}

describe("promptTemplate", () => {
  it("drops every multiline part, for every category", () => {
    for (const category of MARKETING_CATEGORIES) {
      const rendered = promptTemplate(category);
      for (const v of categoryVariables(category)) {
        if (v.multiline) {
          expect(rendered, `${category.id} leaked {${v.k}}`).not.toContain(`{${v.k}}`);
        } else {
          expect(rendered, `${category.id} lost {${v.k}}`).toContain(`{${v.k}}`);
        }
      }
    }
  });

  it("leaves a category with no pasted field untouched", () => {
    const positioning = findMarketingCategory("positioning")!;
    expect(promptTemplate(positioning)).toBe(templateText(positioning).trim());
  });

  it("strips 09 and 12 down to their instruction, with no dangling placeholder", () => {
    // These two put the pasted corpus FIRST, so a naive fill would emit a
    // literal "{DATA}" into the prompt. Both must come out as pure instruction.
    for (const id of ["analytics", "voc"]) {
      const rendered = promptTemplate(findMarketingCategory(id)!);
      expect(rendered, id).not.toMatch(/\{[A-Z_]+\}/);
      expect(rendered.length, id).toBeGreaterThan(40);
    }
  });
});

describe("collectValues", () => {
  it("requires every single-line field", () => {
    const category = findMarketingCategory("positioning")!;
    expect(() => collectValues(category, { PRODUCT: "a" })).toThrow(MarketingValidationError);
  });

  it("ignores multiline fields rather than requiring them", () => {
    // 09 and 12 declare ONLY a multiline field, so a strict requirement would
    // make them impossible to submit.
    for (const id of ["analytics", "voc"]) {
      expect(collectValues(findMarketingCategory(id)!, {})).toEqual({});
    }
  });

  it("never returns a multiline value even when one is supplied", () => {
    const values = collectValues(findMarketingCategory("voc")!, { RAW_FEEDBACK: CORPUS });
    expect(JSON.stringify(values)).not.toContain("SECRET-CORPUS-MARKER");
  });

  it("trims and rejects whitespace-only values", () => {
    const category = findMarketingCategory("seo")!;
    expect(() =>
      collectValues(category, { KEYWORD: "   ", BUSINESS: "b", CONVERSION_PAGE: "c" }),
    ).toThrow(/KEYWORD/);
    const ok = collectValues(category, { KEYWORD: "  seo  ", BUSINESS: "b", CONVERSION_PAGE: "c" });
    expect(ok.KEYWORD).toBe("seo");
  });

  it("rejects an absurdly long single-line value", () => {
    const category = findMarketingCategory("positioning")!;
    expect(() =>
      collectValues(category, {
        PRODUCT: "x".repeat(2001),
        AUDIENCE: "a",
        COMPETITOR: "c",
        THEIR_ANGLE: "t",
      }),
    ).toThrow(MarketingValidationError);
  });
});

describe("fillTemplate", () => {
  it("substitutes known placeholders", () => {
    expect(fillTemplate("I sell {PRODUCT} to {AUDIENCE}.", { PRODUCT: "x", AUDIENCE: "y" })).toBe(
      "I sell x to y.",
    );
  });

  it("leaves an unknown placeholder visible rather than blanking it", () => {
    // A config typo should show up in the output, not silently produce a brief
    // with a hole where a requirement used to be.
    expect(fillTemplate("a {MISSING} b", {})).toBe("a {MISSING} b");
  });
});

describe("assemblePrompt", () => {
  const base = { locale: "en" as const, voiceGuide: null };

  it("puts the audit instruction first and alone when there is no voice guide", () => {
    const category = findMarketingCategory("ads")!;
    const prompt = assemblePrompt({ ...base, category, values: fullValues("ads") });
    expect(prompt.system).toHaveLength(1);
    expect(prompt.system[0].text).toBe(AUDIT_INSTRUCTION);
  });

  it("appends the voice guide as a second block, after the audit instruction", () => {
    const category = findMarketingCategory("ads")!;
    const prompt = assemblePrompt({
      ...base,
      category,
      values: fullValues("ads"),
      voiceGuide: "BRAND VOICE GUIDE\nShort sentences.",
    });
    expect(prompt.system).toHaveLength(2);
    expect(prompt.system[0].text).toBe(AUDIT_INSTRUCTION);
    expect(prompt.system[1].text).toContain("Short sentences.");
  });

  it("ignores a blank voice guide instead of adding an empty block", () => {
    const category = findMarketingCategory("ads")!;
    const prompt = assemblePrompt({
      ...base,
      category,
      values: fullValues("ads"),
      voiceGuide: "   \n  ",
    });
    expect(prompt.system).toHaveLength(1);
  });

  it("never sets cache_control — the prefix is below Haiku 4.5's minimum", () => {
    const prompt = assemblePrompt({
      ...base,
      category: findMarketingCategory("campaign")!,
      values: fullValues("campaign"),
      voiceGuide: "guide",
    });
    for (const block of prompt.system) {
      expect(block).not.toHaveProperty("cache_control");
    }
  });

  it("carries the category's own token ceiling", () => {
    for (const category of MARKETING_CATEGORIES) {
      if (category.mode === "heuristic") continue;
      const prompt = assemblePrompt({
        ...base,
        category,
        values: fullValues(category.id),
      });
      expect(prompt.maxTokens, category.id).toBe(category.maxTokens);
    }
  });

  it("adds a language line for fr and de-CH, and none for en", () => {
    const category = findMarketingCategory("landing")!;
    const values = fullValues("landing");
    expect(assemblePrompt({ category, values, locale: "en", voiceGuide: null }).userMessage)
      .not.toMatch(/Write the deliverable in/);
    expect(assemblePrompt({ category, values, locale: "fr", voiceGuide: null }).userMessage)
      .toContain("French");
    const de = assemblePrompt({ category, values, locale: "de-CH", voiceGuide: null }).userMessage;
    expect(de).toContain("Swiss High German");
    // The instruction has to NAME the character it forbids, so this is the one
    // place a ß legitimately appears. The house rule is about user-facing copy;
    // tests/marketing-i18n.test.ts holds that line for the catalogs.
    expect(de).toContain("Use ss, never ß");
  });

  it("appends the computed context after the brief", () => {
    const category = findMarketingCategory("voc")!;
    const prompt = assemblePrompt({
      ...base,
      category,
      values: {},
      computedContext: '1. "setup was slow"',
    });
    expect(prompt.userMessage).toContain('1. "setup was slow"');
    expect(prompt.userMessage.indexOf("most frequent phrases")).toBeLessThan(
      prompt.userMessage.indexOf('1. "setup was slow"'),
    );
  });

  // ── The boundary ──────────────────────────────────────────────────────────

  it("cannot carry a pasted corpus into the prompt, for ANY category", () => {
    // Values are passed raw — including the multiline ones — as an
    // over-eager client would. Nothing assembled may contain the marker.
    for (const category of MARKETING_CATEGORIES) {
      if (category.mode === "heuristic") continue;
      const raw = fullValues(category.id);
      const prompt = assemblePrompt({
        ...base,
        category,
        values: collectValues(category, raw),
        voiceGuide: null,
      });
      const whole = JSON.stringify(prompt);
      expect(whole, `${category.id} leaked the corpus`).not.toContain("SECRET-CORPUS-MARKER");
    }
  });

  it("still cannot carry it when the raw values bypass collectValues", () => {
    // Defence in depth: even handed the corpus directly as a value map, the
    // template has no slot to put it in.
    for (const id of ["analytics", "voc", "social"]) {
      const category = findMarketingCategory(id)!;
      const prompt = assemblePrompt({
        ...base,
        category,
        values: fullValues(id),
        voiceGuide: null,
      });
      expect(JSON.stringify(prompt), id).not.toContain("SECRET-CORPUS-MARKER");
    }
  });
});
