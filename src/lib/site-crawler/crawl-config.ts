// src/lib/site-crawler/crawl-config.ts
//
// Crawl configuration (Phase 4a): the typed CrawlConfig, its limits, and the
// validation every surface shares — the start route, "Save as default for
// this site", and the Configuration section of the start card.
//
// DEPENDENCY-FREE on purpose (zod only): the start card is a Client
// Component. Encryption of the secret fields lives in crawl-config-secrets.ts
// (server-only); this module only knows a secret's three shapes:
//   input   — a string (new value), null (none), or { keep: true } (reuse the
//             value saved for this site);
//   stored  — { enc } (AES-GCM ciphertext, GSC_TOKEN_ENCRYPTION_KEY pattern);
//   to the UI — { set: true }. A saved secret is never echoed back.
//
// VERIFIED-SITE OPTIONS. Another user agent and ignoring robots.txt change how
// the crawler treats someone's server, so they need a verified site
// (site-verify.ts). A custom robots.txt is allowed everywhere: on a verified
// site it replaces the live file, on an unverified one it runs in test mode.
//
// PHASE 4b adds extractors, custom searches and the crawl's segment snapshot.
// Their counts are capped per plan (crawlExtractors, crawlSearches,
// crawlSegments in plan-config.ts); every expression is ≤ 500 characters and
// every regular expression passes unsafeRegex below.

import { z } from "zod";
import type { SegmentDef } from "./segments";
import { flag } from "@/lib/flags";
import { JS_LIMITS, JS_PRESETS, type JsSnippet } from "./js-snippets";
import { AI_LIMITS, AI_PRESETS, AI_PROVIDERS, type AiConfig } from "./ai-shared";
import type { LoginConfigOf } from "./login-config";

export const CONFIG_LIMITS = {
  patterns: 20,
  patternChars: 200,
  stripParams: 30,
  headers: 10,
  headerValueChars: 1024,
  cookieChars: 4096,
  basicUserChars: 128,
  basicPasswordChars: 256,
  customUaChars: 256,
  customRobotsChars: 32_768,
  minSpeed: 0.5,
  maxSpeed: 2,
  maxDepth: 100,
  /** Phase 4b: extractor names, search names. */
  nameChars: 60,
  /** Extractor expressions and search patterns. */
  exprChars: 500,
  attrChars: 64,
  /** Values stored per extractor per page, and characters per value. */
  extractValues: 20,
  extractValueChars: 500,
} as const;

export const EXTRACTOR_KINDS = ["css", "xpath", "regex"] as const;
export type ExtractorKind = (typeof EXTRACTOR_KINDS)[number];

/**
 * One custom extractor. css: a selector, the element's text or `attr`.
 * xpath: an expression; nodes give their text (or `attr`), other results their
 * string value. regex: a pattern over the raw HTML, flags "g"; the first
 * capture group when there is one, else the whole match. `multiple` keeps up
 * to 20 values, otherwise the first.
 */
export interface Extractor {
  name: string;
  kind: ExtractorKind;
  expr: string;
  attr: string | null;
  multiple: boolean;
}

/** One custom search over the raw HTML: a case-insensitive string, or a regex (flags "g"). */
export interface CustomSearch {
  name: string;
  pattern: string;
  isRegex: boolean;
}

/** Prefilled extractor rows the Configuration section offers. Only a starting point: every field stays editable. */
export const EXTRACTOR_PRESETS = {
  ogTitle: { name: "og:title", kind: "css", expr: 'meta[property="og:title"]', attr: "content", multiple: false },
  ogDescription: { name: "og:description", kind: "css", expr: 'meta[property="og:description"]', attr: "content", multiple: false },
  ogImage: { name: "og:image", kind: "css", expr: 'meta[property="og:image"]', attr: "content", multiple: false },
  price: { name: "Price", kind: "css", expr: '[itemprop="price"], meta[property="product:price:amount"]', attr: "content", multiple: false },
  sku: { name: "SKU", kind: "regex", expr: '"sku"\\s*:\\s*"([^"]{1,100})"', attr: null, multiple: false },
  author: { name: "Author", kind: "css", expr: 'meta[name="author"]', attr: "content", multiple: false },
  published: { name: "Published", kind: "css", expr: 'meta[property="article:published_time"]', attr: "content", multiple: false },
  hreflang: { name: "hreflang", kind: "xpath", expr: '//link[@rel="alternate"][@hreflang]/@hreflang', attr: null, multiple: true },
  canonical: { name: "Canonical", kind: "css", expr: 'link[rel="canonical"]', attr: "href", multiple: false },
} as const satisfies Record<string, Extractor>;
export type ExtractorPreset = keyof typeof EXTRACTOR_PRESETS;


