// The /use-cases goal page.
//
// The assertion that earns its keep is the href one: every card is checked
// against the sitemap registry, not against a hand-kept list in this file. A
// goal page whose cards 404 is worse than no goal page — it is the screen a
// visitor reaches precisely because they do not yet know their way around, and
// a dead card there reads as a broken product.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import UseCases, { generateMetadata, useCaseHrefs } from "@/app/[locale]/use-cases/page";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/use-cases",
  useRouter: () => ({ push: () => {} }),
}));

async function page(locale: string): Promise<string> {
  return renderToStaticMarkup(await UseCases({ params: Promise.resolve({ locale }) }));
}

const KNOWN = new Set(LOCALIZED_ROUTES.map((r) => r.path));

describe("every card links somewhere that exists", () => {
  it("resolves each card href to a registered route or a homepage anchor", () => {
    for (const href of useCaseHrefs()) {
      if (href.startsWith("#")) {
        // Homepage anchors are not routes; "" is the homepage entry.
        expect(KNOWN.has("")).toBe(true);
        continue;
      }
      // "/ai-visibility#audit" -> "/ai-visibility"
      const path = href.split("#")[0];
      expect(KNOWN.has(path), `${href} is not a registered route`).toBe(true);
    }
  });

  it("never sends an anonymous visitor to a paid dashboard route", () => {
    // /visibility/tools/* is authenticated and plan-gated; a card pointing
    // there bounces the reader off the gate.
    for (const href of useCaseHrefs()) {
      expect(href.startsWith("/visibility")).toBe(false);
      expect(href.startsWith("/dashboard")).toBe(false);
    }
  });

  it("renders eight goal cards", () => {
    expect(useCaseHrefs()).toHaveLength(8);
  });
});

describe("renders per locale", () => {
  it("returns markup in every supported locale", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const html = await page(locale);
      expect(html.length).toBeGreaterThan(1000);
      // Eight goal cards + three size columns, all locale-prefixed.
      const links = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
      const cards = links.filter((h) => h.startsWith(`/${locale}`));
      expect(cards.length).toBeGreaterThanOrEqual(11);
    }
  });

  it("translates the heading rather than falling back to English", async () => {
    expect(await page("en")).toContain("What do you want to achieve?");
    expect(await page("fr")).toContain("Que voulez-vous accomplir");
    expect(await page("de-CH")).toContain("Was möchten Sie erreichen?");
  });

  it("folds en-CA to English and fr-CA to French", async () => {
    expect(await page("en-CA")).toContain("What do you want to achieve?");
    expect(await page("fr-CA")).toContain("Que voulez-vous accomplir");
  });

  it("uses ss and never ß in the de-CH body", async () => {
    expect(await page("de-CH")).not.toContain("ß");
  });

  it("carries per-locale metadata and canonical", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const meta = await generateMetadata({ params: Promise.resolve({ locale }) });
      expect(String(meta.alternates?.canonical)).toContain(`/${locale}/use-cases`);
      expect(meta.title).toBeTruthy();
    }
  });

  it("is registered for the sitemap", () => {
    expect(KNOWN.has("/use-cases")).toBe(true);
  });
});
