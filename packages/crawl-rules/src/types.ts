// packages/crawl-rules/src/types.ts
//
// The contract. Everything a consumer hands the engine, and everything it gets
// back, is a plain serialisable shape declared here — no class instances, no
// Dates, no Maps — so a PageFacts can cross a process boundary (a queue job, a
// public API response, another repo) and produce the same verdicts there.
//
// TWO FACT SHAPES, ON PURPOSE:
//
//   PageFacts        — the full, in-memory description of ONE fetched page.
//                      Rich (anchors, images, resources, structured data) and
//                      transient: the consumer builds it from the response it
//                      just parsed and throws it away after evaluation.
//   StoredPageFacts  — the NARROW subset a consumer persists per page, which
//                      is all the site-scope rules may read. A site rule typed
//                      against PageFacts could silently read a field nobody
//                      stored; typing it against StoredPageFacts makes that a
//                      compile error instead.

export const RULE_FAMILIES = [
  "response_codes",
  "url",
  "page_titles",
  "meta_description",
  "meta_keywords",
  "h1",
  "h2",
  "content",
  "images",
  "canonicals",
  "directives",
  "links",
  "sitemaps",
  "security",
  "hreflang",
  "pagination",
  "structured_data",
  "validation",
  // Phase 3b: render mode. accessibility and mobile fire only on rendered
  // pages; javascript mostly does (see rules/javascript.ts).
  "javascript",
  "accessibility",
  "mobile",
  // Phase 3c. spelling runs on every page's visible text (capability
  // "spell"); performance reads Lighthouse audits the consumer attaches
  // (capability "psi").
  "spelling",
  "performance",
  // Reserved for Phase 4a (robots.would_block / robots.would_allow, custom robots.txt test mode).
  "robots",
] as const;

export type RuleFamily = (typeof RULE_FAMILIES)[number];
export type RuleKind = "issue" | "warning" | "opportunity";
export type RulePriority = "high" | "medium" | "low";
export type Capability = "render" | "psi" | "spell";

/**
 * What a rule reports alongside its verdict. Small by contract: counts,
 * lengths, and at most one offending value truncated to EVIDENCE_VALUE_MAX
 * characters. Never a page body, never an unbounded list.
 */
export type Evidence = Record<string, string | number | boolean | null>;

export const EVIDENCE_VALUE_MAX = 200;

/**
 * Which pages a page-scope rule looks at. The engine filters, so a rule body
 * never has to re-check "was this even HTML".
 *
 *   any      — every row, including URLs robots.txt kept us out of
 *   fetched  — a request was made (a response, or a transport failure)
 *   html     — the response was parsed as HTML, whatever its status
 *   ok_html  — a 2xx response parsed as HTML (the default)
 */
export type Applies = "any" | "fetched" | "html" | "ok_html";

// ─── Page facts ─────────────────────────────────────────────────────────────

export interface AnchorFact {
  /** Absolute URL, fragment removed. The raw attribute when it cannot be resolved. */
  href: string;
  /** The attribute exactly as written, trimmed. */
  raw: string;
  /** Visible text, whitespace-collapsed. Falls back to an <img alt> inside it. */
  text: string;
  /** rel, lowercased. */
  rel: string;
  /** target, lowercased. */
  target: string;
  /** True when the consumer's scope rule puts the target on the crawled site. */
  internal: boolean;
}

export interface ImageFact {
  /** Absolute URL when resolvable, else the raw src. */
  src: string;
  /** null = no alt attribute at all; "" = empty alt (decorative, and fine). */
  alt: string | null;
  hasWidth: boolean;
  hasHeight: boolean;
  /** Declared width attribute in px, null when absent or not a number. */
  width: number | null;
  /** loading attribute, lowercased; null when absent. */
  loading: string | null;
  hasSrcset: boolean;
  /** Inside a <picture> that offers a WebP or AVIF <source>. */
  modernSource: boolean;
}

export interface StructuredItem {
  /** schema type as written, e.g. "Product" or "https://schema.org/Product". */
  type: string;
  /** The vocabulary it claims: a JSON-LD @context or a microdata itemtype base. */
  vocabulary: string | null;
  /** Property names present on the item (top level only). */
  props: string[];
}

