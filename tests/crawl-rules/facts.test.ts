// tests/crawl-rules/facts.test.ts — the HTML → PageFacts extractor on its own.

import { describe, expect, it } from "vitest";
import { doc, page } from "./harness";
import { parseJsonLd, rawStructure } from "@/lib/site-crawler/facts";

describe("extractHtmlFacts", () => {
  const html = doc(
    `<title> Hello  world </title><meta name="description" content="Desc"><link rel="canonical" href="/page">
     <meta name="robots" content="NOINDEX"><meta name="googlebot" content="nosnippet">
     <link rel="alternate" hreflang="FR" href="/fr/page"><link rel="next" href="?p=2">
     <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"A","url":"https://a"}]}</script>`,
    `<svg><title>icon</title></svg><h3>early</h3><h1>One</h1><h2>Two</h2>
     <p>Some words here.</p><a href="/x#frag" rel="NoFollow">Read more</a><a href="https://other.org/">ext</a>
     <a href="mailto:a@b.c">mail</a>
     <picture><source type="image/webp" srcset="a.webp"><img src="a.jpg" alt="" width="800" loading="lazy"></picture>
     <img src="b.png"><form action="http://example.com/post"></form>
     <div itemscope itemtype="https://schema.org/Product"><span itemprop="name">P</span></div><span itemprop="stray"></span>`,
  );
  const f = page(html).html!;

  it("reads head fields, ignoring svg titles", () => {
    expect(f.titles).toEqual(["Hello world"]);
    expect(f.titlesOutsideHead).toBe(0);
    expect(f.metaDescriptions).toEqual(["Desc"]);
    expect(f.canonicals).toEqual(["/page"]);
    expect(f.metaRobots).toBe("noindex, nosnippet");
    expect(f.hreflang).toEqual([{ lang: "fr", href: "https://example.com/fr/page" }]);
    expect(f.relNext).toEqual(["https://example.com/page?p=2"]);
    expect(f.charset).toBe("utf-8");
    expect(f.hasViewport).toBe(true);
    expect(f.langAttr).toBe("en");
  });

  it("reads headings, anchors, images, forms", () => {
    expect(f.h1).toEqual(["One"]);
    expect(f.h3BeforeH2).toBe(true);
    expect(f.anchors.map((a) => [a.href, a.internal, a.rel])).toEqual([
      ["https://example.com/x", true, "nofollow"],
      ["https://other.org/", false, ""],
      ["mailto:a@b.c", false, ""],
    ]);
    expect(f.images[0]).toMatchObject({ alt: "", width: 800, loading: "lazy", hasSrcset: true, modernSource: true });
    expect(f.images[1]).toMatchObject({ alt: null, hasWidth: false, hasSrcset: false, modernSource: false });
    expect(f.formActions).toEqual(["http://example.com/post"]);
  });

  it("reads structured data", () => {
    expect(f.jsonLd[0]!.ok).toBe(true);
    expect(f.jsonLd[0]!.items).toEqual([{ type: "Organization", vocabulary: "https://schema.org", props: ["name", "url"] }]);
    expect(f.microdata).toEqual([{ itemtype: "https://schema.org/Product", props: ["name"] }]);
    expect(f.orphanItemprops).toBe(1);
    expect(parseJsonLd("{oops").ok).toBe(false);
  });

  it("finds elements the parser moves out of <head>", () => {
    const g = page(`<html><head></head><body><title>late</title><link rel="canonical" href="/x"></body></html>`).html!;
    expect(g.titlesOutsideHead).toBe(1);
    expect(g.canonicalsOutsideHead).toBe(1);
  });
});

describe("rawStructure", () => {
  it("sees what the parser would repair", () => {
    expect(rawStructure("<!doctype html><html><head><title>t</title></head><body></body></html>")).toEqual({
      hasDoctype: true,
      htmlTagCount: 1,
      headTagCount: 1,
      bodyTagCount: 1,
      bodyBeforeHead: false,
      headIsFirstChild: true,
      invalidHeadElements: [],
    });
    const bad = rawStructure("<html><body></body><head><div>x</div><script>if(a<b){}</script></head><body></body></html>");
    expect(bad).toMatchObject({ hasDoctype: false, bodyTagCount: 2, bodyBeforeHead: true, headIsFirstChild: false, invalidHeadElements: ["div"] });
  });

  it("does not count <header> as <head>", () => {
    expect(rawStructure("<!doctype html><html><head></head><body><header></header></body></html>").headTagCount).toBe(1);
  });
});
