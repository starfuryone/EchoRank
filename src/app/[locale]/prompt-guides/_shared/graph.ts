// Structured data for the prompt guides, as pure functions of the config —
// extracted from the pages so tests/prompt-guides.test.ts can assert the graph
// without rendering a route.
//
// URLs are always /en: the body is English under every locale, so all five
// locales canonical to the en URL (buildMetadata's canonicalLocale), and the
// structured data names the URL the canonical does. Same rule as /learn.
//
// Publisher and author are the Organization node — the publisher block the
// blog and the Knowledge Hub use. No invented values: dateModified is the
// package date the page prints in its "Updated" chip.

import {
  ORGANIZATION_ID,
  WEBSITE_ID,
  article,
  breadcrumbList,
  faqPage,
  organization,
  webSite,
  type JsonLdNode,
} from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import {
  GUIDE_FAQ,
  HUB_COPY,
  PROMPT_GUIDES,
  PROMPT_GUIDES_BASE,
  PROMPT_GUIDES_UPDATED_AT,
  guidePath,
  type PromptGuide,
} from "@/lib/prompt-guides";

export const HUB_URL = `${SITE_URL}/en${PROMPT_GUIDES_BASE}`;
export const guideUrl = (slug: string) => `${SITE_URL}/en${guidePath(slug)}`;

const HOME = { name: "Home", url: `${SITE_URL}/en` };
const HUB_CRUMB = "Prompt setup guides";

export function hubGraph(locale: string): JsonLdNode[] {
  const description = HUB_COPY.metaDescription(PROMPT_GUIDES.length);
  return [
    organization(locale),
    webSite(locale),
    {
      "@type": "CollectionPage",
      "@id": `${HUB_URL}#collection`,
      url: HUB_URL,
      name: HUB_COPY.title,
      description,
      inLanguage: "en",
      dateModified: PROMPT_GUIDES_UPDATED_AT,
      isPartOf: { "@id": WEBSITE_ID },
      publisher: { "@id": ORGANIZATION_ID },
      mainEntity: { "@id": `${HUB_URL}#guides` },
    },
    {
      "@type": "ItemList",
      "@id": `${HUB_URL}#guides`,
      name: HUB_COPY.title,
      numberOfItems: PROMPT_GUIDES.length,
      itemListElement: PROMPT_GUIDES.map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: g.title,
        url: guideUrl(g.slug),
      })),
    },
    breadcrumbList([HOME, { name: HUB_CRUMB, url: HUB_URL }]),
  ];
}

export function guideGraph(guide: PromptGuide, locale: string): JsonLdNode[] {
  const pageUrl = guideUrl(guide.slug);
  return [
    organization(locale),
    webSite(locale),
    article({
      headline: guide.title,
      description: guide.metaDescription,
      pageUrl,
      inLanguage: "en",
      dateModified: PROMPT_GUIDES_UPDATED_AT,
    }),
    breadcrumbList([HOME, { name: HUB_CRUMB, url: HUB_URL }, { name: guide.name, url: pageUrl }]),
    // The same array §10 renders.
    faqPage(GUIDE_FAQ, pageUrl),
  ];
}
