// src/lib/site-audit/checks.ts
//
// Which OnPage checks are PROBLEMS, and how serious each one is.
//
// This is a WHITELIST, deliberately. OnPage's `checks` block counts pages
// where each named check is true, and some of those are GOOD things —
// `seo_friendly_url`, `is_https`, `has_html_doctype`. Classifying every key
// generically would report "412 pages have SEO-friendly URLs" as an issue, so
// only checks whose TRUE value means something is wrong appear here.
//
// Unknown keys are ignored rather than defaulted into a bucket: a new upstream
// check we have not reviewed could be either polarity, and silently calling it
// an error would be worse than not showing it. The parser collects them into
// IssuesSection.unclassified and the poller logs them, so the gap is visible.

export type IssueSeverity = "error" | "warning" | "notice";

/** One catalogued problem check. */
export interface CheckDefinition {
  severity: IssueSeverity;
  /** Stable group key so the UI can bucket related checks together. */
  group:
    | "availability"
    | "links"
    | "content"
    | "meta"
    | "performance"
    | "canonical"
    | "security";
}

/**
 * Problem checks, by OnPage's own key.
 *
 * Severity follows the practical rule: ERROR = the page is broken or invisible
 * to search engines; WARNING = it works but is actively costing rankings;
 * NOTICE = worth tidying.
 */
export const PROBLEM_CHECKS: Record<string, CheckDefinition> = {
  // ── Availability: the page does not work ──
  is_4xx_code: { severity: "error", group: "availability" },
  is_5xx_code: { severity: "error", group: "availability" },
  is_broken: { severity: "error", group: "availability" },
  is_redirect_loop: { severity: "error", group: "availability" },
  redirect_loop: { severity: "error", group: "availability" },

  // ── Links and resources ──
  has_links_to_redirects: { severity: "notice", group: "links" },
  is_link_relation_conflict: { severity: "warning", group: "links" },
  is_orphan_page: { severity: "warning", group: "links" },

  // ── Meta: how the page appears in results ──
  no_title: { severity: "error", group: "meta" },
  no_description: { severity: "warning", group: "meta" },
  no_h1_tag: { severity: "warning", group: "meta" },
  duplicate_title_tag: { severity: "error", group: "meta" },
  title_too_long: { severity: "notice", group: "meta" },
  title_too_short: { severity: "notice", group: "meta" },
  irrelevant_title: { severity: "notice", group: "meta" },
  irrelevant_description: { severity: "notice", group: "meta" },
  irrelevant_meta_keywords: { severity: "notice", group: "meta" },
  no_favicon: { severity: "notice", group: "meta" },
  no_image_alt: { severity: "warning", group: "meta" },
  no_image_title: { severity: "notice", group: "meta" },
  // NOTE: seo_friendly_url and its four *_check siblings are POSITIVE — true
  // means the URL passes. Verified against the recorded envelope: 24 pages
  // "have" seo_friendly_url_characters_check while only 13 have
  // seo_friendly_url overall, which is only consistent if the *_check keys
  // count PASSES. Cataloguing them as problems reported 24 healthy pages as
  // issues. Same for `canonical`, `has_html_doctype` and `is_https`.

  // ── Content ──
  low_content_rate: { severity: "warning", group: "content" },
  low_character_count: { severity: "notice", group: "content" },
  small_page_size: { severity: "notice", group: "content" },
  deprecated_html_tags: { severity: "notice", group: "content" },
  no_content_encoding: { severity: "notice", group: "content" },
  no_encoding_meta_tag: { severity: "notice", group: "content" },
  large_page_size: { severity: "notice", group: "content" },
  frame: { severity: "notice", group: "content" },
  lorem_ipsum: { severity: "warning", group: "content" },

  // ── Performance ──
  high_loading_time: { severity: "warning", group: "performance" },
  high_waiting_time: { severity: "notice", group: "performance" },
  no_doctype: { severity: "notice", group: "performance" },
  size_greater_than_3mb: { severity: "warning", group: "performance" },
  has_render_blocking_resources: { severity: "notice", group: "performance" },

  // ── Canonical ──
  canonical_to_broken: { severity: "error", group: "canonical" },
  canonical_to_redirect: { severity: "warning", group: "canonical" },
  canonical_chain: { severity: "warning", group: "canonical" },
  has_meta_refresh_redirect: { severity: "notice", group: "canonical" },

  // ── Security / protocol ──
  is_http: { severity: "warning", group: "security" },
  https_to_http_links: { severity: "warning", group: "security" },
  no_https_redirect: { severity: "warning", group: "security" },
};

/**
 * Issues that arrive as first-class `page_metrics` fields rather than entries
 * in the `checks` block.
 *
 * Without these the Issues list silently omits the single most common real
 * finding: the verification crawl of echorank360.com reported duplicate_title
 * on 20 of 25 pages, and none of it appeared, because `duplicate_title` is a
 * metric and only `checks` keys were being read.
 */
export const METRIC_ISSUES: Record<string, CheckDefinition> = {
  duplicate_title: { severity: "error", group: "meta" },
  duplicate_description: { severity: "warning", group: "meta" },
  duplicate_content: { severity: "warning", group: "content" },
  broken_links: { severity: "error", group: "links" },
  broken_resources: { severity: "error", group: "links" },
  non_indexable: { severity: "warning", group: "availability" },
};

/** Severity order for rendering — worst first. */
export const SEVERITY_ORDER: IssueSeverity[] = ["error", "warning", "notice"];

export function checkDefinition(key: string): CheckDefinition | null {
  return PROBLEM_CHECKS[key] ?? METRIC_ISSUES[key] ?? null;
}
