"use client";

// The Issues view: /crawler/[id]/issues on its own, and the Results page's
// Issues tab. A hero (eyebrow, title, the crawl's host and date), a "biggest
// impact" banner, filter pills by kind with counts, family and segment selects,
// a sort (impact by default), and one expandable row per rule. An open row
// shows how to fix it, its evidence columns, the first 10 affected URLs (with
// "found on"), "See all pages" (the filtered Pages view) and its CSV.
//
// Rows come from GET /crawl/[id]/rules, the same per-rule tally as before: no
// new queries. Impact = priority weight (site-health.ts HEALTH_WEIGHTS: high
// 3, medium 1, low 0.25) × pages affected (findings when a tally has no page
// count: older crawls and segment filters).
//
// Rule names and descriptions come from the registry's client-safe half
// (crawl-rules-meta). They are English-only; fr and de-CH say so.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Download, Sparkles } from "lucide-react";
import { RULE_COPY } from "@/lib/crawl-rules-meta";
import type { DashLocale, SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import { HEALTH_WEIGHTS } from "@/lib/site-crawler/site-health";
import type { CrawlDto, RuleKindDto } from "@/lib/site-crawler/types";
import { CRAWLER_ROUTES, hostOfCrawl } from "./site-crawler-nav";

export interface IssueRule {
  ruleId: string;
  family: string | null;
  kind: RuleKindDto;
  priority: "high" | "medium" | "low";
  /** Findings. */
  urls: number;
  /** Distinct pages; null when the tally has none (older crawls, a segment filter). */
  pages?: number | null;
  share: number;
  bySegment?: number[];
}

interface RulesResponse {
  pagesCrawled: number;
  highPages?: number | null;
  rules: IssueRule[];
  segments?: string[];
}

interface RulePagesResponse {
  rows: { id: string; url: string; statusCode: number | null; foundOn?: string | null; evidence: Record<string, unknown> }[];
  total: number;
}

export type IssuesSort = "impact" | "pages" | "family" | "rule";
export const FIRST_AFFECTED = 10;

/** Pages a rule affects, or its findings when the tally has no page count. */
export const affected = (r: IssueRule) => r.pages ?? r.urls;

/** Priority weight × pages affected. */
export const ruleImpact = (r: IssueRule) => HEALTH_WEIGHTS[r.priority] * affected(r);

const nameOf = (id: string) => RULE_COPY[id]?.name ?? id;

export function sortRules(rows: IssueRule[], sort: IssuesSort, familyName: (f: string | null) => string = (f) => f ?? ""): IssueRule[] {
  const byName = (a: IssueRule, b: IssueRule) => nameOf(a.ruleId).localeCompare(nameOf(b.ruleId));
  const cmp: Record<IssuesSort, (a: IssueRule, b: IssueRule) => number> = {
    impact: (a, b) => ruleImpact(b) - ruleImpact(a) || affected(b) - affected(a) || byName(a, b),
    pages: (a, b) => affected(b) - affected(a) || ruleImpact(b) - ruleImpact(a) || byName(a, b),
    family: (a, b) => familyName(a.family).localeCompare(familyName(b.family)) || ruleImpact(b) - ruleImpact(a) || byName(a, b),
    rule: byName,
  };
  return [...rows].sort(cmp[sort]);
}

/** The banner's numbers: high-priority findings, and the distinct pages they sit on (null when unknown). */
export function impactSummary(rules: IssueRule[], highPages: number | null | undefined): { findings: number; pages: number | null } {
  const findings = rules.filter((r) => r.priority === "high").reduce((n, r) => n + r.urls, 0);
  return { findings, pages: typeof highPages === "number" ? highPages : null };
}

const KIND_DOT: Record<RuleKindDto, string> = { issue: "bg-red-500", warning: "bg-amber-500", opportunity: "bg-blue-500" };

function kindName(k: RuleKindDto, t: SiteCrawlerCopy) {
  return k === "issue" ? t.ovKindIssue : k === "warning" ? t.ovKindWarning : t.ovKindOpportunity;
}

const SELECT =
  "rounded-full border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
const CSV_LINK =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

function evidenceValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function RuleDetails({ crawlId, rule, seg, t, int }: { crawlId: string; rule: IssueRule; seg: string; t: SiteCrawlerCopy; int: Intl.NumberFormat }) {
  const u = t.ux;
  const copy = RULE_COPY[rule.ruleId];
  const [pages, setPages] = useState<RulePagesResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/${crawlId}/rules/${encodeURIComponent(rule.ruleId)}?page=1&pageSize=${FIRST_AFFECTED}&${seg}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RulePagesResponse | null) => {
        if (!cancelled) setPages(d ?? { rows: [], total: 0 });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [crawlId, rule.ruleId, seg]);
  const keys = useMemo(() => {
    const out: string[] = [];
    for (const r of pages?.rows ?? []) for (const k of Object.keys(r.evidence ?? {})) if (!out.includes(k)) out.push(k);
    return out;
  }, [pages]);
  const hasFoundOn = (pages?.rows ?? []).some((r) => r.foundOn);
  return (
    <div className="space-y-4 border-t border-gray-100 px-4 pb-4 pt-3">
      {copy?.howToFix && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{t.rulesHowToFix}</h4>
          <p className="mt-1 text-sm text-gray-700">{copy.howToFix}</p>
        </div>
      )}
      <p className="text-xs text-gray-600">
        {u.ruleShare(String(rule.share))}
        {rule.bySegment && rule.bySegment.length > 0 && (
          <span data-by-segment>
            {" "}
            · {u.ruleBySegment}: {rule.bySegment.map((n) => int.format(n)).join(" · ")}
          </span>
        )}
      </p>
      {pages && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            {u.firstAffected(int.format(pages.rows.length), int.format(pages.total))}
          </h4>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-xs" data-testid="rule-evidence">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {u.colUrl}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {u.colStatus}
                  </th>
                  {keys.map((k) => (
                    <th key={k} scope="col" className="px-3 py-2 font-medium">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pages.rows.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-[22rem] px-3 py-2 align-top">
                      <span className="block truncate font-mono text-gray-900" title={p.url}>
                        {p.url}
                      </span>
                      {hasFoundOn && p.foundOn && (
                        <span className="block truncate text-gray-600" title={p.foundOn}>
                          {t.p4a.colFoundOn}: {p.foundOn}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top tabular-nums text-gray-700">{p.statusCode ?? "—"}</td>
                    {keys.map((k) => (
                      <td key={k} className="max-w-[16rem] truncate px-3 py-2 align-top text-gray-700" title={evidenceValue(p.evidence?.[k])}>
                        {evidenceValue(p.evidence?.[k])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={CRAWLER_ROUTES.pages(crawlId, rule.ruleId)}
          className="text-sm font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {u.seeAllPages} <span aria-hidden="true">→</span>
        </Link>
        <a href={`/api/seo/v1/crawl/${crawlId}/rules/${encodeURIComponent(rule.ruleId)}?format=csv&${seg}`} className={CSV_LINK}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
          {t.exportCsv}
        </a>
      </div>
    </div>
  );
}

export function IssuesView({
  crawlId,
  crawl,
  locale,
  t,
  int,
  segmentNames = [],
  segment = "",
  onSegment,
  standalone = false,
  initialRule = null,
}: {
  crawlId: string;
  crawl: CrawlDto | null;
  locale: DashLocale;
  t: SiteCrawlerCopy;
  int: Intl.NumberFormat;
  /** The crawl's segment names (Phase 4b); none = no segment select. */
  segmentNames?: string[];
  /** Selected segment index as a string, "" = the whole crawl. */
  segment?: string;
  onSegment?: (value: string) => void;
  /** The /issues page: the title is the page's h1 and the host links to the full results. */
  standalone?: boolean;
  /** Open with this rule expanded (Fix first, ?rule=). */
  initialRule?: string | null;
}) {
  const u = t.ux;
  const seg = segment === "" ? "" : `segment=${encodeURIComponent(segment)}`;
  const [data, setData] = useState<RulesResponse | null>(null);
  const [kind, setKind] = useState<RuleKindDto | "all">("all");
  const [family, setFamily] = useState("");
  const [sort, setSort] = useState<IssuesSort>("impact");
  const [open, setOpen] = useState<Set<string>>(() => new Set(initialRule ? [initialRule] : []));
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/${crawlId}/rules?${seg}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RulesResponse | null) => {
        if (!cancelled) setData(d ?? { pagesCrawled: 0, rules: [] });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [crawlId, seg]);

  useEffect(() => {
    if (!initialRule || !data) return;
    document.getElementById(`rule-${initialRule}`)?.scrollIntoView?.({ block: "start" });
  }, [initialRule, data]);

  const familyName = (f: string | null) => (f ? (u.families[f] ?? f) : "");
  const rules = data?.rules ?? [];
  const families = [...new Set(rules.map((r) => r.family).filter((f): f is string => Boolean(f)))].sort((a, b) => familyName(a).localeCompare(familyName(b)));
  const inFamily = family ? rules.filter((r) => r.family === family) : rules;
  const counts = {
    all: inFamily.length,
    issue: inFamily.filter((r) => r.kind === "issue").length,
    warning: inFamily.filter((r) => r.kind === "warning").length,
    opportunity: inFamily.filter((r) => r.kind === "opportunity").length,
  };
  const rows = sortRules(kind === "all" ? inFamily : inFamily.filter((r) => r.kind === kind), sort, familyName);
  const impact = impactSummary(rules, data?.highPages);
  const Title = standalone ? "h1" : "h2";
  const host = crawl ? hostOfCrawl(crawl.rootUrl) : "";
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const empty = !data
    ? null
    : rules.length === 0
      ? segment
        ? u.emptySegment
        : t.rulesNone
      : rows.length === 0
        ? kind !== "all"
          ? (u.emptyKind[kind] ?? t.rulesNone)
          : u.emptyFamily
        : null;

  return (
    <section className="space-y-5" data-testid="issues-view" aria-labelledby="issues-title">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-gray-600">{u.issuesEyebrow}</p>
          <Title id="issues-title" className="mt-1 text-2xl font-semibold text-gray-900">
            {u.issuesTitle}
          </Title>
          <p className="mt-1 text-sm text-gray-600">{u.issuesSubhead}</p>
        </div>
        {crawl && (
          <div className="min-w-0 shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:max-w-xs" data-testid="issues-crawl-card">
            {standalone ? (
              <Link
                href={CRAWLER_ROUTES.results(crawl.id)}
                className="block truncate text-sm font-semibold text-gray-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {host}
              </Link>
            ) : (
              <p className="truncate text-sm font-semibold text-gray-900">{host}</p>
            )}
            <p className="text-xs text-gray-600">{u.issuesCrawlOn(date.format(new Date(crawl.createdAt)))}</p>
          </div>
        )}
      </header>

      {data && rules.length > 0 && (
        <div
          className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 sm:flex-row sm:items-center"
          data-testid="impact-banner"
        >
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Sparkles className="h-5 w-5" focusable="false" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">{u.impactTitle}</p>
            <p className="text-sm text-gray-700" data-impact>
              {impact.findings === 0
                ? u.impactNone
                : impact.pages === null
                  ? u.impactBodyNoPages(int.format(impact.findings))
                  : u.impactBody(int.format(impact.findings), int.format(impact.pages))}
            </p>
          </div>
          <Link
            href={CRAWLER_ROUTES.start}
            className="shrink-0 text-sm font-medium text-emerald-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {u.navStart} <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={u.kindFilterLabel} className="flex flex-wrap gap-1.5" data-testid="kind-pills">
            {(["all", "issue", "warning", "opportunity"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  kind === k ? "bg-gray-900 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {k !== "all" && <span aria-hidden="true" className={`h-2 w-2 rounded-full ${KIND_DOT[k]}`} />}
                {k === "all" ? u.pillAll : k === "issue" ? u.pillIssues : k === "warning" ? u.pillWarnings : u.pillOpportunities}
                <span className={`tabular-nums ${kind === k ? "text-gray-100" : "text-gray-600"}`}>{int.format(counts[k])}</span>
              </button>
            ))}
          </div>
          {families.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="issues-family" className="text-xs font-medium text-gray-700">
                {u.familyLabel}
              </label>
              <select id="issues-family" className={SELECT} value={family} onChange={(e) => setFamily(e.target.value)}>
                <option value="">{u.familyAll}</option>
                {families.map((f) => (
                  <option key={f} value={f}>
                    {familyName(f)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {segmentNames.length > 0 && onSegment && (
            <div className="flex items-center gap-2">
              <label htmlFor="issues-segment" className="text-xs font-medium text-gray-700">
                {u.segmentLabel}
              </label>
              <select id="issues-segment" className={SELECT} value={segment} onChange={(e) => onSegment(e.target.value)}>
                <option value="">{u.segmentAll}</option>
                {segmentNames.map((n, i) => (
                  <option key={i} value={String(i)}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="issues-sort" className="text-xs font-medium text-gray-700">
            {u.sortLabel}
          </label>
          <select id="issues-sort" className={SELECT} value={sort} onChange={(e) => setSort(e.target.value as IssuesSort)}>
            <option value="impact">{u.sortImpact}</option>
            <option value="pages">{u.sortPages}</option>
            <option value="family">{u.sortFamily}</option>
            <option value="rule">{u.sortRule}</option>
          </select>
        </div>
      </div>

      {t.rulesEnglishOnly && <p className="text-xs text-gray-600">{t.rulesEnglishOnly}</p>}

      {empty !== null ? (
        <p className="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-600" data-testid="issues-empty">
          {empty}
        </p>
      ) : (
        data && (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white" data-testid="issue-rows">
            {rows.map((r) => {
              const isOpen = open.has(r.ruleId);
              const n = affected(r);
              const count = r.pages === null || r.pages === undefined ? u.ruleFindings(n, int.format(n)) : u.rulePages(n, int.format(n));
              return (
                <li key={r.ruleId} id={`rule-${r.ruleId}`} data-rule={r.ruleId}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`rule-body-${r.ruleId}`}
                      onClick={() => toggle(r.ruleId)}
                      className="flex w-full flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    >
                      <span aria-hidden="true" className={`order-none mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${KIND_DOT[r.kind]}`} data-dot={r.kind} />
                      <span className="order-1 min-w-0 flex-1">
                        <span className="block font-semibold text-gray-900">{nameOf(r.ruleId)}</span>
                        {RULE_COPY[r.ruleId]?.description && <span className="block truncate text-sm text-gray-600">{RULE_COPY[r.ruleId]!.description}</span>}
                      </span>
                      {/* Under the name on phones; a right-hand column from sm up. */}
                      <span className="order-3 w-full pl-5 sm:order-2 sm:w-auto sm:shrink-0 sm:pl-0 sm:text-right">
                        <span className="block text-sm font-semibold tabular-nums text-gray-900" data-count>
                          {count}
                        </span>
                        <span className="block text-xs text-gray-600">
                          {kindName(r.kind, t)}
                          {r.family ? ` · ${familyName(r.family)}` : ""}
                        </span>
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        focusable="false"
                        className={`order-2 mt-1 h-4 w-4 shrink-0 text-gray-600 transition-transform sm:order-3 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </h3>
                  <div id={`rule-body-${r.ruleId}`} hidden={!isOpen}>
                    {isOpen && <RuleDetails crawlId={crawlId} rule={r} seg={seg} t={t} int={int} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      {data && rules.length > 0 && (
        <a href={`/api/seo/v1/crawl/${crawlId}/rules?format=csv&${seg}`} className={CSV_LINK}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
          {t.exportCsv}
        </a>
      )}
    </section>
  );
}
