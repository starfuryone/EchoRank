"use client";

// The four non-Issues tabs of a completed crawl.
//
// Split out of site-crawler-client.tsx to keep that file about the crawl
// lifecycle (start, poll, cancel) rather than about rendering four tables.
//
// DISTRIBUTION BARS ARE PLAIN DIVS. recharts is already in the dashboard
// bundle (Content Explorer, Web Analytics, Historical use it), so a chart
// library was available — but a proportional bar is a div with a width, and
// pulling a charting runtime onto this page to draw one would cost more than
// it explains. The moment these need axes or tooltips, recharts is there.
//
// Every string comes from SITE_CRAWLER_COPY; there is no inline English here.

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import type {
  CrawlPagesPage,
  CrawlSummaryDto,
  DuplicateKind,
  DuplicatePage,
  PageFilters,
  RedirectPage,
} from "@/lib/site-crawler/types";

interface Common {
  t: SiteCrawlerCopy;
  int: Intl.NumberFormat;
}

/** A labelled proportional bar. Width is share-of-max, not share-of-total. */
function Bar({
  label,
  value,
  max,
  int,
  tone = "bg-gray-900",
}: {
  label: string;
  value: number;
  max: number;
  int: Intl.NumberFormat;
  tone?: string;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-gray-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-gray-600">
        {int.format(value)}
      </span>
    </div>
  );
}