export interface JsonLdBlock {
  /** False when the block's text is not valid JSON. */
  ok: boolean;
  /** Canonical JSON of the parsed block, for duplicate detection. Null when !ok. */
  fingerprint: string | null;
  items: StructuredItem[];
}

export interface MicrodataItem {
  /** itemtype attribute, null when absent. */
  itemtype: string | null;
  props: string[];
}

export interface HreflangFact {
  /** As written, lowercased. "x-default" is a valid value. */
  lang: string;
  /** Absolute, normalised the same way the consumer normalises crawl URLs. */
  href: string;
}

/** Facts from the raw source, before an HTML parser repairs the tree. */
export interface RawStructureFacts {
  hasDoctype: boolean;
  htmlTagCount: number;
  headTagCount: number;
  bodyTagCount: number;
  /** <body …> appears in the source before <head …>. */
  bodyBeforeHead: boolean;
  /** The first element inside <html> is <head>. False when there is no <head>. */
  headIsFirstChild: boolean;
  /** Tag names found between <head> and </head> that do not belong in a head. */
  invalidHeadElements: string[];
}

export interface HtmlFacts {
  /** Every <title> text in document order, trimmed. Empty strings kept. */
  titles: string[];
  titlesOutsideHead: number;
  metaDescriptions: string[];
  metaDescriptionsOutsideHead: number;
  metaKeywords: string | null;
  /** Text of every <h1>/<h2>, in order. */
  h1: string[];
  h2: string[];
  /** An <h3> appears before the first <h2> (or with no <h2> at all). */
  h3BeforeH2: boolean;
  /** Visible words, script/style/noscript/template/svg stripped. */
  wordCount: number;
  /** Flesch reading ease; null unless the page is English and long enough to score. */
  fleschReadingEase: number | null;
  /** The placeholder phrase found in the visible text, if any. */
  placeholderText: string | null;
  /** Visible-text bytes / response bytes, as a percentage (0–100). */
  textRatio: number;
  /** <html lang>, as written; null when absent or empty. */
  langAttr: string | null;
  hasViewport: boolean;
  /** Charset declared in the document (<meta charset> or http-equiv), lowercased; null when none. */
  charset: string | null;
  /** href of every <link rel=canonical>, raw, in order. */
  canonicals: string[];
  canonicalsOutsideHead: number;
  /** Combined content of meta robots and meta googlebot, lowercased; null when neither. */
  metaRobots: string | null;
  metaRobotsOutsideHead: number;
  /** content of <meta http-equiv=refresh>, null when absent. */
  metaRefresh: string | null;
  hreflang: HreflangFact[];
  hreflangOutsideHead: number;
  /** Absolute, normalised. */
  relNext: string[];
  relPrev: string[];
  paginationOutsideHead: number;
  anchors: AnchorFact[];
  images: ImageFact[];
  /** Raw src/href of subresources: img, script, stylesheet link, iframe, media, embed, object. */
  resources: string[];
  /** Resolved action URL of every <form>; the page URL when action is absent. */
  formActions: string[];
  jsonLd: JsonLdBlock[];
  microdata: MicrodataItem[];
  /** itemprop attributes with no itemscope ancestor. */
  orphanItemprops: number;
  raw: RawStructureFacts;
}

/** Results of the bounded HEAD checks a consumer may run. Absent = not checked. */
export interface LinkCheckFacts {
  checked: number;
  clientErrors: number;
  serverErrors: number;
  /** Checked URLs that answered 3xx. */
  redirects: number;
  /** One offending URL, for evidence. */
  sample: string | null;
}

export interface ImageCheckFacts {
  checked: number;
  broken: number;
  /** Over IMAGE_MAX_BYTES by Content-Length. */
  oversize: number;
  sample: string | null;
}

/**
 * What a headless browser saw for this page (Phase 3b render mode). Absent on
 * PageFacts when the page was not rendered: render mode off, the page not
 * picked by "thin", the job's rendered-page cap reached, or the render failed.
 */
