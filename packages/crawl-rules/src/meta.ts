// @echorank/crawl-rules/meta — the client-safe half of the registry.
//
// Rule ids and their copy (name, description, how to fix), with no rule logic
// and no dependencies: the copy modules import only types, generated data and
// data/. The Issues tab and the crawl form are Client Components, and
// importing index.ts there would ship every evaluator plus the hreflang
// code-list packages to the browser. tests/crawl-rules/registry.test.ts walks
// this module's imports and checks RULE_IDS against the full registry.

import type { RuleCopy, RuleKind, RulePriority } from "./types";
import { COPY as javascriptCopy } from "./copy/javascript";
import { COPY as accessibilityCopy } from "./copy/accessibility";
import { COPY as mobileCopy } from "./copy/mobile";
import { COPY as spellingCopy } from "./copy/spelling";
import { COPY as performanceCopy } from "./copy/performance";
import { COPY as hreflangCopy } from "./copy/hreflang";
import { COPY as validationCopy } from "./copy/validation";
import { COPY as structuredDataCopy } from "./copy/structured_data";
import { COPY as paginationCopy } from "./copy/pagination";
import { COPY as securityCopy } from "./copy/security";
import { COPY as sitemapsCopy } from "./copy/sitemaps";
import { COPY as linksCopy } from "./copy/links";
import { COPY as directivesCopy } from "./copy/directives";
import { COPY as canonicalsCopy } from "./copy/canonicals";
import { COPY as imagesCopy } from "./copy/images";
import { COPY as contentCopy } from "./copy/content";
import { COPY as h2Copy } from "./copy/h2";
import { COPY as h1Copy } from "./copy/h1";
import { COPY as metaKeywordsCopy } from "./copy/meta_keywords";
import { COPY as metaDescriptionCopy } from "./copy/meta_description";
import { COPY as pageTitlesCopy } from "./copy/page_titles";
import { COPY as urlCopy } from "./copy/url";
import { COPY as responseCodesCopy } from "./copy/response_codes";
import { COPY as robotsCopy } from "./copy/robots";
import { COPY as extractionCopy } from "./copy/extraction";

const COPIES: Readonly<Record<string, RuleCopy>>[] = [
  // one line per family, in index.ts FAMILIES order
  responseCodesCopy,
  urlCopy,
  pageTitlesCopy,
  metaDescriptionCopy,
  metaKeywordsCopy,
  h1Copy,
  h2Copy,
  contentCopy,
  imagesCopy,
  canonicalsCopy,
  directivesCopy,
  linksCopy,
  sitemapsCopy,
  securityCopy,
  paginationCopy,
  structuredDataCopy,
  validationCopy,
  hreflangCopy,
  javascriptCopy,
  accessibilityCopy,
  mobileCopy,
  spellingCopy,
  performanceCopy,
  robotsCopy,
  extractionCopy,
];

export const RULE_COPY: Readonly<Record<string, RuleCopy>> = Object.assign({}, ...COPIES);
/** Every rule id. The copy is keyed by rule id, one entry per rule (registry test). */
export const RULE_IDS: readonly string[] = Object.keys(RULE_COPY);

export const KIND_ORDER: readonly RuleKind[] = ["issue", "warning", "opportunity"];
export const PRIORITY_ORDER: readonly RulePriority[] = ["high", "medium", "low"];

export type { RuleCopy, RuleFamily, RuleKind, RulePriority } from "./types";
