// Every "Talk to us" / Enterprise contact link goes to the sales form
// (/{locale}/enterprise/contact) with a ?src= naming where it came from, and no
// sales mailto is left in src/.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { enterpriseHtml, ENTERPRISE_HTML } from "@/app/[locale]/enterprise/landing-html";
import { GET as enterpriseGet } from "@/app/[locale]/enterprise/route";
import { SalesContactLink } from "@/components/sales/SalesContactLink";
import { COMPANY_LINE_HTML } from "@/lib/brand/company";
import { AI_LABELS } from "@/lib/i18n/ai-labels";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { SALES_CONTACT_PATH, cleanSource, salesContactHref } from "@/lib/sales/inquiry-options";
import { SALES_COPY } from "@/lib/sales/inquiry-copy";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** A link "resolves to the form": /{site locale}/enterprise/contact?src=<clean src>. */
function resolvesToForm(href: string) {
  const u = new URL(href, "https://echorank360.com");
  const [, locale, ...rest] = u.pathname.split("/");
  expect(SUPPORTED_LOCALES as readonly string[], href).toContain(locale);
  expect(`/${rest.join("/")}`, href).toBe(SALES_CONTACT_PATH);
  expect(cleanSource(u.searchParams.get("src")), href).toBe(u.searchParams.get("src"));
}

describe("the form exists where the links point", () => {
  it("has a page, a registry entry (sitemap, locale-less 308) and builds hrefs only with a clean src", () => {
    expect(existsSync(join(ROOT, "src/app/[locale]/enterprise/contact/page.tsx"))).toBe(true);
    expect(LOCALIZED_ROUTES.map((r) => r.path)).toEqual(expect.arrayContaining(["/enterprise", "/enterprise/contact"]));
    expect(salesContactHref("fr-CA", "pricing-enterprise")).toBe("/fr-CA/enterprise/contact?src=pricing-enterprise");
    expect(() => salesContactHref("en", "Bad Src!")).toThrow();
  });
});

describe("/enterprise", () => {
  const html = enterpriseHtml();
  const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>Talk to us<\/a>/g)].map((m) => m[1]);

  it("every Talk to us button goes to the form, each with its own src", () => {
    expect(hrefs).toHaveLength(4);
    hrefs.forEach(resolvesToForm);
    expect(new Set(hrefs.map((h) => new URL(h, "https://x").searchParams.get("src")))).toEqual(
      new Set(["enterprise-nav", "enterprise-hero", "enterprise-more-than-agency", "enterprise-cta"]),
    );
    expect(html).not.toContain("mailto:");
  });

  it("is anchored #contact, names the crawler from brand.ts, and carries the company line", async () => {
    expect(html).toContain('<section class="cta" id="contact">');
    expect(ENTERPRISE_HTML).not.toContain("Nosy");
    expect(html).not.toContain("__CRAWLER_NAME_TM__");
    expect(html).not.toContain("__DRAFTED_BY_AI__");
    expect(html).toContain(`<span class="tag">${AI_LABELS.en.draftedByAi}</span>`);
    expect(html.split(CRAWLER_BRAND.nameTm)).toHaveLength(4);
    const served = await (await enterpriseGet()).text();
    expect(served).toBe(html);
    expect(served).toContain(COMPANY_LINE_HTML);
    expect(served).toMatch(/href="\/en\/legal\/cookies"/);
  });
});

describe("the other entry points", () => {
  it("the pricing grid's Enterprise line, on /pricing, the homepage and /site-crawler", () => {
    expect(read("src/app/[locale]/PricingSection.tsx")).toContain("href={salesContactHref(locale, salesSrc)}");
    expect(read("src/app/[locale]/pricing/page.tsx")).toContain('salesSrc="pricing-enterprise"');
    expect(read("src/app/[locale]/HomeClient.tsx")).toContain('salesSrc="home-pricing"');
    expect(read("src/app/[locale]/site-crawler/page.tsx")).toContain('salesSrc="site-crawler-pricing"');
    for (const src of ["pricing-enterprise", "home-pricing", "site-crawler-pricing"]) resolvesToForm(salesContactHref("en", src));
  });

  it("/ai-visibility's pricing card", () => {
    expect(read("src/app/[locale]/ai-visibility/page.tsx")).toContain('salesContactHref(locale, "ai-visibility-pricing")');
  });

  it("in-app billing: the plan line for a custom plan and the line under the plans", () => {
    const billing = read("src/app/(dashboard)/billing/page-client.tsx");
    expect(billing).toContain('salesContactHref(locale, "app-billing")');
    expect(billing).toContain('salesContactHref(locale, "app-billing-plan")');
  });

  it.each([
    ["serp-checker-client", "app-limit-serp-checker"],
    ["site-explorer-client", "app-limit-site-explorer"],
    ["site-audit-client", "app-limit-site-audit"],
    ["backlinks-client", "app-limit-backlinks"],
    ["ai-lens-client", "app-limit-ai-lens"],
  ])("the %s limit message", (file, src) => {
    expect(read(`src/components/seo-tools/${file}.tsx`)).toContain(`<SalesContactLink locale={locale} src="${src}" />`);
    resolvesToForm(salesContactHref("de-CH", src));
  });

  it("<SalesContactLink /> renders the form link in the dashboard's language", () => {
    const out = renderToStaticMarkup(createElement(SalesContactLink, { locale: "fr", src: "app-limit-serp-checker" }));
    expect(out).toContain('href="/fr/enterprise/contact?src=app-limit-serp-checker"');
    expect(out).toContain(SALES_COPY.fr.links.higherLimits);
  });
});

describe("no sales mailto left", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (n === "generated" || n.includes(".bak")) return [];
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  }

  it("src/ has no mailto to support@, sales@ or enterprise@, nor ?subject=Enterprise", () => {
    const hits = walk(join(ROOT, "src")).filter((p) =>
      /mailto:[^"'\s]*(support@|sales@|enterprise@|subject=Enterprise)|mailto:\$\{SUPPORT_EMAIL\}/i.test(readFileSync(p, "utf8")),
    );
    expect(hits.map((p) => p.slice(ROOT.length + 1))).toEqual([]);
  });

  it("every copy locale has the link texts, de-CH without ß", () => {
    for (const c of Object.values(SALES_COPY)) for (const v of Object.values(c.links)) expect(v).toBeTruthy();
    expect(JSON.stringify(SALES_COPY["de-CH"])).not.toContain("ß");
  });
});
