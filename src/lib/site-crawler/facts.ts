// src/lib/site-crawler/facts.ts
//
// One fetched page → the crawl-rules package's PageFacts. This is the only
// place the crawler parses HTML for the rule engine; the package itself has
// no parser, so every consumer (this crawler, EchoPilot, llms.txt Studio)
// maps its own parse onto the same plain shape and gets the same verdicts.
//
// THE BODY IS NEVER RETURNED. Facts are counts, flags, short strings and URLs.
// The caller discards the HTML once this returns, as it always has.
//
// Two reads of the document, on purpose: cheerio for the element tree, and a
// few regexes over the RAW source for what a parser silently repairs (a
// missing doctype, a second <body>, a <div> inside <head>). Asking the
// repaired tree whether the source was broken always answers "no".

import "server-only";
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import {
  collapse,
  countWords,
  findPlaceholder,
  fleschReadingEase,
  isEnglish,
  utf8Bytes,
  type AnchorFact,
  type HtmlFacts,
  type ImageFact,
  type JsonLdBlock,
  type MicrodataItem,
  type PageFacts,
  type RawStructureFacts,
  type StructuredItem,
} from "@/lib/crawl-rules";
import { isInScope, normalizeCrawlUrl } from "./url";

/** Response headers the rules read; the crawler keeps these and drops the rest. */
export const RULE_HEADERS = [
  "content-type",
  "x-robots-tag",
  "link",
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
] as const;

export function pickRuleHeaders(get: (name: string) => string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of RULE_HEADERS) {
    const v = get(name);
    if (v !== null) out[name] = v;
  }
  return out;
}

export interface PageFactsInput {
  url: string;
  finalUrl: string;
  rootUrl: string;
  depth: number;
  blockedByRobots: boolean;
  statusCode: number | null;
  fetchError: string | null;
  redirectHops: number;
  redirectTarget: string | null;
  contentType: string | null;
  responseMs: number | null;
  bytes: number | null;
  inSitemap: boolean | null;
  headers: Record<string, string>;
  /** Null when the body was not read or is not HTML. */
  html: string | null;
}

export function buildPageFacts(input: PageFactsInput): PageFacts {
  const { html, ...rest } = input;
  return {
    ...rest,
    html: html === null ? null : extractHtmlFacts(html, input.finalUrl, input.rootUrl, input.bytes),
  };
}

const HEAD_ELEMENTS = new Set(["title", "meta", "link", "style", "script", "noscript", "base", "template"]);

/** Resolve, drop the fragment; the crawler's normalisation when it applies. */
function resolve(raw: string, base: string): string {
  const n = normalizeCrawlUrl(raw, base);
  if (n) return n;
  try {
    const u = new URL(raw, base);
    u.hash = "";
    return u.toString();
  } catch {
    return raw;
  }
}

