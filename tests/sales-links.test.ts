// Every "Talk to us" / Enterprise contact link goes to the sales form
// (/{locale}/enterprise/contact) with a ?src= naming where it came from, and no
// sales mailto is left in src/.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EnterprisePage, { generateMetadata as enterpriseMetadata } from "@/app/[locale]/enterprise/page";
import ContactPage from "@/app/[locale]/enterprise/contact/page";
import { currentSection } from "@/app/[locale]/enterprise/EnterpriseSubnav";
import { ENTERPRISE_SECTION_IDS, ENTERPRISE_SUBNAV_COPY } from "@/app/[locale]/enterprise/sections";
import { SalesContactLink } from "@/components/sales/SalesContactLink";
import { COMPANY_LINE } from "@/lib/brand/company";
import { PLAN_CONFIGS } from "@/lib/plan-config";
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

/** A page's markup as served (the server component awaited, then rendered). */
async function renderEnterprise(locale: string): Promise<string> {
  return renderToStaticMarkup(await EnterprisePage({ params: Promise.resolve({ locale }) }));
}
async function renderContact(locale: string): Promise<string> {
  return renderToStaticMarkup(
    await ContactPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }),
  );
}
const decode = (h: string) => h.replace(/&amp;/g, "&");

describe("/enterprise", () => {
  it("every Talk to us button goes to the form, each with its own src", async () => {
    const html = await renderEnterprise("en");
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>Talk to us<\/a>/g)].map((m) => decode(m[1]));
    expect(hrefs).toHaveLength(4);
    hrefs.forEach(resolvesToForm);
    expect(new Set(hrefs.map((h) => new URL(h, "https://x").searchParams.get("src")))).toEqual(
      new Set(["enterprise-nav", "enterprise-hero", "enterprise-more-than-agency", "enterprise-cta"]),
    );
    expect(html).not.toContain("mailto:");
  });

  it("is anchored #contact, names the crawler from brand.ts, labels the AI drafts, carries the company line", async () => {
    const html = await renderEnterprise("en");
    expect(html).toMatch(/<section class="[^"]*" id="contact">/);
    expect(read("src/app/[locale]/enterprise/page.tsx")).not.toContain("Nosy");
    expect(html).toContain(`${CRAWLER_BRAND.nameTm} crawls on our servers, not your laptop.`);
    expect(html).toContain(`<span>${CRAWLER_BRAND.nameTm} crawler</span>`);
    expect(html).toContain(`<h3>${CRAWLER_BRAND.nameTm} crawl</h3>`);
    expect(html).toContain(`>${AI_LABELS.en.draftedByAi}</span>`);
    // The shared footer: company line and legal links (cookies is its
    // cookie-settings control, not a link).
    expect(html).toContain(COMPANY_LINE);
    expect(html).toContain('href="/en/legal/terms"');
    expect(html).toContain('href="/en/legal/privacy"');
  });

  it("reads the Agency numbers from the plan config, not from the copy", async () => {
    const html = await renderEnterprise("en");
    const a = PLAN_CONFIGS.AGENCY;
    expect(html).toContain(`Agency from $${a.monthlyPrice}/month`);
    expect(html).toContain(`<b>${a.crawlUrlCap.toLocaleString("en-US")}</b>`);
    expect(html).toContain(`<h4>${a.quotaDefaults.maxLocations} locations</h4>`);
    expect(html).toContain(`${a.quotaDefaults.maxRequestsPerMonth.toLocaleString("en-US")} email and SMS requests a month`);
    expect(html).toContain(`<b>${a.quotaDefaults.maxApiRequestsPerDay.toLocaleString("en-US")}</b><span>requests a day on Agency</span>`);
  });

  it("canonicals every locale to the English page (the body is English everywhere)", async () => {
    const meta = await enterpriseMetadata({ params: Promise.resolve({ locale: "fr" }) });
    expect(String(meta.alternates?.canonical)).toMatch(/\/en\/enterprise$/);
  });
});