export const USER_AGENTS = ["echorank", "googlebot_smartphone", "googlebot_desktop", "custom"] as const;
export type UserAgentChoice = (typeof USER_AGENTS)[number];

export const QUERY_MODES = ["keep", "strip_all", "strip_listed"] as const;
export type QueryMode = (typeof QUERY_MODES)[number];

/** The user-agent strings sent for the Googlebot choices, and the robots.txt token each obeys. */
export const GOOGLEBOT_UA = {
  googlebot_smartphone:
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  googlebot_desktop: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
} as const;

/** Header names a tenant may not set: the transport owns them, or another field does. */
const RESERVED_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "te",
  "upgrade",
  "keep-alive",
  "expect",
  "user-agent", // the user-agent field
  "cookie", // the cookies field
  "authorization", // basic auth
]);

export type StoredSecret = { enc: string };
export type SecretInput = string | null | { keep: true };
export type SecretView = { set: true } | null;

/** One crawl's configuration, generic over how its secrets are carried. */
export interface CrawlConfigOf<S> {
  /** Null = the plan's URL cap. Never above it. */
  maxUrls: number | null;
  /** Null = no depth limit. The root is depth 0. */
  maxDepth: number | null;
  /** URL patterns: a glob (* and ?) or a regular expression written /like this/i. */
  include: string[];
  exclude: string[];
  crawlSubdomains: boolean;
  followNofollow: boolean;
  queryStrings: QueryMode;
  /** Parameter names dropped when queryStrings is strip_listed. */
  stripParams: string[];
  /** Requests per second, 0.5–2. */
  speed: number;
  userAgent: UserAgentChoice;
  customUserAgent: string | null;
  headers: { name: string; value: S }[];
  cookies: S | null;
  basicAuth: { user: string; password: S } | null;
  respectRobots: boolean;
  customRobots: string | null;
  /**
   * Set by the server at crawl creation, never taken from input: "replace" on
   * a verified site (the draft is obeyed), "test" otherwise (the live file is
   * obeyed and robots.would_block / would_allow report the difference).
   */
  customRobotsMode?: "replace" | "test";
  /** Phase 4b. At most the plan's crawlExtractors. */
  extractors: Extractor[];
  /** Phase 4b. At most the plan's crawlSearches. */
  searches: CustomSearch[];
  /**
   * Phase 4b: the host's saved segments, copied in by the server at crawl
   * creation, never taken from input. crawl_pages.segmentIds index into it.
   */
  segments?: SegmentDef[];
  /**
   * Phase 4d opt-ins, run after the crawl on its most-linked pages (within
   * one segment when given): PageSpeed (crawl.psi) and backlink metrics
   * (crawl.backlinks). Pages at most the plan's crawlPsiPages /
   * crawlBacklinkPages. Absent = neither.
   */
  addData?: AddData | null;
  /**
   * Phase 4e custom JavaScript (crawl.customJs): run on every rendered page,
   * verified sites only, at most the plan's crawlJsSnippets. Saved per host
   * in crawl_site_defaults.jsSnippets, not in its config.
   */
  js?: JsSnippet[];
  /**
   * Phase 4e AI prompts (crawl.ai): up to 3, run after the crawl on its top N
   * pages' visible text. Claude on the house key (Marketing Studio token
   * budget), OpenAI / Gemini on the tenant's own key.
   */
  ai?: AiConfig | null;
  /**
   * Phase 4e forms login (crawl.login), verified sites only. Never from
   * input: the server copies the host's saved login (crawl_site_defaults.login,
   * credentials sealed) when the start request sets useLogin.
   */
  login?: LoginConfigOf<S> | null;
  /** Phase 4e, input only: log in with the host's saved login before crawling. */
  useLogin?: boolean;
  /**
   * Phase 4g semantic duplicates (crawl.semantic): embed the top N pages after
   * the crawl, on the tenant's own OpenAI key. N at most crawlSemanticPages.
   */
  semantic?: TopPages | null;
  /**
   * Phase 4g URL Inspection (crawl.inspection): the top N pages through Search
   * Console's URL Inspection, when the tenant's GSC property covers the host.
   * N at most crawlInspectionPages.
   */
  inspection?: TopPages | null;
}

