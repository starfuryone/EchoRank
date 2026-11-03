// src/lib/site-crawler/rule-summary.ts
//
// Per-rule tallies for a crawl, whatever its age.
//
// A 3a+ crawl's summary carries `issues` / `issuesByKind`, written once by
// aggregation. Older crawls do not: pre-Phase-2 jobs have no summary at all,
// Phase 2 jobs have one without those fields. Rather than backfill them, the
// tallies are computed on read from crawl_issues (crawlJobId was backfilled by
// the 3a migration), mapping legacy `type`s to rule ids through legacy-map.ts
// and taking kind and priority from the registry. A rule with no findings is
// absent, never a zero — so an old crawl never shows zeroes it did not count.

import "server-only";
import { RULE_BY_ID, type RuleKind } from "@/lib/crawl-rules";
import { prisma } from "@/lib/prisma";
import type { RuleTally } from "./aggregate";
import { LEGACY_RULE, ruleIdOf } from "./legacy-map";

export interface RuleTallies {
  issues: Record<string, RuleTally>;
  issuesByKind: Record<RuleKind, number>;
}

export async function computeRuleTallies(jobId: string): Promise<RuleTallies> {
  const groups = await prisma.crawlIssue.groupBy({
    by: ["ruleId", "type"],
    where: { crawlJobId: jobId },
    _count: { _all: true },
  });
  const issues: Record<string, RuleTally> = {};
  const issuesByKind: Record<RuleKind, number> = { issue: 0, warning: 0, opportunity: 0 };
  for (const g of groups) {
    const id = ruleIdOf(g);
    const rule = id ? RULE_BY_ID.get(id) : undefined;
    if (!id || !rule) continue;
    const t = (issues[id] ??= { count: 0, kind: rule.kind, priority: rule.priority });
    t.count += g._count._all;
    issuesByKind[rule.kind] += g._count._all;
  }
  return { issues, issuesByKind };
}

/** The tallies a summary already carries, or computed ones when it carries none. */
export async function ruleTalliesFor(jobId: string, summary: unknown): Promise<RuleTallies & { computed: boolean }> {
  const s = (summary ?? {}) as Partial<RuleTallies>;
  if (s.issues && s.issuesByKind) return { issues: s.issues, issuesByKind: s.issuesByKind, computed: false };
  return { ...(await computeRuleTallies(jobId)), computed: true };
}

/** Legacy `type`s that map to a rule id (pre-3a rows carry no ruleId). */
export function legacyTypesFor(ruleId: string): string[] {
  return Object.entries(LEGACY_RULE)
    .filter(([, id]) => id === ruleId)
    .map(([type]) => type);
}

/** crawl_issues filter for one rule in one crawl, old rows included. */
export function ruleIssueWhere(jobId: string, ruleId: string) {
  const legacy = legacyTypesFor(ruleId);
  return {
    crawlJobId: jobId,
    OR: [{ ruleId }, ...(legacy.length ? [{ ruleId: null, type: { in: legacy } }] : [])],
  };
}
