import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "hreflang.missing_return_links": {
    name: "Missing hreflang return links",
    description: "This page names an alternate that does not name it back. Hreflang must be reciprocal; search engines ignore one-way annotations.",
    howToFix: "Make every page in a language set list every other page in the set, itself included.",
  },
  "hreflang.inconsistent_language": {
    name: "Hreflang language does not match the page",
    description: "An alternate is annotated as one language, but that page's own lang attribute declares another. One of the two is wrong.",
    howToFix: "Check which language the target page is really in, then fix its lang attribute or the hreflang value.",
  },
  "hreflang.target_not_200": {
    name: "Hreflang points at a non-200 page",
    description: "An hreflang alternate redirects or returns an error. Search engines drop annotations to URLs that are not live.",
    howToFix: "Point the annotation at the final live URL of the alternate.",
  },
  "hreflang.unlinked_target": {
    name: "Hreflang alternate not linked from the site",
    description: "An hreflang alternate is not reachable through the site's links; only the annotation points to it.",
    howToFix: "Link to language versions visibly, e.g. with a language switcher, so visitors and crawlers can reach them.",
  },
  "hreflang.missing_self_reference": {
    name: "Missing self-referencing hreflang",
    description: "The page lists alternates but not itself. Each page in a set should include an hreflang annotation for its own URL.",
    howToFix: "Add an hreflang entry for this page's own language pointing at its own URL.",
  },
  "hreflang.not_using_canonical": {
    name: "Hreflang to a non-canonical URL",
    description: "An alternate's URL is not that page's canonical. Search engines may ignore annotations to URLs they do not index.",
    howToFix: "Use each alternate's canonical URL in hreflang.",
  },
  "hreflang.invalid_code": {
    name: "Invalid hreflang code",
    description: "An hreflang value is not a valid ISO 639-1 language code, optionally followed by an ISO 3166-1 region. Common mistakes: \"en-uk\" instead of \"en-gb\", or a region on its own.",
    howToFix: "Use language-region values such as en-gb, fr-ca or es-419, or x-default for the fallback page.",
  },
  "hreflang.multiple_entries_for_language": {
    name: "One hreflang value points at several URLs",
    description: "The same hreflang value is assigned to more than one URL, so search engines cannot tell which one to show.",
    howToFix: "Keep one URL per language-region value.",
  },
  "hreflang.missing_x_default": {
    name: "Missing x-default",
    description: "The page has hreflang annotations but no x-default, the page shown to visitors whose language matches none of the alternates.",
    howToFix: "Add an hreflang=\"x-default\" entry, usually pointing at a language selector or the main-market page.",
  },
  "hreflang.outside_head": {
    name: "Hreflang outside <head>",
    description: "Hreflang <link> elements sit in the <body>, where search engines do not read them.",
    howToFix: "Move the annotations into <head>, or declare them in the XML sitemap instead.",
  },
  "hreflang.target_noindex": {
    name: "Hreflang points at a noindex page",
    description: "An alternate carries noindex, so it cannot appear in search for its language however it is annotated.",
    howToFix: "Remove noindex from the alternate, or remove it from the hreflang set.",
  },
  "hreflang.missing_on_multilingual_site": {
    name: "No hreflang on a multilingual site",
    description: "The crawl found pages in more than one language, but this page has no hreflang annotations, so search engines must guess which version to show to whom.",
    howToFix: "Annotate each page with its language alternates (and x-default), in <head>, a Link header or the sitemap.",
  },
};