/** Phase 4d: the top N pages by inlinks, optionally inside one of the crawl's segments. */
export interface TopPages {
  pages: number;
  segment: number | null;
}
export interface AddData {
  psi: TopPages | null;
  backlinks: TopPages | null;
}

export type CrawlConfigInput = CrawlConfigOf<SecretInput>;
export type StoredCrawlConfig = CrawlConfigOf<StoredSecret>;
export type CrawlConfigView = CrawlConfigOf<SecretView>;
/** What the worker runs with: secrets decrypted, in memory only. */
export type RuntimeCrawlConfig = CrawlConfigOf<string>;

export const DEFAULT_CRAWL_CONFIG: CrawlConfigOf<never> = {
  maxUrls: null,
  maxDepth: null,
  include: [],
  exclude: [],
  // Both defaults keep the pre-4a behaviour: subdomains of the root's
  // registrable domain are in scope, rel=nofollow links are not followed.
  crawlSubdomains: true,
  followNofollow: false,
  queryStrings: "keep",
  stripParams: [],
  speed: 2,
  userAgent: "echorank",
  customUserAgent: null,
  headers: [],
  cookies: null,
  basicAuth: null,
  respectRobots: true,
  customRobots: null,
  extractors: [],
  searches: [],
};

// ─── Patterns ────────────────────────────────────────────────────────────────

const REGEX_LITERAL = /^\/([\s\S]+)\/(i?)$/;

/**
 * Reject the regex shapes that backtrack exponentially: a quantified group
 * that itself contains a quantifier ((a+)+, (a|aa)*, (.*){2,}) and
 * backreferences. JavaScript regexes cannot be interrupted, and the crawler
 * tests every discovered URL against every pattern, so the guard is up front.
 */
export function unsafeRegex(source: string): boolean {
  if (/\\[1-9]|\\k</.test(source)) return true;
  // Strip escapes and character classes so their contents read as literals.
  const plain = source.replace(/\\./g, "x").replace(/\[[^\]]*\]/g, "x");
  // A group closing into a quantifier, whose body holds a quantifier or an alternation.
  const stack: number[] = [];
  for (let i = 0; i < plain.length; i++) {
    const c = plain[i];
    if (c === "(") stack.push(i);
    else if (c === ")") {
      const open = stack.pop();
      if (open === undefined) return true;
      const body = plain.slice(open + 1, i);
      const next = plain[i + 1];
      if ((next === "*" || next === "+" || next === "{" || next === "?") && /[*+{]|\|/.test(body)) return true;
    }
  }
  return stack.length > 0;
}

/** Compile one pattern. Null with a reason when it is not acceptable. */
export function compilePattern(pattern: string): { ok: true; test: (url: string) => boolean } | { ok: false; reason: string } {
  const p = pattern.trim();
  if (!p) return { ok: false, reason: "empty" };
  if (p.length > CONFIG_LIMITS.patternChars) return { ok: false, reason: "too_long" };
  const lit = REGEX_LITERAL.exec(p);
  if (lit) {
    if (unsafeRegex(lit[1]!)) return { ok: false, reason: "unsafe_regex" };
    try {
      const re = new RegExp(lit[1]!, lit[2]);
      return { ok: true, test: (url) => re.test(url) };
    } catch {
      return { ok: false, reason: "invalid_regex" };
    }
  }
  // Glob: * any run of characters, ? one character, everything else literal.
  // Unanchored, like a substring search, unless the pattern says otherwise:
  // "/blog/*" matches every URL containing "/blog/".
  const src = p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  const re = new RegExp(src, "i");
  return { ok: true, test: (url) => re.test(url) };
}

/** Include/exclude as one predicate. An empty include list includes everything. */
export function urlFilter(include: readonly string[], exclude: readonly string[]): (url: string) => boolean {
  const compile = (list: readonly string[]) =>
    list.map(compilePattern).flatMap((c) => (c.ok ? [c.test] : []));
  const inc = compile(include);
  const exc = compile(exclude);
  return (url) => (inc.length === 0 || inc.some((t) => t(url))) && !exc.some((t) => t(url));
}

