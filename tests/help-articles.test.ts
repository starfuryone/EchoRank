// Public help articles — config integrity, route table, and the ONE-SOURCE
// guarantee this feature exists to give.
//
// Modelled on tests/learn-content.test.ts. The failures it prevents, in order
// of how much they would cost:
//
//  1. Four surfaces answering "how do I cancel" four different ways. Every
//     assertion about copy below reads src/lib/help-articles.ts and compares it
//     to what a surface renders — none of them retypes a sentence, because a
//     hand-kept expectation drifts exactly the way the thing it guards does.
//  2. An article in the sitemap with no page behind it, or the reverse.
//  3. The locale-less /help/<slug> falling through the proxy's auth gate to
//     /login instead of 308ing onto /en/<slug> — which is what happens the day
//     someone adds an article without registering its route.
//  4. A step illustration that has quietly stopped matching the product: the
//     SVGs draw a real plan price, and they cannot read PLAN_CONFIGS.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HELP_ARTICLES,
  HELP_ARTICLE_BASE,
  HELP_STEP_IMAGES,
  helpArticleBySlug,
  helpArticleCopy,
  helpArticleHref,
  helpArticlePath,
  helpArticleRoutes,
  helpArticlesByCategory,
  helpBaseOf,
  type HelpBase,
} from "@/lib/help-articles";
import type { LearnBlock } from "@/lib/learn-content";
import { KNOWN_MARKETING_PATHS, LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { PLAN_PRICES } from "@/lib/plan-config";
import { FAQ } from "@/app/[locale]/faq-data";
import { BILLING_COPY } from "@/lib/i18n/dashboard";
import { inline, plainText, resolveHref } from "@/app/[locale]/learn/_shared/inline";

/** What a surface actually paints for one authored string. */
const render = (text: string, locale: string) =>
  renderToStaticMarkup(createElement(Fragment, null, ...inline(text, locale, "t")));

const ROOT = process.cwd();
const BASES: HelpBase[] = ["en", "fr"];
const CANCEL = "cancel-subscription";

/** Every authored string in a body, whatever block carries it. */
function bodyText(body: readonly LearnBlock[]): string[] {
  const out: string[] = [];
  for (const b of body) {
    if (b.k === "p" || b.k === "h2" || b.k === "h3" || b.k === "code") out.push(b.t);
    if (b.k === "ul" || b.k === "ol") out.push(...b.items);
    if (b.k === "steps") out.push(...b.items.map((i) => i.t));
    if (b.k === "quote") out.push(...b.paras);
    if (b.k === "table") out.push(...b.head, ...b.rows.flat());
  }
  return out;
}

function bodyLinks(body: readonly LearnBlock[]): string[] {
  return [...bodyText(body).join("\n").matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]);
}

