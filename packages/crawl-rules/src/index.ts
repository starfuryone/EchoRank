// @echorank/crawl-rules — the single registry.
//
// Everything that lists rules reads THIS: the crawler's evaluator, the
// Issues tab, the CSV export and (3c) the public issue library. A family is
// two modules, rules/<family>.ts and copy/<family>.ts (EN name, description,
// how to fix, keyed by rule id), registered with one line in FAMILIES below
// and one in meta.ts.
//
// Client Components import meta.ts (ids and copy) instead of this module:
// the rules carry the evaluators and the hreflang code lists, none of which a
// browser needs.
//
// The package imports nothing outside itself but the two code-list packages
// hreflang validation reads: no app code, no Prisma, no Next, no Node
// built-ins. tests/crawl-rules/registry.test.ts enforces it, so the
// package can move to its own repo unchanged.

import { evaluatePage, evaluateSite } from "./engine";
import type {
  PageFacts,
  PageRuleCtx,
  Rule,
  SiteRuleCtx,
  StoredPageFacts,
} from "./types";
import { RULES as javascriptRules } from "./rules/javascript";
import { RULES as accessibilityRules } from "./rules/accessibility";
import { RULES as mobileRules } from "./rules/mobile";
import { RULES as spellingRules } from "./rules/spelling";
import { RULES as performanceRules } from "./rules/performance";
import { RULES as hreflangRules } from "./rules/hreflang";
import { RULES as validationRules } from "./rules/validation";
import { RULES as structuredDataRules } from "./rules/structured_data";
import { RULES as paginationRules } from "./rules/pagination";
import { RULES as securityRules } from "./rules/security";
import { RULES as sitemapsRules } from "./rules/sitemaps";
import { RULES as linksRules } from "./rules/links";
import { RULES as directivesRules } from "./rules/directives";
import { RULES as canonicalsRules } from "./rules/canonicals";
import { RULES as imagesRules } from "./rules/images";
import { RULES as contentRules } from "./rules/content";
import { RULES as h2Rules } from "./rules/h2";
import { RULES as h1Rules } from "./rules/h1";
import { RULES as metaKeywordsRules } from "./rules/meta_keywords";
import { RULES as metaDescriptionRules } from "./rules/meta_description";
import { RULES as pageTitlesRules } from "./rules/page_titles";
import { RULES as urlRules } from "./rules/url";
import { RULES as responseCodesRules } from "./rules/response_codes";
import { RULES as robotsRules } from "./rules/robots";
import { RULES as extractionRules } from "./rules/extraction";
import { RULES as searchConsoleRules } from "./rules/search_console";

const FAMILIES: (readonly Rule[])[] = [
  // one line per family, in RULE_FAMILIES order
  responseCodesRules,
  urlRules,
  pageTitlesRules,
  metaDescriptionRules,
  metaKeywordsRules,
  h1Rules,
  h2Rules,
  contentRules,
  imagesRules,
  canonicalsRules,
  directivesRules,
  linksRules,
  sitemapsRules,
  securityRules,
  paginationRules,
  structuredDataRules,
  validationRules,
  hreflangRules,
  javascriptRules,
  accessibilityRules,
  mobileRules,
  spellingRules,
  performanceRules,
  robotsRules,
  extractionRules,
  searchConsoleRules,
];

export const RULES: readonly Rule[] = FAMILIES.flat();
export const RULE_BY_ID: ReadonlyMap<string, Rule> = new Map(RULES.map((r) => [r.id, r]));

export { RULE_COPY, RULE_IDS, KIND_ORDER, PRIORITY_ORDER } from "./meta";

/** Every page-scope finding for one fetched page. */
export function evaluatePageRules(page: PageFacts, ctx?: PageRuleCtx) {
  return evaluatePage(RULES, page, ctx);
}

/** Every site-scope finding for one stored page, given the aggregation's results. */
export function evaluateSiteRules(page: StoredPageFacts, ctx: SiteRuleCtx) {
  return evaluateSite(RULES, page, ctx);
}

export { ev, isOk, pageRule, siteRule, evaluatePage, evaluateSite } from "./engine";
export * from "./types";
export { pixelWidth, TITLE_FONT_PX, DESCRIPTION_FONT_PX } from "./util/pixels";
export { jsOnlyFacts, renderedOnlyLinks, metaNoindex, JS_CONTENT_MIN_WORDS } from "./util/render";
export { PSI_AUDIT_IDS, PERF_SPECS, PASS_SCORE } from "./rules/performance";
export { MANY_MISSPELLINGS } from "./rules/spelling";
export { AXE_RULES, AXE_VERSION } from "./generated/axe-rules";
export { simhash64, hammingDistance, NEAR_DUPLICATE_MAX_HAMMING } from "./util/simhash";
export {
  collapse,
  countWords,
  findPlaceholder,
  fleschReadingEase,
  isEnglish,
  truncate,
  utf8Bytes,
} from "./util/text";