export function extractHtmlFacts(html: string, pageUrl: string, rootUrl: string, bytes: number | null): HtmlFacts {
  const $ = cheerio.load(html);
  const inHead = (el: AnyNode) => $(el).closest("head").length > 0;
  const relHas = (el: Element, token: string) =>
    ($(el).attr("rel") ?? "").toLowerCase().split(/\s+/).includes(token);

  // Titles inside <svg> are accessible names for graphics, not page titles.
  const titleEls = $("title").filter((_, el) => $(el).closest("svg").length === 0);
  const titles = titleEls.map((_, el) => collapse($(el).text())).get();

  const metaDescEls = $('meta[name="description" i]');
  const metaDescriptions = metaDescEls.map((_, el) => collapse($(el).attr("content") ?? "")).get();
  const kw = $('meta[name="keywords" i]').first().attr("content");

  const robotsEls = $('meta[name="robots" i], meta[name="googlebot" i]');
  const robotsParts = robotsEls.map((_, el) => ($(el).attr("content") ?? "").trim().toLowerCase()).get().filter(Boolean);

  const canonicalEls = $("link[rel]").filter((_, el) => relHas(el, "canonical"));
  const hreflangEls = $("link[hreflang]").filter((_, el) => relHas(el, "alternate"));
  const nextEls = $("link[rel]").filter((_, el) => relHas(el, "next"));
  const prevEls = $("link[rel]").filter((_, el) => relHas(el, "prev") || relHas(el, "previous"));

  let h3BeforeH2 = false;
  const firstHeading = $("h2, h3").first();
  if (firstHeading.length && firstHeading.prop("tagName")?.toLowerCase() === "h3") h3BeforeH2 = true;

  const lang = ($("html").attr("lang") ?? "").trim() || null;

  // Visible text, as the crawler has always measured it.
  const $text = cheerio.load(html);
  $text("script, style, noscript, template, svg").remove();
  const text = collapse($text("body").text() || $text.root().text());
  const total = bytes ?? utf8Bytes(html);

  const metaCharset = $("meta[charset]").first().attr("charset");
  const httpEquivCt = $('meta[http-equiv="content-type" i]').first().attr("content");
  const charset =
    (metaCharset?.trim() || /charset=([^;\s]+)/i.exec(httpEquivCt ?? "")?.[1] || "").toLowerCase() || null;

  const anchors: AnchorFact[] = $("a[href]")
    .map((_, el) => {
      const raw = ($(el).attr("href") ?? "").trim();
      const href = resolve(raw, pageUrl);
      const normalized = normalizeCrawlUrl(raw, pageUrl);
      const text = collapse($(el).text()) || collapse($(el).find("img[alt]").first().attr("alt") ?? "");
      return {
        href,
        raw,
        text,
        rel: ($(el).attr("rel") ?? "").trim().toLowerCase(),
        target: ($(el).attr("target") ?? "").trim().toLowerCase(),
        internal: normalized !== null && isInScope(normalized, rootUrl),
      };
    })
    .get();

  const images: ImageFact[] = $("img")
    .map((_, el) => {
      const $el = $(el);
      const picture = $el.parent("picture");
      const sources = picture.find("source");
      const widthAttr = $el.attr("width");
      const width = widthAttr !== undefined && /^\d+$/.test(widthAttr.trim()) ? Number(widthAttr.trim()) : null;
      return {
        src: resolve(($el.attr("src") ?? "").trim(), pageUrl),
        alt: $el.attr("alt") === undefined ? null : ($el.attr("alt") ?? "").trim(),
        hasWidth: widthAttr !== undefined,
        hasHeight: $el.attr("height") !== undefined,
        width,
        loading: ($el.attr("loading") ?? "").trim().toLowerCase() || null,
        hasSrcset: $el.attr("srcset") !== undefined || sources.filter((_, s) => $(s).attr("srcset") !== undefined).length > 0,
        modernSource:
          sources.filter((_, s) => {
            const type = ($(s).attr("type") ?? "").toLowerCase();
            const srcset = ($(s).attr("srcset") ?? "").toLowerCase();
            return type === "image/webp" || type === "image/avif" || /\.(webp|avif)\b/.test(srcset);
          }).length > 0,
      };
    })
    .get();

  const resources: string[] = [];
  const pushAttr = (sel: string, attr: string) =>
    $(sel).each((_, el) => {
      const v = ($(el).attr(attr) ?? "").trim();
      if (v) resources.push(v);
    });
  pushAttr("img[src]", "src");
  pushAttr("script[src]", "src");
  $("link[href]").each((_, el) => {
    if (relHas(el, "stylesheet")) resources.push(($(el).attr("href") ?? "").trim());
  });
  pushAttr("iframe[src]", "src");
  pushAttr("video[src], audio[src], source[src], embed[src]", "src");
  pushAttr("object[data]", "data");

  const formActions = $("form")
    .map((_, el) => {
      const action = ($(el).attr("action") ?? "").trim();
      return action ? resolve(action, pageUrl) : pageUrl;
    })
    .get();

  const jsonLd: JsonLdBlock[] = $('script[type="application/ld+json" i]')
    .map((_, el) => parseJsonLd($(el).text()))
    .get();

  const microdata: MicrodataItem[] = $("[itemscope]")
    .map((_, el) => {
      const props = $(el)
        .find("[itemprop]")
        .filter((_, p) => $(p).parent().closest("[itemscope]").get(0) === el)
        .map((_, p) => ($(p).attr("itemprop") ?? "").trim())
        .get()
        .filter(Boolean);
      return { itemtype: ($(el).attr("itemtype") ?? "").trim() || null, props };
    })
    .get();
  const orphanItemprops = $("[itemprop]").filter((_, el) => $(el).parent().closest("[itemscope]").length === 0).length;

  return {
    titles,
    titlesOutsideHead: titleEls.filter((_, el) => !inHead(el)).length,
    metaDescriptions,
    metaDescriptionsOutsideHead: metaDescEls.filter((_, el) => !inHead(el)).length,
    metaKeywords: kw === undefined ? null : kw.trim(),
    h1: $("h1").map((_, el) => collapse($(el).text())).get(),
    h2: $("h2").map((_, el) => collapse($(el).text())).get(),
    h3BeforeH2,
    wordCount: countWords(text),
    fleschReadingEase: isEnglish(lang) ? fleschReadingEase(text) : null,
    placeholderText: findPlaceholder(text),
    textRatio: total > 0 ? Math.round((utf8Bytes(text) / total) * 1000) / 10 : 0,
    langAttr: lang,
    hasViewport: $('meta[name="viewport" i]').length > 0,
    charset,
    canonicals: canonicalEls.map((_, el) => ($(el).attr("href") ?? "").trim()).get(),
    canonicalsOutsideHead: canonicalEls.filter((_, el) => !inHead(el)).length,
    metaRobots: robotsParts.length ? robotsParts.join(", ") : null,
    metaRobotsOutsideHead: robotsEls.filter((_, el) => !inHead(el)).length,
    metaRefresh: $('meta[http-equiv="refresh" i]').first().attr("content")?.trim() ?? null,
    hreflang: hreflangEls
      .map((_, el) => ({
        lang: ($(el).attr("hreflang") ?? "").trim().toLowerCase(),
        href: resolve(($(el).attr("href") ?? "").trim(), pageUrl),
      }))
      .get(),
    hreflangOutsideHead: hreflangEls.filter((_, el) => !inHead(el)).length,
    relNext: nextEls.map((_, el) => resolve(($(el).attr("href") ?? "").trim(), pageUrl)).get(),
    relPrev: prevEls.map((_, el) => resolve(($(el).attr("href") ?? "").trim(), pageUrl)).get(),
    paginationOutsideHead: nextEls.add(prevEls).filter((_, el) => !inHead(el)).length,
    anchors,
    images,
    resources,
    formActions,
    jsonLd,
    microdata,
    orphanItemprops,
    raw: rawStructure(html),
  };
}