describe("config integrity", () => {
  it("has at least one article, with unique slugs", () => {
    expect(HELP_ARTICLES.length).toBeGreaterThan(0);
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every article a real title, description, body and reading time", () => {
    for (const a of HELP_ARTICLES) {
      expect(a.slug).toMatch(/^[a-z0-9-]+$/);
      expect(a.readingTime).toBeGreaterThan(0);
      for (const base of BASES) {
        const c = a.copy[base];
        expect(c.title.trim().length, `${a.slug} ${base} title`).toBeGreaterThan(0);
        expect(c.description.trim().length, `${a.slug} ${base} description`).toBeGreaterThan(0);
        expect(c.body.length, `${a.slug} ${base} body`).toBeGreaterThan(0);
        expect(c.faq.q.trim().length, `${a.slug} ${base} faq.q`).toBeGreaterThan(0);
        expect(c.faq.a.trim().length, `${a.slug} ${base} faq.a`).toBeGreaterThan(0);
        expect(c.blurb.trim().length, `${a.slug} ${base} blurb`).toBeGreaterThan(0);
      }
    }
  });

  it("carries exactly the two body catalogs the locale model has", () => {
    // en/fr, folded by helpBaseOf. A third catalog would be unreachable code —
    // the same rule the dashboard, marketing and pricing catalogs each state.
    for (const a of HELP_ARTICLES) {
      expect(Object.keys(a.copy).sort()).toEqual(["en", "fr"]);
    }
    expect(helpBaseOf("fr")).toBe("fr");
    expect(helpBaseOf("fr-CA")).toBe("fr");
    expect(helpBaseOf("en-CA")).toBe("en");
    expect(helpBaseOf("de-CH")).toBe("en");
  });

  it("keeps the two locales structurally identical", () => {
    // Not a translation check — a SHAPE check. A French body that lost a step
    // or a heading is a French customer following four steps out of five.
    for (const a of HELP_ARTICLES) {
      const [en, fr] = [a.copy.en.body, a.copy.fr.body];
      expect(fr.map((b) => b.k), a.slug).toEqual(en.map((b) => b.k));
      for (let i = 0; i < en.length; i++) {
        const [e, f] = [en[i], fr[i]];
        if (e.k === "ul" && f.k === "ul") expect(f.items.length, `${a.slug} ul#${i}`).toBe(e.items.length);
        if (e.k === "steps" && f.k === "steps") {
          expect(f.items.length, `${a.slug} steps#${i}`).toBe(e.items.length);
          // Same illustration under the same step in both languages: the
          // drawings are schematic, not screenshots of a localized UI.
          expect(f.items.map((s) => s.img?.src)).toEqual(e.items.map((s) => s.img?.src));
        }
      }
    }
  });

  it("gives every illustrated step localized alt text", () => {
    for (const a of HELP_ARTICLES) {
      for (const base of BASES) {
        for (const b of a.copy[base].body) {
          if (b.k !== "steps") continue;
          for (const step of b.items) {
            if (!step.img) continue;
            expect(step.img.alt.trim().length, `${a.slug} ${base} alt`).toBeGreaterThan(0);
          }
        }
      }
    }
    // …and the two languages must not have ended up with the SAME alt text,
    // which is what "localized" quietly degrades into when nobody checks.
    const alts = (base: HelpBase) =>
      helpArticleCopy(helpArticleBySlug(CANCEL)!, base)
        .body.flatMap((b) => (b.k === "steps" ? b.items : []))
        .map((s) => s.img?.alt)
        .filter(Boolean);
    expect(alts("fr")).not.toEqual(alts("en"));
  });

  it("says Echorank, never camel-case, in either language", () => {
    for (const a of HELP_ARTICLES) {
      const text = JSON.stringify(a.copy);
      const offenders = [...new Set((text.match(/echo[\s-]*rank/gi) ?? []) as string[])].filter(
        (m) => !["Echorank", "ECHORANK", "echorank"].includes(m),
      );
      expect(offenders, a.slug).toEqual([]);
    }
  });
});

describe("route table", () => {
  it("registers every article in the SEO registry", () => {
    const registered = new Set(LOCALIZED_ROUTES.map((r) => r.path));
    for (const path of helpArticleRoutes()) {
      expect(registered.has(path), `${path} missing from LOCALIZED_ROUTES`).toBe(true);
    }
  });

  it("puts every article in the proxy's locale guard", () => {
    // Without this the locale-less "/help/cancel-subscription" reaches the auth
    // gate and 307s to /login — a public support page behind a login wall.
    for (const path of helpArticleRoutes()) {
      expect(KNOWN_MARKETING_PATHS.includes(path), `${path} missing from the locale guard`).toBe(
        true,
      );
    }
  });

  it("has a page file behind the route", () => {
    expect(
      existsSync(join(ROOT, "src", "app", "[locale]", "help", "[slug]", "page.tsx")),
    ).toBe(true);
  });

  it("is indexable — not in robots' disallow list", async () => {
    const { default: robots } = await import("@/app/robots");
    const disallowed = robots().rules;
    const rules = Array.isArray(disallowed) ? disallowed : [disallowed];
    for (const rule of rules) {
      const dis = [rule.disallow ?? []].flat();
      for (const path of helpArticleRoutes()) {
        expect(dis.some((d) => path.startsWith(d)), `${path} disallowed`).toBe(false);
      }
    }
  });

  it("locale-prefixes the article href for every supported locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(helpArticleHref(locale, CANCEL)).toBe(`/${locale}${HELP_ARTICLE_BASE}/${CANCEL}`);
    }
  });

  it("localizes a /help/<slug> link in prose but never the in-app hub", () => {
    // "/help" with no slug is the auth-gated dashboard hub. Rewriting it to
    // "/en/help" would point every in-product help link at a 404.
    expect(resolveHref(helpArticlePath(CANCEL), "fr")).toBe(`/fr/help/${CANCEL}`);
    expect(resolveHref("/help", "fr")).toBe("/help");
  });

  it("points every in-article link at something that exists", () => {
    const registered = new Set(LOCALIZED_ROUTES.map((r) => r.path));
    for (const a of HELP_ARTICLES) {
      for (const base of BASES) {
        const copy = a.copy[base];
        for (const href of [...bodyLinks(copy.body), ...copy.related.map((r) => r.href)]) {
          const path = href.split("#")[0];
          expect(registered.has(path), `${a.slug} ${base}: ${href}`).toBe(true);
        }
      }
    }
  });
});