export interface RenderFacts {
  /** HTTP status of the document the browser loaded. */
  statusCode: number | null;
  finalUrl: string;
  /** Where a script (or meta refresh) navigated after load; null when it stayed. */
  jsRedirect: string | null;
  /** The rendered DOM through the same extractor as the raw HTML. Null when the page navigated off-site. */
  html: HtmlFacts | null;
  /** console.error calls plus uncaught exceptions. */
  consoleErrors: number;
  /** The first one, truncated. */
  consoleSample: string | null;
  /** Measured at a phone's device width. Null when the measurement did not run. */
  viewport: { width: number; scrollWidth: number } | null;
  /** Computed font-size of <body>, CSS px. */
  bodyFontPx: number | null;
  tapTargets: { checked: number; tooClose: number; sample: string | null } | null;
  /** axe-core violations by axe rule id. Null when axe did not run in the budget. */
  axe: Record<string, { impact: string | null; nodes: number }> | null;
}

/** Which page elements exist, or differ, only after JavaScript runs. */
export interface JsOnlyFacts {
  title: boolean;
  metaDesc: boolean;
  h1: boolean;
  canonical: boolean;
  content: boolean;
  links: boolean;
}

/** The consumer's spell check of the page's visible text (Phase 3c). */
export interface SpellingFacts {
  /** Primary language subtag checked ("en" | "fr" | "de"), or the unsupported one found. */
  lang: string;
  supported: boolean;
  /** Words looked up (after skipping numbers, acronyms, URLs and whitelisted words). */
  checked: number;
  /** Distinct words not in the dictionary. */
  misspelled: number;
  /** Up to SPELLING_SAMPLE_MAX of them, in document order. */
  sample: string[];
}

export const SPELLING_SAMPLE_MAX = 5;

export interface PageFacts {
  /** The URL as crawled (pre-redirect), normalised. */
  url: string;
  /** Final URL after redirects. */
  finalUrl: string;
  rootUrl: string;
  depth: number;
  blockedByRobots: boolean;
  /** Null when the request produced no response at all. */
  statusCode: number | null;
  /** Transport failure reason (timeout, DNS, too_many_redirects…); null on a response. */
  fetchError: string | null;
  redirectHops: number;
  /** First redirect hop's target. */
  redirectTarget: string | null;
  contentType: string | null;
  responseMs: number | null;
  /** Bytes of the body read; null when not read. */
  bytes: number | null;
  /** Null when the crawl found no sitemap at all. */
  inSitemap: boolean | null;
  /** Response headers of the final response, lowercased names. Only the ones rules read. */
  headers: Record<string, string>;
  /** Null when the body was not parsed as HTML. */
  html: HtmlFacts | null;
  externalLinkChecks?: LinkCheckFacts;
  imageChecks?: ImageCheckFacts;
  /** Phase 3b. See RenderFacts. */
  render?: RenderFacts;
  /** Phase 3c. Absent when the consumer did not spell-check the page. */
  spelling?: SpellingFacts;
}

// ─── Stored (site-scope) facts ──────────────────────────────────────────────

export interface SecurityHeaders {
  hsts: boolean;
  csp: boolean;
  xcto: boolean;
  xfo: boolean;
  refpol: boolean;
}

/** What a consumer persists per page; the only page input site rules get. */
export interface StoredPageFacts {
  url: string;
  rootUrl: string;
  depth: number;
  statusCode: number | null;
  redirectTarget: string | null;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  h1First: string | null;
  h2First: string | null;
  /** Absolute, normalised; null when none. */
  canonical: string | null;
  /** True when meta robots or X-Robots-Tag carries noindex (or none). */
  noindex: boolean;
  inSitemap: boolean | null;
  inlinkCount: number | null;
  hreflang: HreflangFact[];
  langAttr: string | null;
  relNext: string | null;
  relPrev: string | null;
}