/** Apply the query-string option to an already-normalised URL. */
export function applyQueryMode(url: string, mode: QueryMode, params: readonly string[]): string {
  if (mode === "keep") return url;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (!u.search) return url;
  if (mode === "strip_all") u.search = "";
  else {
    const drop = new Set(params.map((p) => p.toLowerCase()));
    for (const name of [...u.searchParams.keys()]) if (drop.has(name.toLowerCase())) u.searchParams.delete(name);
  }
  return u.toString();
}

/** The robots.txt user-agent token the crawl obeys for a UA choice. */
export function robotsToken(choice: UserAgentChoice, custom: string | null, defaultToken: string): string {
  if (choice === "googlebot_smartphone" || choice === "googlebot_desktop") return "Googlebot";
  if (choice === "custom" && custom) {
    // The product token of "Name/1.0 (comment)" — what robots.txt groups match.
    const m = /^\s*([A-Za-z0-9_-]+)/.exec(custom);
    if (m) return m[1]!;
  }
  return defaultToken;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const noCrLf = (s: string) => !/[\r\n\0]/.test(s);
const secretInput = (max: number) =>
  z.union([z.string().max(max).refine(noCrLf, "control characters"), z.null(), z.object({ keep: z.literal(true) })]);

const TopPagesSchema = z.object({
  pages: z.number().int().min(1).max(1_000),
  segment: z.number().int().min(0).nullable().default(null),
});

export const CrawlConfigInputSchema = z.object({
  maxUrls: z.number().int().min(1).nullable().default(null),
  maxDepth: z.number().int().min(0).max(CONFIG_LIMITS.maxDepth).nullable().default(null),
  include: z.array(z.string().max(CONFIG_LIMITS.patternChars)).max(CONFIG_LIMITS.patterns).default([]),
  exclude: z.array(z.string().max(CONFIG_LIMITS.patternChars)).max(CONFIG_LIMITS.patterns).default([]),
  crawlSubdomains: z.boolean().default(DEFAULT_CRAWL_CONFIG.crawlSubdomains),
  followNofollow: z.boolean().default(DEFAULT_CRAWL_CONFIG.followNofollow),
  queryStrings: z.enum(QUERY_MODES).default("keep"),
  stripParams: z
    .array(z.string().trim().min(1).max(64).regex(/^[\w.[\]-]+$/))
    .max(CONFIG_LIMITS.stripParams)
    .default([]),
  speed: z.number().min(CONFIG_LIMITS.minSpeed).max(CONFIG_LIMITS.maxSpeed).default(DEFAULT_CRAWL_CONFIG.speed),
  userAgent: z.enum(USER_AGENTS).default("echorank"),
  customUserAgent: z.string().trim().max(CONFIG_LIMITS.customUaChars).refine(noCrLf).nullable().default(null),
  headers: z
    .array(
      z.object({
        name: z.string().trim().regex(/^[A-Za-z0-9-]{1,64}$/),
        value: secretInput(CONFIG_LIMITS.headerValueChars),
      }),
    )
    .max(CONFIG_LIMITS.headers)
    .default([]),
  cookies: secretInput(CONFIG_LIMITS.cookieChars).default(null),
  basicAuth: z
    .object({
      user: z.string().max(CONFIG_LIMITS.basicUserChars).refine((s) => noCrLf(s) && !s.includes(":")),
      password: secretInput(CONFIG_LIMITS.basicPasswordChars),
    })
    .nullable()
    .default(null),
  respectRobots: z.boolean().default(true),
  customRobots: z.string().max(CONFIG_LIMITS.customRobotsChars).nullable().default(null),
  extractors: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(CONFIG_LIMITS.nameChars),
        kind: z.enum(EXTRACTOR_KINDS),
        expr: z.string().trim().min(1).max(CONFIG_LIMITS.exprChars),
        attr: z.string().trim().max(CONFIG_LIMITS.attrChars).regex(/^[\w:.-]*$/).nullable().default(null),
        multiple: z.boolean().default(false),
      }),
    )
    .max(50)
    .default([]),
  searches: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(CONFIG_LIMITS.nameChars),
        pattern: z.string().min(1).max(CONFIG_LIMITS.exprChars),
        isRegex: z.boolean().default(false),
      }),
    )
    .max(50)
    .default([]),
  addData: z
    .object({
      psi: TopPagesSchema.nullable().default(null),
      backlinks: TopPagesSchema.nullable().default(null),
    })
    .nullable()
    .default(null),
  useLogin: z.boolean().default(false),
  semantic: z.object({ pages: z.number().int().min(1).max(5_000), segment: z.number().int().min(0).nullable().default(null) }).nullable().default(null),
  inspection: z.object({ pages: z.number().int().min(1).max(2_000), segment: z.number().int().min(0).nullable().default(null) }).nullable().default(null),
  ai: z
    .object({
      provider: z.enum(AI_PROVIDERS),
      prompts: z
        .array(z.object({ preset: z.enum(AI_PRESETS), text: z.string().trim().max(AI_LIMITS.customChars).nullable().default(null) }))
        .min(1)
        .max(AI_LIMITS.prompts),
      top: TopPagesSchema,
    })
    .nullable()
    .default(null),
  js: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(JS_LIMITS.nameChars),
        preset: z.enum(JS_PRESETS),
        selector: z.string().trim().max(JS_LIMITS.selectorChars).nullable().default(null),
        code: z.string().max(JS_LIMITS.codeChars).nullable().default(null),
      }),
    )
    .max(20)
    .default([]),
});

