"use client";

// The Issues tab (Phase 3a): one row per rule that fired — Issue · Kind ·
// Priority · URLs · % of crawled — filterable by kind. Selecting a row opens
// the side panel: what the rule checks, how to fix it, and the URLs it fired
// on with each finding's evidence.
//
// Rule names and descriptions come from the registry's client-safe half
// (packages/crawl-rules/src/meta.ts). They are English-only in 3a; the
// tab says so on fr / de-CH. Everything else is SITE_CRAWLER_COPY.

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RULE_COPY } from "@/lib/crawl-rules-meta";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import type { RuleKindDto } from "@/lib/site-crawler/types";
import { Pager } from "./site-crawler-panels";

interface RuleRow {
  ruleId: string;
  family: string | null;
  kind: RuleKindDto;
  priority: "high" | "medium" | "low";
  urls: number;
  share: number;
}

interface RulesResponse {
  pagesCrawled: number;
  rules: RuleRow[];
}

interface RulePagesResponse {
  rows: { id: string; url: string; statusCode: number | null; foundOn?: string | null; evidence: Record<string, unknown> }[];
  page: number;
  totalPages: number;
  total: number;
}

const CSV_LINK =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-300";

const KIND_VARIANT = { issue: "danger", warning: "warning", opportunity: "info" } as const;

function kindLabel(k: RuleKindDto, t: SiteCrawlerCopy) {
  return k === "issue" ? t.ovKindIssue : k === "warning" ? t.ovKindWarning : t.ovKindOpportunity;
}

function priorityLabel(p: RuleRow["priority"], t: SiteCrawlerCopy) {
  return p === "high" ? t.priorityHigh : p === "medium" ? t.priorityMedium : t.priorityLow;
}

function evidenceText(e: Record<string, unknown>): string {
  return Object.entries(e)
    .filter(([, v]) => v !== null && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}

export function RulesPanel({ crawlId, t, int }: { crawlId: string; t: SiteCrawlerCopy; int: Intl.NumberFormat }) {
  const [data, setData] = useState<RulesResponse | null>(null);
  const [kind, setKind] = useState<RuleKindDto | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [pages, setPages] = useState<RulePagesResponse | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/${crawlId}/rules`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RulesResponse | null) => {
        if (!cancelled) setData(d ?? { pagesCrawled: 0, rules: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [crawlId]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/${crawlId}/rules/${encodeURIComponent(selected)}?page=${page}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RulePagesResponse | null) => {
        if (!cancelled) setPages(d);
      });
    return () => {
      cancelled = true;
    };
  }, [crawlId, selected, page]);

  if (!data) return null;
  if (data.rules.length === 0) return <p className="py-8 text-center text-sm text-gray-500">{t.rulesNone}</p>;

  const rows = kind === "all" ? data.rules : data.rules.filter((r) => r.kind === kind);
  const copy = selected ? RULE_COPY[selected] : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "issue", "warning", "opportunity"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={
              kind === k
                ? "rounded-lg bg-gray-900 px-3 py-1 text-xs font-medium text-white"
                : "rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            }
          >
            {k === "all" ? t.rulesAll : kindLabel(k, t)}
          </button>
        ))}
        {t.rulesEnglishOnly && <span className="text-xs text-gray-400">{t.rulesEnglishOnly}</span>}
        {/* The whole table, every kind: the file is the full list, not this filter of it. */}
        <a href={`/api/seo/v1/crawl/${crawlId}/rules?format=csv`} className={`${CSV_LINK} ml-auto`}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {t.exportCsv}
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">{t.rulesColIssue}</th>
                  <th className="px-3 py-2">{t.rulesColKind}</th>
                  <th className="px-3 py-2">{t.rulesColPriority}</th>
                  <th className="px-3 py-2 text-right">{t.rulesColUrls}</th>
                  <th className="px-3 py-2 text-right">{t.rulesColShare}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.ruleId}
                    onClick={() => {
                      setSelected(r.ruleId);
                      setPage(1);
                      setPages(null);
                    }}
                    aria-selected={selected === r.ruleId}
                    className={`cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 ${selected === r.ruleId ? "bg-gray-50" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <button type="button" className="text-left font-medium text-gray-900 hover:underline">
                        {RULE_COPY[r.ruleId]?.name ?? r.ruleId}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={KIND_VARIANT[r.kind]}>{kindLabel(r.kind, t)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{priorityLabel(r.priority, t)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{int.format(r.urls)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.share}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            {!selected || !copy ? (
              <p className="text-sm text-gray-500">{t.rulesPick}</p>
            ) : (
              <>
                <h3 className="text-base font-semibold text-gray-900">{copy.name}</h3>
                <p className="text-sm text-gray-600">{copy.description}</p>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.rulesHowToFix}</h4>
                  <p className="mt-1 text-sm text-gray-700">{copy.howToFix}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {t.rulesAffected}
                      {pages ? ` (${int.format(pages.total)})` : ""}
                    </h4>
                    <a
                      href={`/api/seo/v1/crawl/${crawlId}/rules/${encodeURIComponent(selected)}?format=csv`}
                      className={CSV_LINK}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      {t.exportCsv}
                    </a>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {pages?.rows.map((p) => (
                      <li key={p.id} className="text-sm">
                        <span className="block truncate font-mono text-xs text-gray-900" title={p.url}>
                          {p.url}
                        </span>
                        <span className="text-xs text-gray-500">
                          {p.statusCode ?? "—"}
                          {Object.keys(p.evidence).length ? ` · ${evidenceText(p.evidence)}` : ""}
                        </span>
                        {p.foundOn && (
                          <span className="block truncate text-xs text-gray-500" title={p.foundOn}>
                            {t.p4a.colFoundOn}: {p.foundOn}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {pages && pages.totalPages > 1 && (
                    <Pager page={pages.page} totalPages={pages.totalPages} onPage={setPage} t={t} int={int} />
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
