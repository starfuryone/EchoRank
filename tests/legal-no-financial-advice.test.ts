// The No Financial Advice Disclaimer: it renders in both languages, it is
// reachable from the two documents that reference it, and — the constraint that
// actually matters — it is NOT a consent document.
//
// Adding it to CONSENT_DOCUMENTS would invalidate every consent already on
// record and force every existing buyer to re-accept, because checkConsent()
// requires every configured id. The last two assertions are what stop that
// happening by accident.
import { describe, expect, it, vi } from "vitest";

// BackButton is a client component reading the router; the legal pages all
// render it, so it needs the same stub nav-links.test.ts uses.
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/legal/terms",
  useRouter: () => ({ back: () => {}, push: () => {} }),
}));
import { renderToStaticMarkup } from "react-dom/server";
import Nfa from "@/app/[locale]/legal/no-financial-advice/page";
import Terms from "@/app/[locale]/legal/terms/page";
import Sub from "@/app/[locale]/legal/subscription-agreement/page";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { CONSENT_DOCUMENT_IDS } from "@/lib/consent-config";

const render = async (P: (a: { params: Promise<{ locale: string }> }) => Promise<React.ReactElement>, l: string) =>
  renderToStaticMarkup(await P({ params: Promise.resolve({ locale: l }) }));

describe("no-financial-advice", () => {
  it("renders EN and FR bodies", async () => {
    expect(await render(Nfa as never, "en")).toContain("No Professional Advice");
    expect(await render(Nfa as never, "fr")).toContain("Absence de conseil professionnel");
  });
  it("is in the sitemap", () => {
    expect(LOCALIZED_ROUTES.some((r) => r.path === "/legal/no-financial-advice")).toBe(true);
  });
  it("is NOT a consent document, and the set is still four", () => {
    expect(CONSENT_DOCUMENT_IDS).toHaveLength(4);
    expect(CONSENT_DOCUMENT_IDS as readonly string[]).not.toContain("no_financial_advice");
  });
  it("is linked from the Subscription Agreement intro and section 9", async () => {
    const html = await render(Sub as never, "en");
    const links = [...html.matchAll(/href="\/en\/legal\/no-financial-advice"/g)];
    expect(links).toHaveLength(2);
    expect(html).toContain("See also our");
  });
  it("is linked from the Terms disclaimer section, EN and FR", async () => {
    expect(await render(Terms as never, "en")).toContain('href="/en/legal/no-financial-advice"');
    const fr = await render(Terms as never, "fr");
    expect(fr).toContain('href="/fr/legal/no-financial-advice"');
    expect(fr).toContain("conseil financier");
  });
});