/** Per-page results of the site-wide queries. Zero/null means "nothing found". */
export interface PageSiteFacts {
  /** Pages sharing this page's title, INCLUDING itself; < 2 means unique. */
  duplicateTitleCount: number;
  duplicateMetaCount: number;
  duplicateH1Count: number;
  duplicateH2Count: number;
  duplicateContentCount: number;
  /** OTHER pages within the near-duplicate Hamming distance, exact duplicates excluded. */
  nearDuplicateCount: number;
  /** OTHER pages whose <title> equals this page's first H1. */
  h1MatchesOtherTitleCount: number;
  nofollowInlinkCount: number;
  /** The loop path, when this URL's redirects cycle. */
  redirectLoop: string | null;
  /** Linking pages for which this page was the first-seen source of a redirecting target. */
  outlinksToRedirect: number;
  /** Seeded from the sitemap, and nothing on the site links to it. */
  orphan: boolean;
  /** The crawled page this page's canonical points at, when it is another URL. */
  canonicalTarget: {
    statusCode: number | null;
    redirects: boolean;
    noindex: boolean;
  } | null;
  hreflang: {
    targets: number;
    non200: number;
    noindex: number;
    notCanonical: number;
    missingReturn: number;
    langMismatch: number;
    unlinked: number;
    sample: string | null;
  };
  pagination: { non200: number; sequenceErrors: number; sample: string | null };
}

/** Job-wide facts. Job-level rules attach their finding to the root page. */
export interface JobFacts {
  pagesCrawled: number;
  /** Distinct primary language subtags seen across crawled pages. */
  langsSeen: number;
  sitemap: {
    found: boolean;
    urlCount: number;
    /** Most page URLs in any single sitemap file. */
    largestFileUrls: number;
    /** Sitemap URLs that never became a crawled row. */
    notCrawled: number;
    notCrawledSample: string | null;
    /** robots.txt carried at least one Sitemap: line. */
    declaredInRobots: boolean;
  };
}

export interface PageRuleCtx {
  capabilities: readonly Capability[];
}

/**
 * One Lighthouse run for this page (Phase 3c), as the consumer stored it.
 * Audits are keyed by Lighthouse audit id; a consumer may supply only the
 * ids PSI_AUDIT_IDS lists.
 */
export interface PsiFacts {
  strategy: "mobile" | "desktop";
  lighthouseVersion: string | null;
  fetchedAt: string;
  audits: Record<string, PsiAudit>;
  /** INP 75th percentile from CrUX field data, ms. Null when PSI returned no field data. */
  inpP75: number | null;
}

export interface PsiAudit {
  /** 0–1, null when Lighthouse did not score it. */
  score: number | null;
  /** numericValue: ms for timings, unitless for CLS, bytes or counts elsewhere. */
  value: number | null;
  /** Lighthouse's displayValue. */
  display: string | null;
}

export interface SiteRuleCtx {
  capabilities: readonly Capability[];
  /** Phase 3c: the page's Lighthouse run, when one is attached. */
  psi?: PsiFacts | null;
  site: PageSiteFacts;
  job: JobFacts;
  /** True for the row job-level findings attach to. */
  isRoot: boolean;
}

// ─── Rules ──────────────────────────────────────────────────────────────────

interface RuleBase {
  /** Stable, dotted, family-prefixed: "page_titles.over_60". Public API — never rename. */
  id: string;
  family: RuleFamily;
  kind: RuleKind;
  priority: RulePriority;
  /** Skipped when the capability is not enabled for the job. */
  requires?: Capability[];
}

export interface PageRule extends RuleBase {
  scope: "page";
  /** Defaults to "ok_html". */
  applies?: Applies;
  detect: (page: PageFacts, ctx: PageRuleCtx) => Evidence | null;
}

export interface SiteRule extends RuleBase {
  scope: "site";
  detect: (page: StoredPageFacts, ctx: SiteRuleCtx) => Evidence | null;
}

export type Rule = PageRule | SiteRule;

export interface Issue {
  ruleId: string;
  kind: RuleKind;
  priority: RulePriority;
  evidence: Evidence;
}

export interface RuleCopy {
  name: string;
  description: string;
  howToFix: string;
}
