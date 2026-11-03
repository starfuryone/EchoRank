// The evaluator. Facts in, Issue[] out; no I/O, no clock, no globals.
//
// Page rules run once per fetched page, on the in-memory PageFacts. Site rules
// run once per STORED page during the consumer's aggregation step, with the
// results of its site-wide queries in ctx.site / ctx.job. A rule that throws
// is skipped, not fatal: one bad rule must not lose a page's other findings
// (the fixture tests are what keep rules from throwing).

import {
  EVIDENCE_VALUE_MAX,
  type Applies,
  type Evidence,
  type Issue,
  type PageFacts,
  type PageRule,
  type PageRuleCtx,
  type Rule,
  type SiteRule,
  type SiteRuleCtx,
  type StoredPageFacts,
} from "./types";
import { truncate } from "./util/text";

export function pageRule(rule: Omit<PageRule, "scope">): PageRule {
  return { ...rule, scope: "page" };
}

export function siteRule(rule: Omit<SiteRule, "scope">): SiteRule {
  return { ...rule, scope: "site" };
}

/**
 * Build evidence: strings truncated to EVIDENCE_VALUE_MAX, undefined dropped.
 * Every rule returns through this, so the size contract holds by construction.
 */
export function ev(values: Record<string, string | number | boolean | null | undefined> = {}): Evidence {
  const out: Evidence = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) continue;
    out[k] = typeof v === "string" ? truncate(v, EVIDENCE_VALUE_MAX) : v;
  }
  return out;
}

export function isOk(status: number | null): boolean {
  return status !== null && status >= 200 && status < 300;
}

export function appliesTo(applies: Applies, page: PageFacts): boolean {
  switch (applies) {
    case "any":
      return true;
    case "fetched":
      return !page.blockedByRobots;
    case "html":
      return !page.blockedByRobots && page.html !== null;
    case "ok_html":
      return !page.blockedByRobots && page.html !== null && isOk(page.statusCode);
  }
}

function enabled(rule: Rule, capabilities: readonly string[]): boolean {
  return !rule.requires || rule.requires.every((c) => capabilities.includes(c));
}

function issue(rule: Rule, evidence: Evidence): Issue {
  return { ruleId: rule.id, kind: rule.kind, priority: rule.priority, evidence };
}

export function evaluatePage(
  rules: readonly Rule[],
  page: PageFacts,
  ctx: PageRuleCtx = { capabilities: [] },
): Issue[] {
  const out: Issue[] = [];
  for (const rule of rules) {
    if (rule.scope !== "page" || !enabled(rule, ctx.capabilities)) continue;
    if (!appliesTo(rule.applies ?? "ok_html", page)) continue;
    try {
      const found = rule.detect(page, ctx);
      if (found) out.push(issue(rule, found));
    } catch {
      // skipped; see the header
    }
  }
  return out;
}

export function evaluateSite(rules: readonly Rule[], page: StoredPageFacts, ctx: SiteRuleCtx): Issue[] {
  const out: Issue[] = [];
  for (const rule of rules) {
    if (rule.scope !== "site" || !enabled(rule, ctx.capabilities)) continue;
    try {
      const found = rule.detect(page, ctx);
      if (found) out.push(issue(rule, found));
    } catch {
      // skipped; see the header
    }
  }
  return out;
}
