// /[locale]/seo-spider/issues — the public issue library (Phase 3c).
import { PUBLIC_RULES } from "@/lib/site-crawler/rule-count";
import { describe, expect, it } from "vitest";
import { RULE_COPY, RULES } from "@/lib/crawl-rules";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { ruleCountLabel } from "@/lib/site-crawler/rule-count";
import { FAMILY_LABELS, esc, familiesInUse, issueLibraryHtml } from "@/app/[locale]/seo-spider/issues/library-html";
import { GET } from "@/app/[locale]/seo-spider/issues/route";

const html = issueLibraryHtml();

describe("issue library", () => {
  it("has one anchor per rule in the registry, and no other", () => {
    const anchors = [...html.matchAll(/<article class="rule" id="([^"]+)"/g)].map((m) => m[1]);
    expect(anchors).toEqual(familiesInUse().flatMap((f) => RULES.filter((r) => r.family === f).map((r) => r.id)));
    expect(new Set(anchors).size).toBe(PUBLIC_RULES.length);
  });

  it("prints each rule's description and fix from the registry, escaped", () => {
    const r = RULES.find((x) => x.id === "validation.invalid_head_element")!;
    expect(html).toContain("Body element inside &lt;head&gt;");
    expect(html).toContain(esc(RULE_COPY[r.id]!.howToFix));
    expect(html).not.toMatch(/<head>\s*contains/);
  });

  it("quotes the derived rule count only", () => {
    expect(html).toContain(`${ruleCountLabel()} named checks`);
    expect(html.match(/\b\d{2,3}\+? named checks/g)!.every((m) => m.startsWith(ruleCountLabel()))).toBe(true);
  });

  it("labels every family in use and has no FAQ", () => {
    for (const f of familiesInUse()) expect(html).toContain(`id="family-${f}"`);
    expect(Object.keys(FAMILY_LABELS)).toEqual(expect.arrayContaining(familiesInUse()));
    // FAQPage appears as a schema type in rule copy; the page itself carries no FAQ markup.
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!)["@type"]);
    expect(ld).toEqual(["CollectionPage"]);
    expect(html).not.toMatch(/class="faq/);
  });

  it("is a standalone document with the brand cased right and real legal links", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<link rel="canonical" href="https://echorank360.com/en/seo-spider/issues">');
    expect(html).not.toMatch(new RegExp(["Echo", "Rank"].join("[ -]?")));
    for (const l of ["privacy", "terms", "cookies"]) expect(html).toContain(`/en/legal/${l}`);
  });

  it("is served as HTML and registered at priority 0.6", async () => {
    const res = GET();
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toContain('id="spelling.misspellings"');
    expect(LOCALIZED_ROUTES.find((r) => r.path === "/seo-spider/issues")?.priority).toBe(0.6);
  });

  it("Phase 4d: an integration's family stays out of the public library until its flag is on", () => {
    expect(familiesInUse()).not.toContain("analytics");
    const html = issueLibraryHtml();
    expect(html).not.toContain("ga4.converting_page_has_issues");
    expect(html).toContain("gsc.traffic_noindex");
  });
});
