// tests/snapshot-scoring.test.ts
//
// The free AI Visibility Check's deterministic half: the fixed prompt mix,
// and mention / citation scoring on real-shaped OpenAI and Gemini payloads
// (tests/fixtures/snapshot/).

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));

import { buildPrompts, PROMPT_COUNT, PROMPT_MIX, scrubBrand } from "@/lib/snapshot/prompts";
import { domainsOf, findBrand, isCited, isMentioned, normalizeDomain } from "@/lib/snapshot/match";
import { costOf, parseGemini, parseOpenAi, priceFor } from "@/lib/snapshot/engines";

const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures/snapshot", name), "utf8"));

describe("prompt set", () => {
  const base = { brand: "Acme Plumbing", domain: "acmeplumbing.co.uk", category: "emergency plumber", location: "Leeds" };

  it("is the fixed mix: 4 best/top, 2 alternatives, 2 how-to, 2 direct", () => {
    const p = buildPrompts(base);
    expect(p).toHaveLength(PROMPT_COUNT);
    const counts = p.reduce<Record<string, number>>((n, x) => ({ ...n, [x.kind]: (n[x.kind] ?? 0) + 1 }), {});
    expect(counts).toEqual(PROMPT_MIX);
    expect(p.map((x) => x.kind)).toEqual(["best", "best", "best", "best", "alternatives", "alternatives", "howto", "howto", "direct", "direct"]);
  });

  it("names the brand in the 2 direct prompts and never in the other 8", () => {
    for (const locale of ["en", "fr"]) {
      const p = buildPrompts({ ...base, locale });
      for (const x of p.filter((q) => q.kind !== "direct")) expect(findBrand(x.text, base.brand, base.domain)).toBe(-1);
      for (const x of p.filter((q) => q.kind === "direct")) expect(x.text).toContain("Acme Plumbing");
    }
  });

  it("keeps the brand out even when the category or location carries it", () => {
    const p = buildPrompts({ ...base, category: "Acme Plumbing emergency plumber", location: "acme plumbing Leeds" });
    for (const x of p.filter((q) => q.kind !== "direct")) {
      expect(x.text.toLowerCase()).not.toContain("acme");
      expect(x.text).toContain("emergency plumber");
    }
    expect(scrubBrand("ACME plumbing — boilers", "Acme")).toBe("plumbing — boilers");
  });

  it("works without a location and in French", () => {
    expect(buildPrompts({ ...base, location: null })[0].text).toBe("What is the best emergency plumber?");
    const fr = buildPrompts({ ...base, category: "plombier", location: "Lyon", locale: "fr-CA" });
    expect(fr[0].text).toBe("Qui recommandez-vous comme plombier à Lyon ?");
  });
});

describe("mention scoring", () => {
  it("is fuzzy on the brand: case, spacing, accents, legal suffix, one typo", () => {
    const yes = [
      "Try ACME PLUMBING for call-outs.",
      "AcmePlumbing is local.",
      "acme-plumbing has good reviews",
      "Acmé Plumbing Ltd",
      "Acme Plumbng is reliable", // one typo on a 12-letter name
      "see acmeplumbing.co.uk",
    ];
    for (const t of yes) expect(isMentioned(t, "Acme Plumbing Ltd", "acmeplumbing.co.uk"), t).toBe(true);
    expect(isMentioned("Pipeworks and DrainPro are popular.", "Acme Plumbing", "acmeplumbing.co.uk")).toBe(false);
  });

  it("gives short brands no typo allowance", () => {
    expect(isMentioned("We used Ace for this.", "Ace", "ace-hvac.com")).toBe(true);
    expect(isMentioned("The act was passed.", "Ace", "ace-hvac.com")).toBe(false);
  });

  it("matches the domain's first label as a brand form", () => {
    expect(isMentioned("Echorank tracks this.", "Totally Different Name", "echorank360.com")).toBe(false);
    expect(isMentioned("Echorank360 tracks this.", "Totally Different Name", "echorank360.com")).toBe(true);
  });
});

describe("engine payloads", () => {
  it("OpenAI: text, url_citation annotations and web_search_call sources", () => {
    const a = parseOpenAi(fixture("openai-response.json"), "gpt-4.1-mini");
    expect(a.model).toBe("gpt-4.1-mini-2025-04-14");
    expect(isMentioned(a.text, "Acme Plumbing", "acmeplumbing.co.uk")).toBe(true);
    const domains = domainsOf(a.sourceUrls);
    expect(domains).toEqual(["checkatrade.com", "yell.com", "blog.acmeplumbing.co.uk", "acmeplumbing.co.uk"]);
    expect(isCited(domains, "acmeplumbing.co.uk")).toBe(true);
    expect(isCited(domains, "pipeworks.co.uk")).toBe(false);
    expect(a.usage).toEqual({ inputTokens: 1410, outputTokens: 162 });
  });

  it("Gemini: joined parts; grounding chunk titles are the source domains", () => {
    const a = parseGemini(fixture("gemini-response.json"), "gemini-3.1-flash-lite");
    expect(a.text).toContain("Pipeworks Ltd and Leeds Rapid Plumbing. Both");
    expect(isMentioned(a.text, "Acme Plumbing", "acmeplumbing.co.uk")).toBe(false);
    // The redirect URI of the non-domain title is dropped, not kept as a source.
    expect(domainsOf(a.sourceUrls)).toEqual(["checkatrade.com", "mybuilder.com"]);
    expect(a.usage).toEqual({ inputTokens: 392, outputTokens: 41 });
  });

  it("subdomains count as cited; look-alikes do not", () => {
    expect(isCited(["shop.acme.com"], "acme.com")).toBe(true);
    expect(isCited(["notacme.com", "acme.com.evil.io"], "acme.com")).toBe(false);
    expect(normalizeDomain("HTTPS://WWW.Acme.com/path?q=1")).toBe("acme.com");
    expect(normalizeDomain("not a domain")).toBeNull();
  });
});

describe("pricing", () => {
  it("bills OpenAI mini search calls a fixed 8k-token block plus the call fee", () => {
    const c = costOf("openai", "gpt-4.1-mini", { inputTokens: 1000, outputTokens: 500 }, true);
    expect(c).toBeCloseTo((9000 * 0.4 + 500 * 1.6) / 1e6 + 0.01, 8);
  });

  it("an unknown model gets the pessimistic fallback", () => {
    expect(priceFor("gemini", "gemini-9-ultra").perSearch).toBe(0.035);
    expect(priceFor("gemini", "gemini-3.1-flash-lite-preview").perSearch).toBe(0.014);
  });
});
