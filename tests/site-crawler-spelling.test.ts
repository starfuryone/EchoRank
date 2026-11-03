// Spell check (Phase 3c): real hunspell dictionaries through nspell. Fixtures
// use a few known-good and known-bad words per language, no word lists.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { acceptedWords, checkSpelling, primaryLang, spellTokens } from "@/lib/site-crawler/spelling";
import { normalizeAcceptedWords, parseAcceptedWords, MAX_ACCEPTED_WORDS } from "@/lib/site-crawler/accepted-words";

const none = new Set<string>();

describe("spellTokens", () => {
  it("skips numbers, acronyms, inner capitals, URLs and e-mail addresses", () => {
    expect(spellTokens("Visit https://example.com or mail hi@example.com about SEO and iPhone 15 v2 sales", "en", none)).toEqual([
      "Visit",
      "or",
      "mail",
      "about",
      "and",
      "sales",
    ]);
  });

  it("drops French elisions and splits hyphenated words", () => {
    expect(spellTokens("l'exploration qu'il porte-monnaie", "fr", none)).toEqual(["exploration", "il", "porte", "monnaie"]);
  });

  it("skips accepted words, case-insensitively", () => {
    expect(spellTokens("Acmeware rocks", "en", new Set(["acmeware"]))).toEqual(["rocks"]);
  });
});

describe("checkSpelling", () => {
  it("English: reports distinct misspellings, accepts capitalised words at sentence start", async () => {
    const out = await checkSpelling("The cat sat. Teh dog will recieve the recieve.", "en-CA", none);
    expect(out).toMatchObject({ lang: "en", supported: true, misspelled: 2 });
    expect(out!.sample).toEqual(["Teh", "recieve"]);
  });

  it("French", async () => {
    const out = await checkSpelling("La maison est très belle. Une voitture rouge.", "fr-CA", none);
    expect(out).toMatchObject({ lang: "fr", misspelled: 1, sample: ["voitture"] });
  }, 30_000);

  it("German, with Swiss ss accepted for ß", async () => {
    const out = await checkSpelling("Die Strasse ist lang. Das Hauss ist alt.", "de-CH", none);
    expect(out).toMatchObject({ lang: "de", misspelled: 1, sample: ["Hauss"] });
  });

  it("an unsupported language is reported as such, not checked", async () => {
    expect(await checkSpelling("Hola mundo", "es", none)).toEqual({ lang: "es", supported: false, checked: 0, misspelled: 0, sample: [] });
  });

  it("no language at all: no verdict rather than a guess", async () => {
    expect(await checkSpelling("Teh", null, none)).toBeNull();
    expect(primaryLang("")).toBeNull();
  });
});

describe("accepted words", () => {
  it("always include the workspace name and the crawled host", () => {
    const set = acceptedWords(["Nosyware"], "Acme Corp", "https://www.shopify-store.example/");
    expect([...set]).toEqual(expect.arrayContaining(["nosyware", "acme", "corp", "shopify", "store", "example"]));
  });

  it("are trimmed, deduplicated and bounded", () => {
    expect(normalizeAcceptedWords([" Acme ", "acme", "", "x".repeat(61), "Zed"])).toEqual(["Acme", "Zed"]);
    expect(parseAcceptedWords("a1\nb2, c3")).toEqual(["a1", "b2", "c3"]);
    expect(normalizeAcceptedWords(Array.from({ length: 900 }, (_, i) => `w${i}`))).toHaveLength(MAX_ACCEPTED_WORDS);
  });
});
