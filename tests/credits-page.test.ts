// tests/credits-page.test.ts
//
// The /credits page's wiring: that its cards come from the same catalogue the
// checkout and the webhook read, that /pricing links to it, that it is in the
// sitemap, and that both locales are covered.
//
// SINGLE SOURCE IS A PROPERTY, NOT A COMMENT. credit-packs.ts says four things
// must agree about which packs exist; this file is what makes that true rather
// than aspirational. Reading the page's source is deliberate — the alternative
// is rendering a React server component that wants a Stripe client and a
// session, which would test the mock rather than the wiring.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CREDIT_PACKS, allCreditPackLookupKeys } from "@/lib/credit-packs";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { COPY } from "@/app/[locale]/credits/copy";

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

const PAGE = read("src", "app", "[locale]", "credits", "page.tsx");
const COPY_SRC = read("src", "app", "[locale]", "credits", "copy.ts");
const PURCHASE = read("src", "app", "[locale]", "credits", "CreditsPurchase.tsx");
const PRICING = read("src", "app", "[locale]", "pricing", "page.tsx");
// The link moved here on 2026-08-17 so the HOMEPAGE grid carries it too — it
// previously had no route to /credits at all. Both surfaces render this one
// component, so this is now the file that has to hold the link.
const PRICING_SECTION = read("src", "app", "[locale]", "PricingSection.tsx");
const CONTENT = read("src", "lib", "i18n", "content.ts");
const CHECKOUT = read("src", "app", "api", "billing", "credits", "checkout", "route.ts");
const WEBHOOK = read("src", "lib", "billing", "credit-webhook.ts");

// ─── Single source ──────────────────────────────────────────────────────────

describe("the pack catalogue is a single source", () => {
  it("is the ONLY place a pack size is written down on a money path", () => {
    // A literal 100/500/2000 in the checkout or the webhook would be a second
    // definition of what the customer is charged or credited. Both must go
    // through credit-packs.ts.
    //
    // The PAGE and the COMPONENT are deliberately not scanned for bare numbers:
    // they are full of CSS ("100%", "760") that a \b100\b sweep flags as a
    // hardcoded pack. What matters for the UI is that it renders from
    // pricedPacks(), which the next test asserts directly.
    // HTTP status codes are stripped first: `{ status: 500 }` is not the 500
    // pack, and a sweep that cannot tell them apart fails on correct code.
    const strip = (src: string) => src.replace(/status:\s*\d{3}/g, "status: XXX");

    for (const [name, source] of [
      ["checkout route", strip(CHECKOUT)],
      ["webhook handler", strip(WEBHOOK)],
    ] as const) {
      for (const pack of CREDIT_PACKS) {
        expect(source, `${name} hardcodes the size ${pack.credits}`).not.toMatch(
          new RegExp(`\\b${pack.credits}\\b`),
        );
      }
    }
  });

  it("is the only place a lookup key is written down", () => {
    for (const [name, source] of [
      ["page", PAGE],
      ["checkout route", CHECKOUT],
      ["webhook handler", WEBHOOK],
    ] as const) {
      for (const key of allCreditPackLookupKeys()) {
        expect(source, `${name} hardcodes ${key}`).not.toContain(key);
      }
    }
  });

  it("renders its cards from pricedPacks(), which resolves the catalogue", () => {
    expect(PAGE).toContain("pricedPacks");
    expect(PAGE).toContain("@/lib/credits/pricing");
  });

  it("resolves the checkout price from the catalogue's key builder", () => {
    expect(CHECKOUT).toContain("creditPackLookupKey");
    expect(CHECKOUT).toContain("packForCredits");
  });

  it("resolves the credited amount from the catalogue, not the metadata", () => {
    expect(WEBHOOK).toContain("packForLookupKey");
  });

  it("holds no price anywhere in the page or the component", () => {
    // Prices come from Stripe at runtime. A "$79" in the source is the drift
    // this arrangement exists to prevent.
    for (const source of [PAGE, PURCHASE, COPY_SRC]) {
      expect(source).not.toMatch(/\$\s?\d+/);
    }
  });
});

// ─── The pricing-page link ──────────────────────────────────────────────────

