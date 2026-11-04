"use client";

// The Compare tab (Phase 4c): pick another completed crawl of the same tenant
// and mode (default: the previous crawl of this host), optionally map its URLs
// (staging → production), and read what changed. The work is SQL on the
// server (src/lib/site-crawler/compare.ts); this tab shows the stored counts
// and first 500 URLs per bucket, pages further by keyset, and links each
// bucket's CSV. The crawl's segment picker applies.

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RULE_COPY } from "@/lib/crawl-rules-meta";
import { formatDateTime } from "@/lib/utils";
import type { DashLocale, SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import type { SiteCrawler4cCopy } from "@/lib/i18n/site-crawler-4c";
import { MAPPING_MAX_PAIRS, type MappingPair } from "@/lib/site-crawler/compare-mapping";

// Types restated from compare.ts, which is server-only.
type Bucket = "added" | "removed" | "changed" | "issuesNew" | "issuesResolved";
type Field = "status" | "title" | "canonical" | "indexability";
interface ChangedRow {
  url: string;
  fields: Field[];
}
interface IssueRow {
  url: string;
  ruleId: string;
}
type Row = string | ChangedRow | IssueRow;
interface Side {
  pages: number;
  indexable: number;
  redirects: number;
  errors: number;
  issues: { ERROR: number; WARNING: number; NOTICE: number };
}
export interface ComparisonDto {
  id: string;
  jobBId: string;
  segmentId: number | null;
  mapping: MappingPair[];
  createdAt: string;
  result: {
    counts: Record<Bucket, number>;
    summary: { a: Side; b: Side };
    rules: { ruleId: string; new: number; resolved: number }[];
    samples: Record<Bucket, Row[]>;
    truncated: boolean;
  };
}
interface Candidate {
  id: string;
  rootUrl: string;
  createdAt: string;
  pagesCrawled: number;
}

const BUCKETS: Bucket[] = ["added", "removed", "changed", "issuesNew", "issuesResolved"];
const SHOWN = 20;
const CSV_LINK =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-300";

export function bucketLabel(b: Bucket, c: SiteCrawler4cCopy): string {
  return { added: c.bucketAdded, removed: c.bucketRemoved, changed: c.bucketChanged, issuesNew: c.bucketIssuesNew, issuesResolved: c.bucketIssuesResolved }[b];
}

function fieldLabel(f: Field, c: SiteCrawler4cCopy): string {
  return { status: c.fieldStatus, title: c.fieldTitle, canonical: c.fieldCanonical, indexability: c.fieldIndexability }[f];
}

/** Summary rows: [label, baseline, this crawl]. */
export function summaryRows(s: { a: Side; b: Side }, c: SiteCrawler4cCopy): [string, number, number][] {
  return [
    [c.mPages, s.b.pages, s.a.pages],
    [c.mIndexable, s.b.indexable, s.a.indexable],
    [c.mRedirects, s.b.redirects, s.a.redirects],
    [c.mErrors, s.b.errors, s.a.errors],
    [c.mIssuesError, s.b.issues.ERROR, s.a.issues.ERROR],
    [c.mIssuesWarning, s.b.issues.WARNING, s.a.issues.WARNING],
    [c.mIssuesNotice, s.b.issues.NOTICE, s.a.issues.NOTICE],
  ];
}

/** The API error's message, from the route's code/reason. */
export function compareError(body: { code?: string; reason?: string; problems?: { index: number }[] } | null, c: SiteCrawler4cCopy): string {
  if (body?.code === "INVALID_MAPPING" && body.problems?.length) return c.errMapping(body.problems[0]!.index + 1);
  if (body?.reason === "segment_missing") return c.errSegmentMissing;
  if (body?.reason === "timeout") return c.errTimeout;
  if (body?.reason === "invalid_mapping") return c.errMappingAny;
  if (body?.reason === "not_comparable") return c.errNotComparable;
  return c.errGeneric;
}

const signed = (n: number, int: Intl.NumberFormat) => (n > 0 ? `+${int.format(n)}` : int.format(n));

function RowText({ row, c }: { row: Row; c: SiteCrawler4cCopy }) {
  if (typeof row === "string") return <span className="break-all">{row}</span>;
  if ("ruleId" in row) {
    return (
      <span>
        <span className="break-all">{row.url}</span> <span className="text-gray-500">— {RULE_COPY[row.ruleId]?.name ?? row.ruleId}</span>
      </span>
    );
  }
  return (
    <span>
      <span className="break-all">{row.url}</span> <span className="text-gray-500">— {c.changedList(row.fields.map((f) => fieldLabel(f, c)).join(", "))}</span>
    </span>
  );
}

function BucketList({ crawlId, cmp, bucket, c, int }: { crawlId: string; cmp: ComparisonDto; bucket: Bucket; c: SiteCrawler4cCopy; int: Intl.NumberFormat }) {
  const sample = cmp.result.samples[bucket] ?? [];
  const total = cmp.result.counts[bucket];
  const [extra, setExtra] = useState<{ rows: Row[]; next: string | null } | null>(null);
  const [shown, setShown] = useState(SHOWN);
  const base = `/api/seo/v1/crawl/${crawlId}/compare/${cmp.id}?bucket=${bucket}`;
  const rows = extra ? [...sample, ...extra.rows] : sample;
  const canFetch = extra ? extra.next !== null : sample.length < total;

  async function more() {
    if (shown < rows.length) return setShown(shown + SHOWN * 5);
    const last = rows[rows.length - 1];
    if (last === undefined) return;
    const after = typeof last === "string" ? last : "ruleId" in last ? JSON.stringify([last.url, last.ruleId]) : last.url;
    const res = await fetch(`${base}&after=${encodeURIComponent(after)}`);
    if (!res.ok) return;
    const page = (await res.json()) as { rows: Row[]; next: string | null };
    setExtra({ rows: [...(extra?.rows ?? []), ...page.rows], next: page.next });
    setShown(shown + SHOWN * 5);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">
          {bucketLabel(bucket, c)} <span className="font-normal text-gray-500">({int.format(total)})</span>
        </h4>
        {total > 0 && (
          <a className={CSV_LINK} href={`${base}&format=csv`}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> CSV
          </a>
        )}
      </div>
      {total === 0 ? (
        <p className="text-xs text-gray-500">{c.cmpNone}</p>
      ) : (
        <ul className="space-y-1 text-xs text-gray-800">
          {rows.slice(0, shown).map((r, i) => (
            <li key={i}>
              <RowText row={r} c={c} />
            </li>
          ))}
        </ul>
      )}
      {(shown < rows.length || canFetch) && (
        <Button variant="outline" size="sm" onClick={() => void more()}>
          {c.showMore}
        </Button>
      )}
    </div>
  );
}

export function ComparePanel({
  crawlId,
  segment = null,
  segmentName = null,
  locale,
  t,
  int,
}: {
  crawlId: string;
  /** The crawl's segment picker (index), or null. */
  segment?: string | null;
  segmentName?: string | null;
  locale: DashLocale;
  t: SiteCrawlerCopy;
  int: Intl.NumberFormat;
}) {
  const c = t.p4c;
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [baseline, setBaseline] = useState("");
  const [mapping, setMapping] = useState<MappingPair[]>([]);
  const [cmp, setCmp] = useState<ComparisonDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const segIndex = segment === null || segment === "" ? null : Number(segment);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/${crawlId}/compare`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { candidates: Candidate[]; defaultBaselineId: string | null; comparisons: ComparisonDto[] } | null) => {
        if (cancelled) return;
        setCandidates(d?.candidates ?? []);
        const pick = d?.defaultBaselineId ?? d?.candidates[0]?.id ?? "";
        setBaseline(pick);
        const last = d?.comparisons.find((x) => x.jobBId === pick && x.segmentId === segIndex && x.mapping.length === 0);
        if (last) setCmp(last);
      });
    return () => {
      cancelled = true;
    };
  }, [crawlId, segIndex]);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/seo/v1/crawl/${crawlId}/compare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baselineId: baseline, mapping: mapping.filter((m) => m.find.trim()), segment: segIndex }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(compareError(body, c));
      setCmp(body as ComparisonDto);
    } catch {
      setError(c.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  const other = cmp ? candidates?.find((x) => x.id === cmp.jobBId) : undefined;
  const setPair = (i: number, key: keyof MappingPair, value: string) => setMapping(mapping.map((m, j) => (j === i ? { ...m, [key]: value } : m)));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          {candidates !== null && candidates.length === 0 ? (
            <p className="text-sm text-gray-500">{c.cmpNoCandidates}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[280px] flex-1">
                  <Select
                    id="compare-baseline"
                    label={c.cmpBaseline}
                    value={baseline}
                    onChange={(e) => {
                      setBaseline(e.target.value);
                      setCmp(null);
                    }}
                    options={(candidates ?? []).map((x) => ({ value: x.id, label: `${formatDateTime(x.createdAt, locale)} — ${x.rootUrl}` }))}
                  />
                </div>
                <Button onClick={() => void run()} disabled={busy || !baseline}>
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> {c.cmpRunning}
                    </>
                  ) : (
                    c.cmpRun
                  )}
                </Button>
              </div>
              {segmentName && <p className="text-xs text-gray-500">{c.cmpSegment(segmentName)}</p>}
              <details>
                <summary className="cursor-pointer text-sm font-medium text-gray-700">{c.cmpMapping}</summary>
                <p className="mt-2 text-xs text-gray-500">{c.cmpMappingHelp}</p>
                <div className="mt-2 space-y-2">
                  {mapping.map((m, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <Input aria-label={c.cmpFind} placeholder={c.cmpFind} className="w-72 font-mono text-xs" value={m.find} maxLength={500} onChange={(e) => setPair(i, "find", e.target.value)} />
                      <Input aria-label={c.cmpReplace} placeholder={c.cmpReplace} className="w-72 font-mono text-xs" value={m.replace} maxLength={500} onChange={(e) => setPair(i, "replace", e.target.value)} />
                      <Button variant="outline" size="sm" onClick={() => setMapping(mapping.filter((_, j) => j !== i))}>
                        {c.cmpRemove}
                      </Button>
                    </div>
                  ))}
                  {mapping.length < MAPPING_MAX_PAIRS && (
                    <Button variant="outline" size="sm" onClick={() => setMapping([...mapping, { find: "", replace: "" }])}>
                      {c.cmpAddPair}
                    </Button>
                  )}
                </div>
              </details>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}
        </CardContent>
      </Card>

      {cmp && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-900">{c.cmpHeading(other ? formatDateTime(other.createdAt, locale) : formatDateTime(cmp.createdAt, locale))}</h3>
          </CardHeader>
          <CardContent className="space-y-6">
            <table className="w-full max-w-xl text-left text-xs">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">{c.metric}</th>
                  <th className="py-1 pr-3 text-right font-medium">{c.colBaseline}</th>
                  <th className="py-1 pr-3 text-right font-medium">{c.colThis}</th>
                  <th className="py-1 text-right font-medium">{c.colDelta}</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows(cmp.result.summary, c).map(([label, b, a]) => (
                  <tr key={label} className="border-t border-gray-100">
                    <td className="py-1 pr-3 text-gray-700">{label}</td>
                    <td className="py-1 pr-3 text-right">{int.format(b)}</td>
                    <td className="py-1 pr-3 text-right">{int.format(a)}</td>
                    <td className="py-1 text-right font-medium">{signed(a - b, int)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {cmp.result.rules.length > 0 && (
              <table className="w-full max-w-xl text-left text-xs">
                <thead className="text-gray-500">
                  <tr>
                    <th className="py-1 pr-3 font-medium">{c.colIssue}</th>
                    <th className="py-1 pr-3 text-right font-medium">{c.colNew}</th>
                    <th className="py-1 text-right font-medium">{c.colResolved}</th>
                  </tr>
                </thead>
                <tbody>
                  {cmp.result.rules.slice(0, 50).map((r) => (
                    <tr key={r.ruleId} className="border-t border-gray-100">
                      <td className="py-1 pr-3 text-gray-700">{RULE_COPY[r.ruleId]?.name ?? r.ruleId}</td>
                      <td className="py-1 pr-3 text-right">{int.format(r.new)}</td>
                      <td className="py-1 text-right">{int.format(r.resolved)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {cmp.result.truncated && <p className="text-xs text-gray-500">{c.cmpTruncated}</p>}
            {BUCKETS.map((b) => (
              <BucketList key={`${cmp.id}-${b}`} crawlId={crawlId} cmp={cmp} bucket={b} c={c} int={int} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
