// src/lib/ai-monitor/wizard/site-analysis.ts
//
// One fetch of one page, for the wizard.
//
// ONE FETCH, NOT A CRAWL, AND THAT IS A PRODUCT DECISION rather than a
// simplification. ../onboarding/crawl.ts exists and is better at this — twelve
// pages, depth two, robots-aware — and it takes up to 45 seconds. That is right
// for a background onboarding job and wrong for a form a human is sitting in
// front of: a wizard that stalls for most of a minute after the domain field
// gets abandoned. The homepage title, meta description and first heading are
// what a person would skim to say what a company does, and they are enough to
// brief the generator.
//
// REUSES site-crawler's fetcher rather than calling fetch() directly, so the
// timeout, the user agent, the redirect policy and the size cap are the ones
// the rest of the product already uses. A third opinion about how to fetch a
// stranger's page is a third set of ways to hang a worker.
//
// EVERYTHING IS OPTIONAL. A site that 404s, blocks us, or returns a JS shell
// with no meta tags is a normal outcome, not an error: the wizard carries on
// with whatever the user typed. Failing here would mean a brand cannot be set
// up because its marketing site is behind Cloudflare.

import * as cheerio from "cheerio";
import { fetchPage } from "@/lib/site-crawler/fetch";

/** Enough to brief a generator; beyond this is boilerplate and nav. */
export const MAX_SUMMARY_CHARS = 1_200;

export interface SiteAnalysis {
  url: string;
  ok: boolean;
  title: string | null;
  description: string | null;
  /** First h1, which is usually the positioning line the meta tag is not. */
  heading: string | null;
  /** title + description + heading, trimmed — what the generator is given. */
  summary: string;
  /** Why nothing was read. Null on success. */
  error: string | null;
}

function firstNonEmpty(...values: (string | undefined | null)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/** Pull the handful of fields worth having out of one HTML document. */
export function extractSiteFields(html: string): Omit<SiteAnalysis, "url" | "ok" | "error"> {
  const $ = cheerio.load(html ?? "");

  const title = firstNonEmpty(
    $('meta[property="og:title"]').attr("content"),
    $("title").first().text(),
  );
  const description = firstNonEmpty(
    $('meta[name="description"]').attr("content"),
    $('meta[property="og:description"]').attr("content"),
  );
  const heading = firstNonEmpty($("h1").first().text());

  // De-duplicated: a site whose <title>, og:title and <h1> are the same string
  // would otherwise brief the generator with it three times and crowd out the
  // description.
  const parts: string[] = [];
  for (const part of [title, description, heading]) {
    if (!part) continue;
    if (parts.some((existing) => existing.toLowerCase() === part.toLowerCase())) continue;
    parts.push(part);
  }

  return {
    title,
    description,
    heading,
    summary: parts.join(" — ").replace(/\s+/g, " ").trim().slice(0, MAX_SUMMARY_CHARS),
  };
}

const EMPTY = { title: null, description: null, heading: null, summary: "" };

export interface AnalyseSiteDeps {
  fetch?: typeof fetchPage;
}

/**
 * Read one homepage.
 *
 * Never throws and never rejects: every failure comes back as `ok: false` with
 * a reason, because the only caller is a wizard step that must keep working
 * when a site does not.
 */
export async function analyseSite(
  domain: string,
  deps: AnalyseSiteDeps = {},
): Promise<SiteAnalysis> {
  const url = `https://${domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/`;
  const get = deps.fetch ?? fetchPage;

  try {
    const outcome = await get(url);
    // `html` is populated only for an HTML response inside the size cap, so its
    // absence covers a 404, a PDF, a redirect loop and a body too large alike.
    // The distinction those cases need is in `error`/`statusCode`, not here.
    if (!outcome.html) {
      return {
        url,
        ok: false,
        ...EMPTY,
        error: outcome.error ?? `status ${outcome.statusCode ?? "unknown"}`,
      };
    }
    return { url, ok: true, ...extractSiteFields(outcome.html), error: null };
  } catch (err) {
    return { url, ok: false, ...EMPTY, error: err instanceof Error ? err.message : String(err) };
  }
}