describe("one source, every surface", () => {
  const article = helpArticleBySlug(CANCEL)!;

  it("resolves the article by slug and by category", () => {
    expect(article).toBeDefined();
    expect(helpArticlesByCategory("billing").map((a) => a.slug)).toContain(CANCEL);
    expect(helpArticleBySlug("no-such-article")).toBeUndefined();
  });

  it("titles the article exactly as the brief specifies", () => {
    // The one literal in this file, because it is the deliverable: the SEO
    // title was named in the request and a rewrite of it is a regression.
    expect(article.copy.en.title).toBe("How to cancel your Echorank subscription");
  });

  it("puts the SAME short-form answer in the homepage FAQ, not a paraphrase", () => {
    for (const base of BASES) {
      const faq = helpArticleCopy(article, base).faq;
      const onPage = FAQ[base].items.find((i) => i.q === faq.q);
      expect(onPage, `${base}: cancellation Q&A missing from the homepage FAQ`).toBeDefined();
      expect(onPage!.a).toBe(faq.a);
    }
  });

  it("links the full article from the FAQ answer and from the hub blurb", () => {
    const path = helpArticlePath(CANCEL);
    for (const base of BASES) {
      const copy = helpArticleCopy(article, base);
      expect(copy.faq.a, `${base} faq`).toContain(`](${path})`);
      expect(copy.blurb, `${base} blurb`).toContain(`](${path})`);
    }
  });

  it("renders the FAQ answer as real markup, locale-prefixed, on the surface", () => {
    // The homepage is dynamically rendered (geo currency), so it never lands in
    // the build output as HTML — this is where its FAQ answer gets checked. The
    // failure it catches is a literal "[How to cancel](/help/…)" painted onto
    // the page, which is what happens the day the answer stops going through
    // inline().
    for (const [base, locale] of [
      ["en", "en"],
      ["fr", "fr-CA"],
    ] as const) {
      const html = render(helpArticleCopy(article, base).faq.a, locale);
      expect(html, locale).toContain(`href="/${locale}/help/${CANCEL}"`);
      expect(html, locale).toContain("<strong>");
      expect(html, locale).not.toContain("**");
      expect(html, locale).not.toContain("](");
    }
  });

  it("renders the hub blurb the same way", () => {
    for (const [base, locale] of [
      ["en", "en"],
      ["fr", "fr"],
    ] as const) {
      const html = render(helpArticleCopy(article, base).blurb, locale);
      expect(html, locale).toContain(`href="/${locale}/help/${CANCEL}"`);
      expect(html, locale).not.toContain("**");
    }
  });

  it("keeps the FAQ answer readable once its markup is stripped", () => {
    // What ships in the FAQPage rich result. Asterisks and bracket syntax there
    // are published to the search page.
    for (const base of BASES) {
      const plain = plainText(helpArticleCopy(article, base).faq.a);
      expect(plain).not.toMatch(/[*`]|\]\(/);
      expect(plain.length).toBeGreaterThan(80);
    }
  });

  it("gives the Billing page a link label in all three dashboard locales", () => {
    // The ANSWER is never restated in the dashboard catalog — only the four
    // words that get someone to it, which is why this checks the label exists
    // and that the catalog does NOT carry the article's prose.
    for (const locale of ["en", "fr", "de-CH"] as const) {
      const label = BILLING_COPY[locale].cancellationHelp;
      expect(label.trim().length, locale).toBeGreaterThan(0);
      expect(JSON.stringify(BILLING_COPY[locale])).not.toContain(article.copy.en.faq.a);
    }
    expect(BILLING_COPY["de-CH"].cancellationHelp).not.toMatch(/ß/);
  });
});

describe("the Billing page's inline link", () => {
  const dir = join(ROOT, "src", "app", "(dashboard)", "billing");
  const server = readFileSync(join(dir, "page.tsx"), "utf8");
  const client = readFileSync(join(dir, "page-client.tsx"), "utf8");

  it("resolves the href server-side and passes it down", () => {
    // Not a style preference. help-content.ts reads the whole Knowledge Hub
    // config to build the /help hub; importing it across the "use client"
    // boundary would ship the course prose to the browser for one href.
    expect(server).toContain('helpArticleSlugFor("/billing")');
    expect(server).toContain("cancelHelpHref=");
    expect(client).not.toContain("@/lib/help-content");
  });

  it("renders the link beside Manage subscription, not somewhere else", () => {
    // A source scan, and it proves proximity in the SOURCE rather than on
    // screen — which is the part that actually drifts. If the two ever end up
    // in different cards this fails and someone re-reads the requirement.
    const button = client.indexOf("t.manageSubscription}");
    const link = client.indexOf("t.cancellationHelp}");
    expect(button, "Manage subscription button not found").toBeGreaterThan(-1);
    expect(link, "cancellation help link not found").toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(button);
    expect(client.slice(button, link)).not.toContain("</Card>");
  });

  it("opens the public article in a new tab, safely", () => {
    // It is a marketing-side page; a same-tab navigation would drop someone
    // out of the dashboard in the middle of cancelling.
    const near = client.slice(client.indexOf("cancelHelpHref &&"), client.indexOf("t.cancellationHelp}"));
    expect(near).toContain('target="_blank"');
    expect(near).toContain('rel="noopener noreferrer"');
  });
});

describe("step illustrations", () => {
  const files = HELP_STEP_IMAGES.map((src) => ({ src, file: join(ROOT, "public", src) }));

  it("ships every image the article references", () => {
    expect(files.length).toBe(4);
    for (const { src, file } of files) {
      expect(existsSync(file), `${src} is not in public/`).toBe(true);
    }
  });

  it("draws them on one shared canvas, so the column does not jump", () => {
    // The CSS reserves a 640x360 box before the file lands. An asset drawn to a
    // different viewBox would letterbox inside it.
    for (const { src, file } of files) {
      expect(readFileSync(file, "utf8"), src).toContain('viewBox="0 0 640 360"');
    }
  });

  it("still draws the price the plan config charges", () => {
    // THE ONE HARD-CODED PRICE IN THIS FEATURE. An SVG cannot read
    // PLAN_CONFIGS, so a Starter price change silently leaves the walkthrough
    // showing last quarter's number — the Jul 31 structured-data incident in
    // picture form. This test is the tripwire: when it fails, re-cut the
    // illustrations, do not relax the assertion.
    const drawn = files
      .map(({ file }) => readFileSync(file, "utf8"))
      .join("\n")
      .match(/\$\d+(?:\.\d\d)?/g);
    expect(drawn, "no price found in the illustrations").toBeTruthy();
    const expected = new Set([`$${PLAN_PRICES.STARTER}`, `$${PLAN_PRICES.STARTER}.00`]);
    for (const price of new Set(drawn!)) {
      expect(expected.has(price), `illustrations show ${price}, config says $${PLAN_PRICES.STARTER}`).toBe(
        true,
      );
    }
  });

  it("says Echorank, never camel-case, inside the drawings", () => {
    for (const { src, file } of files) {
      const offenders = [
        ...new Set((readFileSync(file, "utf8").match(/echo[\s-]*rank/gi) ?? []) as string[]),
      ].filter((m) => !["Echorank", "ECHORANK", "echorank"].includes(m));
      expect(offenders, src).toEqual([]);
    }
  });
});
