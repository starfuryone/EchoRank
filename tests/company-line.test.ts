// The company line in every public footer, from one constant (src/lib/brand/company.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COMPANY_LINE, COMPANY_LINE_HTML, withCompanyLine } from "@/lib/brand/company";
import { CompanyLine } from "@/components/brand/CompanyLine";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const STANDALONE = [
  "ai-discovery-optimization",
  "glossary",
  "keyword-research",
  "link-building-playbook",
  "methodology",
  "reputation-tools",
  "seo-guide",
  "setup-ai-search-tracking",
  "technical-geo",
  "seo-spider/issues",
  "enterprise",
];

const REACT_FOOTERS = [
  "src/components/PublicFooter.tsx",
  "src/app/[locale]/HomeClient.tsx",
  "src/app/[locale]/ai-visibility/page.tsx",
  "src/app/[locale]/guide/page.tsx",
  "src/app/[locale]/customer-feedback/page.tsx",
  "src/app/[locale]/how-to/page.tsx",
  "src/app/[locale]/guide-visibilite-ia/en.tsx",
  "src/app/[locale]/guide-visibilite-ia/page.tsx",
  "src/app/[locale]/live-monitoring/page.tsx",
  "src/app/[locale]/reputation-engine/page.tsx",
  "src/app/[locale]/act-on-signals/page.tsx",
  "src/app/[locale]/reputation-risk/page.tsx",
];

describe("the company line", () => {
  it("is the exact text", () => {
    expect(COMPANY_LINE).toBe(
      "ChatLogic Insights Ltd · Registered in England and Wales, no. 15593166 · " +
        "Registered office: 82a James Carter Road, Mildenhall, IP28 7DE, United Kingdom",
    );
  });

  it("renders as one paragraph in React", () => {
    expect(renderToStaticMarkup(createElement(CompanyLine))).toBe(`<p class="er-company-line">${COMPANY_LINE}</p>`);
  });

  it("goes inside the footer's container, or before </footer> when there is none", () => {
    expect(withCompanyLine('<main></main><footer><div class="wrap"><p>x</p></div></footer>')).toBe(
      `<main></main><footer><div class="wrap"><p>x</p>${COMPANY_LINE_HTML}\n</div></footer>`,
    );
    expect(withCompanyLine("<div></div><footer><p>x</p></footer>")).toBe(
      `<div></div><footer><p>x</p>${COMPANY_LINE_HTML}\n</footer>`,
    );
    expect(withCompanyLine("<p>no footer</p>")).toBe("<p>no footer</p>");
  });

  it.each(STANDALONE)("is on the standalone page /%s, once, inside its footer", async (slug) => {
    const { GET } = await import(`@/app/[locale]/${slug}/route`);
    const html = await (await GET(new Request(`https://echorank360.com/en/${slug}`), { params: Promise.resolve({ locale: "en" }) })).text();
    expect(html.split(COMPANY_LINE_HTML)).toHaveLength(2);
    const at = html.indexOf(COMPANY_LINE_HTML);
    expect(at).toBeGreaterThan(html.lastIndexOf("<footer"));
    expect(at).toBeLessThan(html.lastIndexOf("</footer>"));
  });

  it("standalone payloads no longer hand-write the company number", () => {
    for (const slug of STANDALONE) {
      const file = slug === "seo-spider/issues" ? "library-html.ts" : "landing-html.ts";
      const src = read(`src/app/[locale]/${slug}/${file}`);
      const footer = src.slice(src.lastIndexOf("<footer"), src.lastIndexOf("</footer>"));
      expect(footer, slug).not.toContain("15593166");
    }
  });

  it.each(REACT_FOOTERS)("%s renders <CompanyLine /> in its footer", (f) => {
    const src = read(f);
    const footer = src.slice(src.indexOf("<footer"), src.indexOf("</footer>"));
    expect(footer).toContain("<CompanyLine />");
  });

  it("legal pages are not touched", () => {
    for (const p of ["privacy", "terms", "cookies", "disclaimer", "subscription-agreement", "no-financial-advice"]) {
      expect(read(`src/app/[locale]/legal/${p}/page.tsx`), p).not.toContain("CompanyLine");
    }
  });
});
