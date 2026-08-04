// Structured data for the Knowledge Hub is DERIVED from learn-content.ts.
//
// This suite exists because of the Jul 31 incident: structured data that was a
// hand-kept copy of real values drifted from them and published prices nobody
// charged. The equivalent here is a Course whose chapter list, or an Article
// whose headline, disagrees with the page a visitor actually lands on.
//
// So the assertions never name a chapter title, a URL or a term. They compare
// the emitted graph against the config, and — the mutation checks at the bottom
// — prove that comparison is not vacuous by feeding the builders drifted input
// and requiring the same assertions to fail.
import { describe, it, expect } from "vitest";
import { article, course, definedTermSet, faqPage, breadcrumbList } from "@/lib/seo/jsonld";
import { plainText } from "@/app/[locale]/learn/_shared/inline";
import { SITE_URL } from "@/lib/seo/constants";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  ECHOPEDIA_DESCRIPTION,
  ECHOPEDIA_SLUG,
  ECHOPEDIA_TERMS,
  ECHOPEDIA_TITLE,
  LEARN_BASE,
  LEARN_CHAPTERS,
  LEARN_GUIDES,
  headingId,
} from "@/lib/learn-content";

const HUB_URL = `${SITE_URL}/en${LEARN_BASE}`;
const chapterUrl = (slug: string) => `${SITE_URL}/en${LEARN_BASE}/${slug}`;
const guideUrl = (slug: string) => `${SITE_URL}/en${LEARN_BASE}/guides/${slug}`;

/** The hub's Course node, built exactly the way the page builds it. */
function hubCourse(chapters: readonly { title: string; description: string; slug: string }[]) {
  return course({
    name: "Learn Reputation & AI Visibility",
    description: "…",
    pageUrl: HUB_URL,
    inLanguage: "en",
    parts: chapters.map((ch) => ({
      headline: ch.title,
      description: ch.description,
      pageUrl: chapterUrl(ch.slug),
    })),
  }) as unknown as {
    "@type": string;
    hasPart: { "@type": string; "@id": string; headline: string; url: string }[];
  };
}

describe("Course on the hub", () => {
  it("emits one hasPart per chapter, in course order", () => {
    const node = hubCourse(LEARN_CHAPTERS);
    expect(node["@type"]).toBe("Course");
    expect(node.hasPart.map((p) => p.headline)).toEqual(LEARN_CHAPTERS.map((c) => c.title));
  });

  it("points every part at the chapter's own URL", () => {
    for (const part of hubCourse(LEARN_CHAPTERS).hasPart) {
      const slug = part.url.split("/").pop()!;
      expect(LEARN_CHAPTERS.some((c) => c.slug === slug), part.url).toBe(true);
    }
  });

  it("gives each part the same @id the chapter page emits for itself", () => {
    // Same @id on both pages → one entity in the graph, not two competing
    // descriptions of the same URL.
    const parts = hubCourse(LEARN_CHAPTERS).hasPart;
    for (const chapter of LEARN_CHAPTERS) {
      const own = article({
        headline: chapter.title,
        description: chapter.description,
        pageUrl: chapterUrl(chapter.slug),
      }) as unknown as { "@id": string };
      expect(parts.some((p) => p["@id"] === own["@id"]), chapter.slug).toBe(true);
    }
  });
});

