// The "what the crawler checks" guide: it renders the capability list from the
// same array and gates as /site-crawler (no copy of its own), carries Article
// JSON-LD like every guide, closes on the crawler page, and is in the nav.
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({ rules: null as null | { family: string }[] }));
vi.mock("@/lib/crawl-rules", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/crawl-rules")>();
  return {
    ...real,
    get RULES() {
      return stub.rules ?? real.RULES;
    },
  };
});

import GuidePage, { generateMetadata } from "@/app/[locale]/learn/guides/[slug]/page";
import { PublicNav, navHrefs } from "@/app/[locale]/PublicNav";
import { RULES } from "@/lib/crawl-rules";
import { learnRoutes } from "@/lib/learn-content";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { visibleCapabilities } from "@/lib/site-crawler/marketing-copy";

const SLUG = "what-nosy-bat-checks";
const render = async (locale: string) =>
  renderToStaticMarkup(await GuidePage({ params: Promise.resolve({ locale, slug: SLUG }) }));
const listed = (html: string) => [...html.matchAll(/<li id="([a-z0-9-]+)"><strong>/g)].map((m) => m[1]);

afterEach(() => {
  stub.rules = null;
});

describe("the crawler guide", () => {
  it("is a registered learn route", () => {
    expect(learnRoutes()).toContain(`/learn/guides/${SLUG}`);
  });

  it("lists exactly the capabilities the public page shows", async () => {
    const html = await render("en");
    expect(listed(html)).toEqual(visibleCapabilities({ families: new Set(RULES.map((r) => r.family)) }).map((c) => c.id));
    expect(html).toContain("How to read a finding");
  });

  it("applies the same gates: a stub registry of response_codes only", async () => {
    stub.rules = [{ family: "response_codes" }];
    const ids = listed(await render("en"));
    expect(ids).toContain("response-codes");
    expect(ids).not.toContain("hreflang");
    expect(ids).toContain("csv-export");
  });

  it("carries Article JSON-LD and closes on /site-crawler", async () => {
    const html = await render("en");
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain('href="/en/site-crawler"');
  });

  it("has a French title and description, with the body in English", async () => {
    const html = await render("fr");
    expect(html).toContain(`Ce que ${CRAWLER_BRAND.name} vérifie`);
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "fr", slug: SLUG }) });
    expect(String((meta.title as { absolute: string }).absolute)).toContain(`Ce que ${CRAWLER_BRAND.name} vérifie`);
  });

  it("is in Resources > Learn, both locales", () => {
    expect(navHrefs()).toContain(`/learn/guides/${SLUG}`);
    expect(renderToStaticMarkup(createElement(PublicNav, { locale: "en" }))).toContain(`What ${CRAWLER_BRAND.name} checks`);
    expect(renderToStaticMarkup(createElement(PublicNav, { locale: "fr" }))).toContain(`Ce que ${CRAWLER_BRAND.name} vérifie`);
  });
});
