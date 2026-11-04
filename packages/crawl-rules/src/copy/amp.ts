import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "amp.link_non_200": {
    name: "AMP link to a page that does not return 200",
    description: "This page names an AMP version with <link rel=\"amphtml\">, but that URL answered with an error, a redirect or nothing. Search engines drop an AMP version they cannot fetch.",
    howToFix: "Fix the AMP URL so it returns 200, or remove the rel=amphtml link if the AMP version no longer exists.",
  },
  "amp.invalid": {
    name: "Invalid AMP page",
    description: "The official AMP validator reports errors on this page. Invalid AMP is not served from the AMP cache and loses AMP-only search features. The evidence shows the error count and the first three messages.",
    howToFix: "Fix each validator error (the AMP validator browser extension shows them in place), then re-crawl.",
  },
  "amp.missing_canonical": {
    name: "AMP page without a canonical",
    description: "An AMP page must carry <link rel=\"canonical\"> pointing at its regular version, or at itself when it has none. Without it the AMP page is invalid.",
    howToFix: "Add a canonical link to the regular (non-AMP) URL of this content.",
  },
  "amp.canonical_mismatch": {
    name: "AMP canonical does not point back",
    description: "This page links to an AMP version, but that AMP page's canonical names a different URL. The pair should point at each other: amphtml one way, canonical the other.",
    howToFix: "Set the AMP page's canonical to this page's URL, or link this page to the AMP version that belongs to it.",
  },
  "amp.non_amp_linked_as_amp": {
    name: "Regular page linked as AMP",
    description: "This page's rel=amphtml link points at a URL that is not an AMP document (no <html amp> or <html ⚡>). Search engines ignore the link.",
    howToFix: "Point rel=amphtml at the real AMP version, or remove the link.",
  },
  "amp.not_in_sitemap": {
    name: "AMP page not in the sitemap",
    description: "This AMP page is not listed in the XML sitemap. AMP pages are found through their regular page's rel=amphtml link, so this is optional; listing them helps when you want them recrawled faster.",
    howToFix: "If the AMP pages matter to you, add them to the sitemap, or a separate AMP sitemap.",
  },
};
