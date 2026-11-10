// /learn/guides/local-seo-checklist (2026-11-10).
//
// Step 4: Google stopped showing FAQ rich results for every site on May 7,
// 2026. The guide keeps LocalBusiness schema and a real FAQ written for
// people; FAQPage markup is optional and is never recommended for a rich
// result. The "Last updated" line and Article dateModified share one date.
import { describe, expect, it } from "vitest";
import { LOCAL_SEO_UPDATED, guideBySlug, headingId } from "@/lib/learn-content";
import { articleNode, decode, renderGuide } from "./helpers/learn-guide-image";

const SLUG = "local-seo-checklist";
const render = (locale: string) => renderGuide(SLUG, locale);

/** The HTML of step 4: from its H2 to the next one. */
function step4(html: string): string {
  const from = html.indexOf(`<h2 id="${headingId("4. Structured data")}"`);
  const to = html.indexOf("<h2", from + 4);
  expect(from).toBeGreaterThan(-1);
  return decode(html.slice(from, to)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("step 4: structured data after FAQ rich results ended", () => {
  it("keeps LocalBusiness schema and a real FAQ written for people", async () => {
    const s = step4(await render("en"));
    expect(s).toContain("LocalBusiness markup on your homepage/contact page");
    expect(s).toContain("A real FAQ written for people");
  });

  it("says FAQPage markup is optional and earns no Google rich result, with the date", async () => {
    const s = step4(await render("en"));
    expect(s).toContain("FAQPage markup is optional");
    expect(s).toContain("Since May 7, 2026, Google shows no FAQ rich results for any site");
  });

  it("never recommends FAQ markup for a rich result", () => {
    const text = JSON.stringify(guideBySlug(SLUG)!.body);
    expect(text).not.toMatch(/FAQPage\*\* markup on a real FAQ/);
    expect(text).not.toMatch(/(earn|win|get|qualif\w*|eligib\w*)[^."]{0,40}(FAQ )?rich (result|snippet)/i);
  });

  it("the Last updated line and the Article dateModified carry the same date", async () => {
    expect(LOCAL_SEO_UPDATED).toBe("2026-11-10");
    const html = await render("en");
    expect(decode(html)).toContain("Last updated: November 10, 2026.");
    expect(articleNode(html).dateModified).toBe(LOCAL_SEO_UPDATED);
    expect(guideBySlug(SLUG)!.dateModified).toBe(LOCAL_SEO_UPDATED);
  });
});