describe("the pricing grid links to /credits", () => {
  it("carries exactly one link, not a fourth card", () => {
    expect(PRICING_SECTION).toContain("/credits");
    // One link to /credits. More than one would mean a card crept in.
    const links = PRICING_SECTION.match(/\/\$\{locale\}\/credits/g) ?? [];
    expect(links).toHaveLength(1);
  });

  it("no longer duplicates the link on /pricing itself", () => {
    // Two copies of this line, one per surface, is how the wording drifts.
    expect(PRICING).not.toMatch(/\/credits["`]/);
  });

  it("does not add /credits to the plan card catalogue", () => {
    // The cards come from pricingTiers(); a pack must never appear among them.
    expect(PRICING_SECTION).not.toMatch(/pricing\.map[\s\S]{0,400}credits/);
  });

  it("labels the link in every marketing locale", () => {
    // Five locales in HOME_PRICING_CHROME, which both surfaces read.
    const labels = CONTENT.match(/creditsLine:\s*"([^"]+)"/g) ?? [];
    expect(labels).toHaveLength(5);
  });

  it("says the packs never expire, in every locale", () => {
    // The part customers actually ask about before buying capacity.
    const NEVER_EXPIRE = [/never expire/, /sans expiration/, /ohne Verfall/];
    const labels = CONTENT.match(/creditsLine:\s*"([^"]+)"/g) ?? [];
    for (const label of labels) {
      expect(NEVER_EXPIRE.some((re) => re.test(label)), label).toBe(true);
    }
  });
});

// ─── Sitemap ────────────────────────────────────────────────────────────────

describe("sitemap", () => {
  it("registers /credits once", () => {
    const rows = LOCALIZED_ROUTES.filter((r) => r.path === "/credits");
    expect(rows).toHaveLength(1);
  });

  it("ranks it below the pages that sell the plan itself", () => {
    const credits = LOCALIZED_ROUTES.find((r) => r.path === "/credits")!;
    const pricing = LOCALIZED_ROUTES.find((r) => r.path === "/pricing")!;
    expect(credits.priority).toBeLessThan(pricing.priority);
  });
});

// ─── Locale coverage ────────────────────────────────────────────────────────

describe("locale coverage", () => {
  const LOCALES = ["en", "fr"] as const;

  it("covers every string in both locales", () => {
    for (const locale of LOCALES) {
      const c = COPY[locale];
      for (const [key, value] of Object.entries(c)) {
        if (key === "faq") continue;
        expect(typeof value, `${locale}.${key}`).toBe("string");
        expect((value as string).length, `${locale}.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("asks the same FAQ questions in both locales", () => {
    expect(COPY.en.faq).toHaveLength(COPY.fr.faq.length);
    for (const locale of LOCALES) {
      for (const item of COPY[locale].faq) {
        expect(item.q.length).toBeGreaterThan(0);
        expect(item.a.length).toBeGreaterThan(0);
      }
    }
  });

  it("states the three facts the brief requires, in both locales", () => {
    // never expire · one-time not a subscription · spent by the Agency scanner
    expect(COPY.en.faq.map((f) => f.q).join(" ")).toMatch(/expire/i);
    expect(COPY.en.faq.map((f) => f.q).join(" ")).toMatch(/subscription/i);
    expect(COPY.en.faq.map((f) => f.a).join(" ")).toMatch(/Opportunity Scanner/i);

    expect(COPY.fr.faq.map((f) => f.q).join(" ")).toMatch(/expirent/i);
    expect(COPY.fr.faq.map((f) => f.q).join(" ")).toMatch(/abonnement/i);
    expect(COPY.fr.faq.map((f) => f.a).join(" ")).toMatch(/Scanner d'opportunit/i);
  });

  it("never uses CamelCase branding", () => {
    expect(JSON.stringify(COPY)).not.toContain("EchoRank");
  });
});

// ─── The CTA-rule exception is documented ───────────────────────────────────

describe("the CTA exception", () => {
  it("is called out in the page header so a CTA sweep does not 'fix' it", () => {
    // Every other marketing CTA routes to /pricing. These buttons ARE the
    // checkout, and a future sweep that redirects them breaks the only way to
    // buy a pack. The note is the guard rail.
    expect(PAGE).toMatch(/EXCEPTION TO THE CTA RULE/i);
  });

  it("posts to the credit checkout rather than linking to /pricing", () => {
    expect(PURCHASE).toContain("/api/billing/credits/checkout");
    // A LINK to /pricing, not the substring: "@/lib/credits/pricing" is an
    // import and the header comment names /pricing to explain why it is not
    // used. Matching either would fail on the explanation of the rule.
    expect(PURCHASE).not.toMatch(/href=[{"'`][^"'`]*\/pricing/);
    expect(PURCHASE).not.toMatch(/location\.href\s*=\s*[^;]*\/pricing/);
  });

  it("sends a signed-out visitor to sign in and come back", () => {
    expect(PURCHASE).toContain("/login?next=");
  });
});