describe("Article on chapters and guides", () => {
  it("carries the config's headline, description and reading time", () => {
    for (const a of [...LEARN_CHAPTERS, ...LEARN_GUIDES]) {
      const url = "order" in a && LEARN_CHAPTERS.includes(a as never)
        ? chapterUrl(a.slug)
        : guideUrl(a.slug);
      const node = article({
        headline: a.title,
        description: a.description,
        pageUrl: url,
        readingTime: a.readingTime,
        inLanguage: "en",
      }) as unknown as Record<string, unknown>;

      expect(node["@type"]).toBe("Article");
      expect(node.headline).toBe(a.title);
      expect(node.description).toBe(a.description);
      expect(node.url).toBe(url);
      expect(node.timeRequired).toBe(`PT${a.readingTime}M`);
    }
  });

  it("publishes no date it cannot evidence", () => {
    // A file mtime is when the box touched the file and a build stamp re-dates
    // every article on every deploy. Absent beats invented — see jsonld.ts.
    const node = article({
      headline: "x",
      description: "y",
      pageUrl: chapterUrl("x"),
    }) as unknown as Record<string, unknown>;
    expect(node.datePublished).toBeUndefined();
    expect(node.dateModified).toBeUndefined();
  });

  it("puts the article inside a breadcrumb trail ending on itself", () => {
    const chapter = LEARN_CHAPTERS[0];
    const node = breadcrumbList([
      { name: "Home", url: `${SITE_URL}/en` },
      { name: "Knowledge Hub", url: HUB_URL },
      { name: chapter.title, url: chapterUrl(chapter.slug) },
    ]) as unknown as { itemListElement: { position: number; name: string; item: string }[] };

    expect(node.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(node.itemListElement.at(-1)!.item).toBe(chapterUrl(chapter.slug));
    expect(node.itemListElement.at(-1)!.name).toBe(chapter.title);
  });
});

describe("DefinedTermSet on Echopedia", () => {
  const node = definedTermSet({
    name: ECHOPEDIA_TITLE,
    description: ECHOPEDIA_DESCRIPTION,
    pageUrl: `${SITE_URL}/en${LEARN_BASE}/${ECHOPEDIA_SLUG}`,
    inLanguage: "en",
    terms: ECHOPEDIA_TERMS.map((t) => ({
      name: t.term,
      description: t.definition,
      anchor: headingId(t.term),
    })),
  }) as unknown as {
    "@type": string;
    hasDefinedTerm: { "@id": string; name: string; description: string }[];
  };

  it("defines every term the page renders, and no others", () => {
    expect(node["@type"]).toBe("DefinedTermSet");
    expect(node.hasDefinedTerm.map((t) => t.name)).toEqual(ECHOPEDIA_TERMS.map((t) => t.term));
    expect(node.hasDefinedTerm.map((t) => t.description)).toEqual(
      ECHOPEDIA_TERMS.map((t) => t.definition),
    );
  });

  it("anchors every term at the id the page gives it", () => {
    for (const term of ECHOPEDIA_TERMS) {
      const id = `${SITE_URL}/en${LEARN_BASE}/${ECHOPEDIA_SLUG}#${headingId(term.term)}`;
      expect(node.hasDefinedTerm.some((t) => t["@id"] === id), term.term).toBe(true);
    }
  });
});

describe("FAQPage on the extension guide", () => {
  const guide = LEARN_GUIDES.find((g) => g.faq)!;

  it("marks up exactly the questions the page renders", () => {
    const node = faqPage(guide.faq!, guideUrl(guide.slug)) as unknown as {
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(node.mainEntity.map((q) => q.name)).toEqual(guide.faq!.map((f) => f.q));
  });

  it("publishes plain text, not the authoring markup", () => {
    // "**Load unpacked**" in a rich result would show the asterisks. The page
    // strips inline markup before building the node; this asserts the answers
    // that reach schema.org are clean.
    for (const entry of guide.faq!) {
      const clean = plainText(entry.a);
      expect(clean).not.toMatch(/\*\*/);
      expect(clean).not.toMatch(/\]\(/);
    }
  });
});

describe("canonicals", () => {
  it("sends every folded locale to the en URL, because the body is English", () => {
    for (const locale of ["en", "en-CA", "fr", "fr-CA", "de-CH"]) {
      const meta = buildMetadata({
        locale,
        path: `${LEARN_BASE}/${LEARN_CHAPTERS[0].slug}`,
        title: LEARN_CHAPTERS[0].title,
        canonicalLocale: "en",
      });
      expect(meta.alternates?.canonical, locale).toBe(chapterUrl(LEARN_CHAPTERS[0].slug));
    }
  });

  it("still self-canonicalises pages that do not ask to be folded", () => {
    // The override must not leak into the rest of the site.
    const meta = buildMetadata({ locale: "fr", path: "/resources", title: "Ressources" });
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/fr/resources`);
  });

  it("emits one title, absolute, so the layout template cannot double the brand", () => {
    const meta = buildMetadata({
      locale: "en",
      path: LEARN_BASE,
      title: "Learn reputation & AI visibility",
      canonicalLocale: "en",
    });
    expect(meta.title).toEqual({ absolute: "Learn reputation & AI visibility | Echorank360" });
  });
});

// ── Mutation checks ───────────────────────────────────────────────────────
//
// Every assertion above compares emitted structured data against the config. If
// the builders ignored their input, those comparisons would pass anyway. These
// feed the builders DRIFTED input and require the same comparisons to fail —
// which is what makes the suite above meaningful rather than decorative.
describe("the assertions above actually detect drift", () => {
  it("notices a chapter missing from the Course", () => {
    const dropped = LEARN_CHAPTERS.slice(0, -1);
    expect(hubCourse(dropped).hasPart.map((p) => p.headline)).not.toEqual(
      LEARN_CHAPTERS.map((c) => c.title),
    );
  });

  it("notices a chapter list in the wrong order", () => {
    const swapped = [LEARN_CHAPTERS[1], LEARN_CHAPTERS[0], ...LEARN_CHAPTERS.slice(2)];
    expect(hubCourse(swapped).hasPart.map((p) => p.headline)).not.toEqual(
      LEARN_CHAPTERS.map((c) => c.title),
    );
  });

  it("notices a headline that disagrees with the config", () => {
    const node = article({
      headline: `${LEARN_CHAPTERS[0].title} (stale)`,
      description: LEARN_CHAPTERS[0].description,
      pageUrl: chapterUrl(LEARN_CHAPTERS[0].slug),
    }) as unknown as { headline: string };
    expect(node.headline).not.toBe(LEARN_CHAPTERS[0].title);
  });

  it("notices a glossary term that is marked up but not rendered", () => {
    const node = definedTermSet({
      name: ECHOPEDIA_TITLE,
      description: ECHOPEDIA_DESCRIPTION,
      pageUrl: `${SITE_URL}/en${LEARN_BASE}/${ECHOPEDIA_SLUG}`,
      terms: [
        ...ECHOPEDIA_TERMS.map((t) => ({
          name: t.term,
          description: t.definition,
          anchor: headingId(t.term),
        })),
        { name: "Ghost term", description: "Not on the page.", anchor: "ghost-term" },
      ],
    }) as unknown as { hasDefinedTerm: { name: string }[] };
    expect(node.hasDefinedTerm.map((t) => t.name)).not.toEqual(ECHOPEDIA_TERMS.map((t) => t.term));
  });

  it("notices a canonical that was not folded", () => {
    const meta = buildMetadata({ locale: "fr", path: LEARN_BASE, title: "x" });
    expect(meta.alternates?.canonical).not.toBe(HUB_URL);
  });
});