export type ConfigProblem =
  | { field: string; code: "requires_verified_site" }
  | { field: string; code: "invalid_pattern"; pattern: string; reason: string }
  | { field: string; code: "reserved_header"; name: string }
  | { field: string; code: "custom_ua_missing" }
  | { field: "extractors" | "searches" | "addData.psi" | "addData.backlinks"; code: "over_plan_cap"; limit: number }
  | { field: "addData.psi" | "addData.backlinks"; code: "unknown_segment" }
  | { field: "js"; code: "over_plan_cap"; limit: number }
  | { field: "ai"; code: "over_plan_cap"; limit: number }
  | { field: "ai" | "semantic"; code: "ai_key_missing"; provider: "openai" | "gemini" }
  | { field: "semantic"; code: "over_plan_cap"; limit: number }
  | { field: "semantic"; code: "unknown_segment" }
  | { field: "inspection"; code: "over_plan_cap"; limit: number }
  | { field: "inspection"; code: "gsc_not_covering" }
  | { field: "inspection"; code: "unknown_segment" }
  | { field: "ai"; code: "ai_unavailable" }
  | { field: "ai"; code: "invalid_prompt"; index: number }
  | { field: "ai"; code: "unknown_segment" }
  | { field: "login"; code: "login_missing" }
  | { field: "js"; code: "requires_render" }
  | { field: "js"; code: "invalid_snippet"; index: number; reason: "selector_missing" | "code_missing" }
  | { field: "extractors" | "searches"; code: "invalid_expression"; index: number; reason: string };

/** A regex an extractor or search may run: compiles, and passes unsafeRegex. Null when fine. */
export function regexProblem(source: string): string | null {
  if (unsafeRegex(source)) return "unsafe_regex";
  try {
    new RegExp(source, "g");
    return null;
  } catch {
    return "invalid_regex";
  }
}

/**
 * Check a parsed input against the plan and the site's verification. The URL
 * cap is clamped silently (the plan's ceiling is not an error); everything
 * else that cannot be honoured is a problem the caller returns as a 400.
 */