describe("/enterprise and /enterprise/contact navigation", () => {
  it("is no longer a standalone document: a page under the shared PublicNav", () => {
    expect(existsSync(join(ROOT, "src/app/[locale]/enterprise/route.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/app/[locale]/enterprise/landing-html.ts"))).toBe(false);
    for (const p of ["src/app/[locale]/enterprise/page.tsx", "src/app/[locale]/enterprise/contact/page.tsx"]) {
      expect(read(p), p).toContain('<PublicNav locale={locale} current="enterprise" />');
    }
  });

  it.each(["en", "fr", "de-CH"])("%s: PublicNav's Enterprise item is there and marked current on both pages", async (locale) => {
    for (const html of [await renderEnterprise(locale), await renderContact(locale)]) {
      const tags = html.match(/<a [^>]*>/g) ?? [];
      expect(tags.some((t) => t.includes(`href="/${locale}/enterprise"`) && t.includes('aria-current="page"'))).toBe(true);
    }
  });

  it("the sub-nav links each section on /enterprise, and every target exists on the page", async () => {
    const html = await renderEnterprise("en");
    const c = ENTERPRISE_SUBNAV_COPY.en;
    expect(html).toContain(`aria-label="${c.aria}"`);
    for (const id of ENTERPRISE_SECTION_IDS) {
      expect(html).toContain(`href="#${id}"`);
      expect(html).toMatch(new RegExp(`<section[^>]* id="${id}"`));
    }
    expect(Object.values(c.sections)).toEqual(["Crawler", "Features", "API & MCP", "Data"]);
  });

  it("on /enterprise/contact the sub-nav leads back to /enterprise#<section> and has no CTA of its own", async () => {
    const html = await renderContact("fr");
    const c = ENTERPRISE_SUBNAV_COPY.fr;
    expect(html).toContain(`aria-label="${c.aria}"`);
    for (const id of ENTERPRISE_SECTION_IDS) expect(html).toContain(`href="/fr/enterprise#${id}"`);
    expect(html).not.toContain("src=enterprise-nav");
  });

  it("PublicNav's row and burger switch at the same width, the one the longest locale needs", () => {
    // Measured with the Enterprise item: fr needs 1110px on one line at an
    // 18px gap. A row breakpoint below that wraps or overflows French pages.
    const css = read("src/app/[locale]/home2.module.css");
    expect(css).toContain("@media(max-width:1120px){.navlinks{display:none}}");
    expect(css).toMatch(/@media\(max-width:1120px\)\{\s*\.burger\{display:inline-block\}/);
    expect(css).toContain(".navlinks{gap:18px}");
    expect(css).not.toContain("@media(max-width:900px){.navlinks{display:none}}");
  });

  it("the sub-nav copy is complete in every locale, de-CH without ß", () => {
    for (const c of Object.values(ENTERPRISE_SUBNAV_COPY)) {
      expect(c.title && c.aria).toBeTruthy();
      for (const id of ENTERPRISE_SECTION_IDS) expect(c.sections[id]).toBeTruthy();
    }
    expect(JSON.stringify(ENTERPRISE_SUBNAV_COPY["de-CH"])).not.toContain("ß");
  });

  it("marks the last section whose top has reached the bars, nothing above the first", () => {
    expect(currentSection([["crawler", 400], ["features", 1800], ["api", 3000], ["security", 4000]])).toBe(null);
    expect(currentSection([["crawler", 112], ["features", 1500], ["api", 2700], ["security", 3700]])).toBe("crawler");
    // In the unnamed AI row between Features and API: Features stays lit.
    expect(currentSection([["crawler", -2000], ["features", -600], ["api", 500], ["security", 1500]])).toBe("features");
    expect(currentSection([["crawler", -5000], ["features", -3600], ["api", -2400], ["security", -900]])).toBe("security");
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