/** Stable JSON: keys sorted at every level, so equal blocks fingerprint equal. */
function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export function parseJsonLd(text: string): JsonLdBlock {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, fingerprint: null, items: [] };
  }
  const items: StructuredItem[] = [];
  const visit = (node: unknown, context: string | null) => {
    if (Array.isArray(node)) return node.forEach((n) => visit(n, context));
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const ctx = typeof obj["@context"] === "string" ? (obj["@context"] as string) : context;
    if (Array.isArray(obj["@graph"])) visit(obj["@graph"], ctx);
    const t = obj["@type"];
    const types = typeof t === "string" ? [t] : Array.isArray(t) ? t.filter((x): x is string => typeof x === "string") : [];
    const props = Object.keys(obj).filter((k) => !k.startsWith("@"));
    for (const type of types) items.push({ type, vocabulary: ctx, props });
  };
  visit(data, null);
  return { ok: true, fingerprint: canonicalJson(data), items };
}

export function rawStructure(html: string): RawStructureFacts {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const count = (re: RegExp) => (withoutComments.match(re) ?? []).length;
  const headAt = withoutComments.search(/<head[\s>]/i);
  const bodyAt = withoutComments.search(/<body[\s>]/i);
  const afterHtml = /<html[^>]*>\s*<([a-z][a-z0-9-]*)/i.exec(withoutComments);

  let invalidHeadElements: string[] = [];
  const head = /<head[\s>][\s\S]*?(?:<\/head>|(?=<body[\s>]))/i.exec(withoutComments);
  if (head) {
    const inner = head[0]
      .replace(/^<head[^>]*>/i, "")
      .replace(/<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, "");
    const names = [...inner.matchAll(/<([a-z][a-z0-9-]*)[\s/>]/gi)].map((m) => m[1]!.toLowerCase());
    invalidHeadElements = [...new Set(names.filter((n) => !HEAD_ELEMENTS.has(n) && n !== "head"))];
  }

  return {
    hasDoctype: /^\s*(?:<\?xml[^>]*>\s*)?<!doctype\s+html/i.test(withoutComments),
    htmlTagCount: count(/<html[\s>]/gi),
    headTagCount: count(/<head[\s>]/gi),
    bodyTagCount: count(/<body[\s>]/gi),
    bodyBeforeHead: bodyAt >= 0 && headAt >= 0 && bodyAt < headAt,
    headIsFirstChild: !!afterHtml && afterHtml[1]!.toLowerCase() === "head",
    invalidHeadElements,
  };
}