export function checkCrawlConfig(
  input: CrawlConfigInput,
  ctx: {
    urlCap: number;
    verified: boolean;
    /** Plan caps (plan-config crawlExtractors / crawlSearches). Absent = 0: a caller that forgets refuses, never allows. */
    extractorCap?: number;
    searchCap?: number;
    /** Phase 4d caps (plan-config crawlPsiPages / crawlBacklinkPages). Absent = 0. */
    psiCap?: number;
    backlinkCap?: number;
    /** Phase 4e: plan crawlJsSnippets (absent = 0), and whether the crawl renders (JS runs on rendered pages only; absent = not checked, as when saving defaults). */
    jsSnippetCap?: number;
    renders?: boolean;
    /** Phase 4e AI: plan crawlAiPages (absent = 0); which tenant keys are saved; whether Claude (Marketing Studio) is on the plan. Absent = not checked. */
    aiPageCap?: number;
    /** Phase 4g: plan crawlSemanticPages / crawlInspectionPages (absent = 0), and whether the tenant's GSC property covers the host (absent = not checked). */
    semanticCap?: number;
    inspectionCap?: number;
    gscCovers?: boolean;
    aiKeys?: { openai: boolean; gemini: boolean };
    claudeAvailable?: boolean;
    /** Server-side syntax check for css / xpath expressions (needs cheerio / xpath). */
    checkExpr?: (e: Extractor) => string | null;
  },
): { config: CrawlConfigInput; problems: ConfigProblem[] } {
  const problems: ConfigProblem[] = [];
  const config: CrawlConfigInput = {
    ...input,
    maxUrls: input.maxUrls === null ? null : Math.min(input.maxUrls, ctx.urlCap),
    include: input.include.map((p) => p.trim()).filter(Boolean),
    exclude: input.exclude.map((p) => p.trim()).filter(Boolean),
    customRobots: input.customRobots?.trim() ? input.customRobots : null,
    customUserAgent: input.userAgent === "custom" ? input.customUserAgent : null,
    extractors: (input.extractors ?? []).map((e) => ({ ...e, attr: e.attr?.trim() ? e.attr.trim() : null })),
    searches: input.searches ?? [],
    addData: input.addData ? { psi: input.addData.psi ?? null, backlinks: input.addData.backlinks ?? null } : null,
  };
  // Phase 4d: an opt-in whose feature is off in production is dropped, not refused.
  if (config.addData) {
    if (!flag("crawl.psi")) config.addData.psi = null;
    if (!flag("crawl.backlinks")) config.addData.backlinks = null;
    if (!config.addData.psi && !config.addData.backlinks) config.addData = null;
  }
  const psiCap = ctx.psiCap ?? 0;
  const backlinkCap = ctx.backlinkCap ?? 0;
  if (config.addData?.psi && config.addData.psi.pages > psiCap) problems.push({ field: "addData.psi", code: "over_plan_cap", limit: psiCap });
  if (config.addData?.backlinks && config.addData.backlinks.pages > backlinkCap) problems.push({ field: "addData.backlinks", code: "over_plan_cap", limit: backlinkCap });
  // Phase 4e custom JavaScript: dropped when the feature is off, refused unverified, capped, render only.
  config.js = flag("crawl.customJs") ? (input.js ?? []) : [];
  if (config.js.length) {
    const jsCap = ctx.jsSnippetCap ?? 0;
    if (config.js.length > jsCap) problems.push({ field: "js", code: "over_plan_cap", limit: jsCap });
    if (!ctx.verified) problems.push({ field: "js", code: "requires_verified_site" });
    if (ctx.renders === false) problems.push({ field: "js", code: "requires_render" });
    config.js.forEach((s, index) => {
      if (s.preset === "loadMore" && !s.selector?.trim()) problems.push({ field: "js", code: "invalid_snippet", index, reason: "selector_missing" });
      if (s.preset === "custom" && !s.code?.trim()) problems.push({ field: "js", code: "invalid_snippet", index, reason: "code_missing" });
    });
  }
  // Phase 4e AI prompts: dropped when the feature is off; capped; the provider must be usable.
  config.ai = flag("crawl.ai") ? (input.ai ?? null) : null;
  if (config.ai) {
    const aiCap = ctx.aiPageCap ?? 0;
    if (config.ai.top.pages > aiCap) problems.push({ field: "ai", code: "over_plan_cap", limit: aiCap });
    config.ai.prompts.forEach((p, index) => {
      if (p.preset === "custom" && !p.text?.trim()) problems.push({ field: "ai", code: "invalid_prompt", index });
    });
    const provider = config.ai.provider;
    if (provider !== "claude" && ctx.aiKeys && !ctx.aiKeys[provider]) problems.push({ field: "ai", code: "ai_key_missing", provider });
    if (provider === "claude" && ctx.claudeAvailable === false) problems.push({ field: "ai", code: "ai_unavailable" });
  }
  // Phase 4g semantic duplicates: dropped when off; capped; needs the tenant's OpenAI key.
  config.semantic = flag("crawl.semantic") ? (input.semantic ?? null) : null;
  if (config.semantic) {
    const cap = ctx.semanticCap ?? 0;
    if (config.semantic.pages > cap) problems.push({ field: "semantic", code: "over_plan_cap", limit: cap });
    if (ctx.aiKeys && !ctx.aiKeys.openai) problems.push({ field: "semantic", code: "ai_key_missing", provider: "openai" });
  }
  // Phase 4g URL Inspection: dropped when off; capped; needs a GSC property covering the host.
  config.inspection = flag("crawl.inspection") ? (input.inspection ?? null) : null;
  if (config.inspection) {
    const cap = ctx.inspectionCap ?? 0;
    if (config.inspection.pages > cap) problems.push({ field: "inspection", code: "over_plan_cap", limit: cap });
    if (ctx.gscCovers === false) problems.push({ field: "inspection", code: "gsc_not_covering" });
  }
  // Phase 4e forms login: never from input; useLogin asks for the saved one, verified sites only.
  delete config.login;
  config.useLogin = flag("crawl.login") ? Boolean(input.useLogin) : false;
  if (config.useLogin && !ctx.verified) problems.push({ field: "login", code: "requires_verified_site" });
  // Never from input: the server snapshots the host's saved segments.
  delete config.segments;
  const extractorCap = ctx.extractorCap ?? 0;
  const searchCap = ctx.searchCap ?? 0;
  if (config.extractors.length > extractorCap) problems.push({ field: "extractors", code: "over_plan_cap", limit: extractorCap });
  if (config.searches.length > searchCap) problems.push({ field: "searches", code: "over_plan_cap", limit: searchCap });
  config.extractors.forEach((e, index) => {
    const reason = e.kind === "regex" ? regexProblem(e.expr) : (ctx.checkExpr?.(e) ?? null);
    if (reason) problems.push({ field: "extractors", code: "invalid_expression", index, reason });
  });
  config.searches.forEach((s, index) => {
    const reason = s.isRegex ? regexProblem(s.pattern) : null;
    if (reason) problems.push({ field: "searches", code: "invalid_expression", index, reason });
  });
  for (const field of ["include", "exclude"] as const) {
    for (const pattern of config[field]) {
      const c = compilePattern(pattern);
      if (!c.ok) problems.push({ field, code: "invalid_pattern", pattern, reason: c.reason });
    }
  }
  for (const h of config.headers) {
    const n = h.name.toLowerCase();
    if (RESERVED_HEADERS.has(n) || n.startsWith("proxy-") || n.startsWith("sec-")) {
      problems.push({ field: "headers", code: "reserved_header", name: h.name });
    }
  }
  if (config.userAgent === "custom" && !config.customUserAgent) problems.push({ field: "customUserAgent", code: "custom_ua_missing" });
  if (!ctx.verified) {
    if (config.userAgent !== "echorank") problems.push({ field: "userAgent", code: "requires_verified_site" });
    if (!config.respectRobots) problems.push({ field: "respectRobots", code: "requires_verified_site" });
  }
  return { config, problems };
}

