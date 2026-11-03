// @echorank/crawl-rules — the single registry.
//
// Everything that lists rules reads THIS: the crawler's evaluator, the
// Issues tab, the CSV export and (3c) the public issue library. A family is
// two modules, rules/<family>.ts and copy/<family>.ts (EN name, description,
// how to fix, keyed by rule id), registered with one line in FAMILIES below.
//
// The package imports nothing outside itself: no app code, no Prisma, no Next,
// no Node built-ins. tests/crawl-rules/registry.test.ts enforces it, so the
// package can move to its own repo unchanged.

import { evaluatePage, evaluateSite } from "./engine";
import type {
  PageFacts,
  PageRuleCtx,
  Rule,
  RuleCopy,
  RuleKind,
  RulePriority,
  SiteRuleCtx,
  StoredPageFacts,
} from "./types";
import { RULES as contentRules } from "./rules/content";
import { COPY as contentCopy } from "./copy/content";
import { RULES as h2Rules } from "./rules/h2";
import { COPY as h2Copy } from "./copy/h2";
import { RULES as h1Rules } from "./rules/h1";
import { COPY as h1Copy } from "./copy/h1";
import { RULES as metaKeywordsRules } from "./rules/meta_keywords";
import { COPY as metaKeywordsCopy } from "./copy/meta_keywords";
import { RULES as metaDescriptionRules } from "./rules/meta_description";
import { COPY as metaDescriptionCopy } from "./copy/meta_description";
import { RULES as pageTitlesRules } from "./rules/page_titles";
import { COPY as pageTitlesCopy } from "./copy/page_titles";
import { RULES as urlRules } from "./rules/url";
import { COPY as urlCopy } from "./copy/url";
import { RULES as responseCodesRules } from "./rules/response_codes";
import { COPY as responseCodesCopy } from "./copy/response_codes";

interface Family {
  rules: readonly Rule[];
  copy: Readonly<Record<string, RuleCopy>>;
}

const FAMILIES: Family[] = [
  // one line per family, in RULE_FAMILIES order
  { rules: responseCodesRules, copy: responseCodesCopy },
  { rules: urlRules, copy: urlCopy },
  { rules: pageTitlesRules, copy: pageTitlesCopy },
  { rules: metaDescriptionRules, copy: metaDescriptionCopy },
  { rules: metaKeywordsRules, copy: metaKeywordsCopy },
  { rules: h1Rules, copy: h1Copy },
  { rules: h2Rules, copy: h2Copy },
  { rules: contentRules, copy: contentCopy },
];

export const RULES: readonly Rule[] = FAMILIES.flatMap((f) => f.rules);
export const RULE_COPY: Readonly<Record<string, RuleCopy>> = Object.assign({}, ...FAMILIES.map((f) => f.copy));
export const RULE_BY_ID: ReadonlyMap<string, Rule> = new Map(RULES.map((r) => [r.id, r]));

export const KIND_ORDER: readonly RuleKind[] = ["issue", "warning", "opportunity"];
export const PRIORITY_ORDER: readonly RulePriority[] = ["high", "medium", "low"];

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