function Distribution({
  title,
  data,
  int,
  tone,
  sort = "key",
}: {
  title: string;
  data: Record<string, number>;
  int: Intl.NumberFormat;
  tone?: string;
  sort?: "key" | "value";
}) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  entries.sort((a, b) => (sort === "value" ? b[1] - a[1] : a[0].localeCompare(b[0], undefined, { numeric: true })));
  const max = Math.max(...entries.map(([, v]) => v));

  return (
    <Card>
      <CardHeader>
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map(([key, value]) => (
          <Bar key={key} label={key} value={value} max={max} int={int} tone={tone} />
        ))}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export function OverviewPanel({
  summary,
  t,
  int,
}: Common & { summary: CrawlSummaryDto | null }) {
  if (!summary) {
    return <p className="py-8 text-center text-sm text-gray-500">{t.ovNoSummary}</p>;
  }

  // Aggregation failed but the crawl did not: say so plainly rather than
  // rendering a page of zeroes that look like findings.
  if (summary.aggregationError) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="mx-auto max-w-lg text-sm text-gray-600">{t.ovAggregationFailed}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t.summaryErrors} value={int.format(summary.issuesBySeverity.ERROR ?? 0)} />
        <Stat label={t.summaryWarnings} value={int.format(summary.issuesBySeverity.WARNING ?? 0)} />
        <Stat label={t.summaryNotices} value={int.format(summary.issuesBySeverity.NOTICE ?? 0)} />
        <Stat
          label={t.ovInlinkAverage}
          value={int.format(summary.inlinks.average)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Distribution title={t.ovStatusCodes} data={summary.statusCodes} int={int} />
        <Distribution title={t.ovDepth} data={summary.depths} int={int} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h4 className="text-sm font-semibold text-gray-900">{t.ovSitemap}</h4>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-gray-600">
            {summary.sitemap.found ? (
              <>
                <p>{t.ovSitemapFound(int.format(summary.sitemap.urlCount))}</p>
                {summary.sitemap.notCrawled > 0 && (
                  <p className="text-gray-500">
                    {t.ovSitemapNotCrawled(int.format(summary.sitemap.notCrawled))}
                  </p>
                )}
                {summary.sitemap.truncated && (
                  <p className="text-gray-500">{t.ovSitemapTruncated}</p>
                )}
              </>
            ) : (
              <p className="text-gray-500">{t.ovSitemapNone}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h4 className="text-sm font-semibold text-gray-900">{t.ovInlinks}</h4>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">{t.ovInlinkAverage}</p>
              <p className="font-semibold text-gray-900">{int.format(summary.inlinks.average)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t.ovInlinkZero}</p>
              <p className="font-semibold text-gray-900">{int.format(summary.inlinks.zeroCount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t.ovInlinkMax}</p>
              <p className="font-semibold text-gray-900">{int.format(summary.inlinks.max)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {summary.deepestPages.length > 0 && (
        <Card>
          <CardHeader>
            <h4 className="text-sm font-semibold text-gray-900">{t.ovDeepest}</h4>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {summary.deepestPages.map((p) => (
                <li key={p.url} className="flex items-center justify-between gap-3">
                  <span className="truncate text-gray-600" title={p.url}>
                    {p.url}
                  </span>
                  <Badge variant="default">{int.format(p.depth)}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-gray-400">{t.ovAggregationMs(int.format(summary.aggregationMs))}</p>
    </div>
  );
}

export function DuplicatesPanel({
  data,
  kind,
  onKind,
  onPage,
  t,
  int,
}: Common & {
  data: DuplicatePage | null;
  kind: DuplicateKind;
  onKind: (k: DuplicateKind) => void;
  onPage: (p: number) => void;
}) {
  const kinds: { value: DuplicateKind; label: string }[] = [
    { value: "title", label: t.dupTitle },
    { value: "meta", label: t.dupMeta },
    { value: "content", label: t.dupContent },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <Button
            key={k.value}
            variant={k.value === kind ? "primary" : "outline"}
            size="sm"
            onClick={() => onKind(k.value)}
          >
            {k.label}
          </Button>
        ))}
      </div>

      {!data || data.groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{t.dupNone}</p>
      ) : (
        <>
          <div className="space-y-3">
            {data.groups.map((group, i) => (
              // <details> rather than a state-driven accordion: it is the
              // native disclosure widget, keyboard-accessible for free.
              <details key={`${group.value ?? "hash"}-${i}`} className="rounded-lg border border-gray-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm">
                  <span className="font-medium text-gray-900">
                    {group.value ?? group.urls[0] ?? ""}
                  </span>
                  <span className="ml-2 text-gray-500">
                    {t.dupGroupMembers(int.format(group.members))}
                  </span>
                </summary>
                <ul className="border-t border-gray-100 px-4 py-2 text-sm">
                  {group.urls.map((url) => (
                    <li key={url} className="truncate py-1 text-gray-600" title={url}>
                      {url}
                    </li>
                  ))}
                  {group.truncated && (
                    <li className="py-1 text-xs text-gray-400">{t.dupTruncated}</li>
                  )}
                </ul>
              </details>
            ))}
          </div>

          <Pager page={data.page} totalPages={data.totalPages} onPage={onPage} t={t} int={int} />
        </>
      )}
    </div>
  );
}

export function RedirectsPanel({
  data,
  onPage,
  t,
  int,
}: Common & { data: RedirectPage | null; onPage: (p: number) => void }) {
  if (!data || data.redirects.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">{t.redNone}</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {data.redirects.map((row) => (
          <li key={row.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={row.type === "REDIRECT_LOOP" ? "danger" : "warning"}>
                {row.type === "REDIRECT_LOOP" ? t.redLoops : t.redChains}
              </Badge>
              {row.hops.length > 1 && (
                <span className="text-xs text-gray-500">
                  {t.redHops(int.format(row.hops.length - 1))}
                </span>
              )}
            </div>
            <ol className="mt-2 space-y-1 text-sm">
              {(row.hops.length > 0 ? row.hops : [row.url]).map((hop, i) => (
                <li key={`${row.id}-${i}`} className="flex items-start gap-2">
                  <span className="mt-0.5 w-4 shrink-0 text-xs text-gray-400">{i + 1}</span>
                  <span className="truncate text-gray-600" title={hop}>
                    {hop}
                  </span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>

      <Pager page={data.page} totalPages={data.totalPages} onPage={onPage} t={t} int={int} />
    </div>
  );
}

export function PagesPanel({
  data,
  filters,
  onFilters,
  onPage,
  t,
  int,
}: Common & {
  data: CrawlPagesPage | null;
  filters: PageFilters;
  onFilters: (f: PageFilters) => void;
  onPage: (p: number) => void;
}) {
  const set = (key: keyof PageFilters, value: string) => onFilters({ ...filters, [key]: value });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Select
            aria-label={t.filterSitemap}
            value={filters.inSitemap}
            onChange={(e) => set("inSitemap", e.target.value)}
            options={[
              { value: "", label: `${t.filterSitemap}: ${t.filterAll}` },
              { value: "true", label: t.filterYes },
              { value: "false", label: t.filterNo },
            ]}
          />
        </div>
        <div className="w-28">
          <Input
            aria-label={t.filterDepth}
            placeholder={t.filterDepth}
            inputMode="numeric"
            value={filters.depth}
            onChange={(e) => set("depth", e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="w-36">
          <Input
            aria-label={t.filterInlinks}
            placeholder={t.filterInlinks}
            inputMode="numeric"
            value={filters.minInlinks}
            onChange={(e) => set("minInlinks", e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onFilters({ inSitemap: "", depth: "", minInlinks: "" })}
        >
          {t.filterClear}
        </Button>
      </div>

      {!data || data.pages.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{t.noPages}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th scope="col" className="py-2 pr-3">{t.colUrl}</th>
                  <th scope="col" className="py-2 pr-3">{t.colDepth}</th>
                  <th scope="col" className="py-2 pr-3">{t.colInlinks}</th>
                  <th scope="col" className="py-2 pr-3">{t.colSitemap}</th>
                  <th scope="col" className="py-2">{t.issuesTitle}</th>
                </tr>
              </thead>
              <tbody>
                {data.pages.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="max-w-md py-2 pr-3">
                      <span className="block truncate text-gray-600" title={row.url}>
                        {row.url}
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-gray-600">{int.format(row.depth)}</td>
                    <td className="py-2 pr-3 tabular-nums text-gray-600">
                      {row.inlinkCount === null ? "—" : int.format(row.inlinkCount)}
                    </td>
                    <td className="py-2 pr-3 text-gray-600">
                      {row.inSitemap === null ? "—" : row.inSitemap ? t.filterYes : t.filterNo}
                    </td>
                    <td className="py-2 tabular-nums text-gray-600">
                      {int.format(row.issueCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pager page={data.page} totalPages={data.totalPages} onPage={onPage} t={t} int={int} />
        </>
      )}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  onPage,
  t,
  int,
}: Common & { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t.prevPage}
      </Button>
      <span className="text-xs text-gray-500">
        {t.pageOf(int.format(page), int.format(totalPages))}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        {t.nextPage}
      </Button>
    </div>
  );
}