/** A stored config as the UI may see it: secrets reduced to "set". */
export function viewCrawlConfig(stored: StoredCrawlConfig | null): CrawlConfigView | null {
  if (!stored) return null;
  const set = (s: StoredSecret | null): SecretView => (s ? { set: true } : null);
  return {
    ...stored,
    headers: stored.headers.map((h) => ({ name: h.name, value: { set: true } })),
    cookies: set(stored.cookies),
    basicAuth: stored.basicAuth ? { user: stored.basicAuth.user, password: { set: true } } : null,
    login: stored.login ? { ...stored.login, username: { set: true }, password: { set: true } } : null,
  };
}

/** Phase 4e: a site's saved defaults as columns — the snippets live in jsSnippets, the login in login, neither in config. */
export function siteDefaultColumns(stored: StoredCrawlConfig): { config: object; jsSnippets: object } {
  // The login has its own column and route (crawl_site_defaults.login); it is never saved from a crawl's config.
  const { js, login: _login, useLogin: _useLogin, ...rest } = stored;
  void _login;
  void _useLogin;
  return { config: rest as object, jsSnippets: (js ?? []) as object };
}

/** A site's saved defaults read back: config with its jsSnippets column folded in. */
export function readSiteDefaults(config: unknown, jsSnippets: unknown): StoredCrawlConfig | null {
  const stored = readStoredConfig(config);
  if (!stored) return null;
  return Array.isArray(jsSnippets) ? { ...stored, js: jsSnippets as JsSnippet[] } : stored;
}

/** A stored config read back from JSON, with defaults for any missing key (configs saved by an older build). */
export function readStoredConfig(raw: unknown): StoredCrawlConfig | null {
  if (!raw || typeof raw !== "object") return null;
  return { ...DEFAULT_CRAWL_CONFIG, ...(raw as Partial<StoredCrawlConfig>) };
}
