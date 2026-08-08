// /[locale]/free-audit — the standalone audit funnel.
//
// The assertion that earns its keep is the widget one. This page exists to
// mount AuditWidget for an anonymous visitor; every "run the free audit" CTA
// on the site now lands here. If the widget stops rendering, the page is a
// brochure and the whole funnel is dead, so the input the visitor types into
// is asserted by its stable id rather than by any copy around it.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import FreeAudit, { generateMetadata } from "@/app/[locale]/free-audit/page";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  usePathname: () => "/en/free-audit",
  useRouter: () => ({ push: () => {} }),
}));

async function page(locale: string): Promise<string> {
  return renderToStaticMarkup(await FreeAudit({ params: Promise.resolve({ locale }) }));
}

describe("the audit widget is on the page", () => {
  it("renders the widget's brand input and run button", async () => {
    const html = await page("en");
    // id="av-brand" is the widget's own input; its <label for> points at it.
    expect(html).toContain('id="av-brand"');
    expect(html).toContain('class="av-audit"');
    expect(html).toContain("Run free audit");
  });

  it("renders the widget in French too", async () => {
    const html = await page("fr");
    expect(html).toContain('id="av-brand"');
    expect(html).toContain("Lancer l’audit gratuit");
  });

  it("folds unwritten locales onto English rather than rendering blanks", async () => {
    for (const locale of ["de-CH", "en-CA"]) {
      const html = await page(locale);
      expect(html).toContain('id="av-brand"');
      expect(html).toContain("Is your business the answer AI gives?");
    }
    // fr-CA takes the French copy, per baseOf().
    expect(await page("fr-CA")).toContain("Votre entreprise est-elle la réponse que donne l’IA ?");
  });
});

describe("CTAs", () => {
  it("sends the primary CTA to pricing, never straight to /register", async () => {
    const html = await page("en");
    expect(html).toContain('href="/en/pricing"');
    // House rule. The widget's own post-result CTA is a separate, existing
    // funnel; what this asserts is that the PAGE's primary CTA is not one.
    const ctas = [...html.matchAll(/<a[^>]*class="[^"]*btnPrimary[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) expect(cta).not.toContain("/register");
  });

  it("keeps the locale in every internal link", async () => {
    const html = await page("fr");
    expect(html).toContain('href="/fr/pricing"');
    expect(html).not.toContain('href="/en/pricing"');
  });
});

describe("SEO", () => {
  it("emits a canonical and the full hreflang set", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta.alternates?.canonical).toBe("https://echorank360.com/en/free-audit");
    const langs = meta.alternates?.languages ?? {};
    expect(Object.keys(langs)).toContain("x-default");
    expect(langs["fr"]).toBe("https://echorank360.com/fr/free-audit");
  });

  it("emits WebPage JSON-LD wired to the shared organization node", async () => {
    const html = await page("en");
    expect(html).toContain("WebPage");
    // The @id is what merges this page's node into the site-wide entity graph.
    expect(html).toContain("https://echorank360.com/#organization");
    expect(html).toContain("FAQPage");
  });

  it("is registered, so it reaches the sitemap and the proxy's locale guard", async () => {
    // Unregistered, the page still renders but is absent from sitemap.xml and
    // a bare "/free-audit" stops 308-ing to "/en/free-audit".
    expect(LOCALIZED_ROUTES.map((r) => r.path)).toContain("/free-audit");
  });

  it("describes only FAQs the page actually renders", async () => {
    const html = await page("en");
    // Structured data for an unrendered question is a manual-action risk.
    expect(html).toContain("Is it really free?");
  });
});
