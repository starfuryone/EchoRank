"use client";

// AI Citation Finder — the sortable source table and its preset filter.
//
// SORTING IS A LINK, NOT A useState. Every header pushes a query string and the
// server re-reads; nothing on this page sorts an array in the browser. The
// table is paginated and unbounded, so a client-side sort would only reorder
// the fifty rows that happened to arrive — a header that says "most cited" and
// means "most cited on this page" is worse than no header at all. It also
// makes every view a shareable URL, which is what a customer does with a
// finding like this: they send it to whoever owns the content.
//
// THE PRESET IS THE PRODUCT. "Trusted sources that never mention you" is the
// one query this tool exists to answer, so it is a chip with a live count
// rather than something a customer assembles from two column filters. It is
// rendered even at zero, because "none" is a genuinely good answer here and
// hiding the chip would make it unreachable.
//
// Light mode only, deliberately: this dashboard has no dark theme — there is no
// `darkMode` in the Tailwind config and not one `dark:` class in any sibling
// tool client — so a second set of steps would be unreachable code.

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, Lock, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  SEO_TOOLS_COPY,
  CITATION_FINDER_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";
import type {
  CitationPageData,
  CitationSortKey,
  CitationSourceRow,
} from "@/lib/citations/read";
import { CITATION_KINDS } from "@/lib/citations/classify";

const ROUTE = "/visibility/tools/citation-finder";

/** BCP-47 for the three dashboard locales, for number and date formatting. */
const INTL_LOCALE: Record<DashLocale, string> = {
  en: "en",
  fr: "fr",
  "de-CH": "de-CH",
};

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) =>
    values[key] === undefined ? "" : String(values[key]),
  );
}

/** The columns, in render order, and whether they sort. */
const COLUMNS: ReadonlyArray<{ key: CitationSortKey; align?: "right" }> = [
  { key: "domain" },
  { key: "kind" },
  { key: "engines" },
  { key: "seen", align: "right" },
  { key: "citesYou" },
  { key: "rivals" },
  { key: "lastSeen", align: "right" },
];

export function CitationFinderClient({
  locale,
  data,
  locked,
  answerTrackingEnabled,
}: {
  locale: DashLocale;
  data: CitationPageData;
  locked: boolean;
  /**
   * aiSearchEnabledFor(tenantId), resolved on the SERVER and passed in.
   *
   * The client cannot compute it — the rollout is an env read plus a tenant
   * allowlist — and it must not guess, because the answer decides whether the
   * empty state offers a link that would 404. Same arrangement ai-tools.ts
   * describes: the page resolves the switches, the component renders them.
   */
  answerTrackingEnabled: boolean;
}) {
  const copy = CITATION_FINDER_COPY[locale];
  const item = SEO_TOOLS_COPY[locale].items.citation_finder;
  const router = useRouter();
  const search = useSearchParams();

  const setParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(search?.toString() ?? "");
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      router.push(`${ROUTE}?${next.toString()}`);
    },
    [router, search],
  );

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{item.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{item.description}</p>
      </div>
    </div>
  );

  // ── Locked (below Growth) ────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Lock className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{copy.lockedTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{copy.lockedBody}</p>
              <Link
                href="/billing"
                className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {copy.lockedCta}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Empty (unlocked, no rollup yet) ──────────────────────────────────────
  if (!data.hasData) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Quote className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{copy.emptyTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{copy.emptyBody}</p>
              {/* ── THE CTA IS CONDITIONAL, AND THE REASON IS NOT COSMETIC ──
                  /visibility/ai-search/setup notFound()s when the answer-
                  tracking rollout is off for this tenant, so linking to it
                  unconditionally sent every non-rolled-out tenant to a 404 —
                  the same failure the hub's rollout-HIDES rule exists to stop.

                  There is no fallback destination, because there is nothing a
                  fallback could achieve. Citation rows are written only by
                  persistRunAnalysis on the checkup path, and the checkup sweep
                  filters brands through aiSearchEnabledFor() before enqueuing
                  anything. A tenant without the rollout cannot produce a single
                  citation however many prompts they add, so pointing them at
                  Custom Prompts would swap a 404 for a promise we cannot keep.
                  It says what is actually true instead. */}
              {answerTrackingEnabled ? (
                <Link
                  href="/visibility/ai-search/setup"
                  className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {copy.emptySetupCta}
                </Link>
              ) : (
                <p className="mt-6 max-w-md text-sm text-gray-400">{copy.emptyRolloutNote}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const numberFormat = new Intl.NumberFormat(INTL_LOCALE[locale]);
  const dateFormat = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));

  const sortLink = (key: CitationSortKey) => {
    // First click on a new column sorts DESCENDING for the count columns and
    // ASCENDING for the text ones — "most cited first" and "A first" are what
    // each is actually asked for. Clicking the active column flips it.
    const isActive = data.sort === key;
    const naturalDir = key === "domain" || key === "kind" ? "asc" : "desc";
    const nextDir = isActive ? (data.dir === "asc" ? "desc" : "asc") : naturalDir;
    // Sorting returns to page 1: staying on page 7 of a re-sorted table shows
    // rows the reader never asked to skip past.
    return { sort: key, dir: nextDir, page: null };
  };

  return (
    <div className="space-y-6">
      {header}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-end gap-4">
        {data.brands.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">{copy.brandLabel}</span>
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={data.selectedBrandProfileId ?? ""}
              onChange={(event) => setParams({ brand: event.target.value, page: null })}
            >
              {data.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">{copy.kindLabel}</span>
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={data.kind ?? ""}
            onChange={(event) => setParams({ kind: event.target.value || null, page: null })}
          >
            <option value="">{copy.allKinds}</option>
            {CITATION_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {copy.kinds[kind]}
              </option>
            ))}
          </select>
        </label>

        {/* The preset. A toggle, not a third dropdown value — it is the one
            question this tool was built to answer. */}
        <button
          type="button"
          aria-pressed={data.preset === "opportunity"}
          onClick={() =>
            setParams({
              preset: data.preset === "opportunity" ? null : "opportunity",
              page: null,
            })
          }
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            data.preset === "opportunity"
              ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          {interpolate(copy.presetOpportunity, { count: numberFormat.format(data.opportunityCount) })}
        </button>
      </div>

      {data.preset === "opportunity" && (
        <p className="text-sm text-gray-500">{copy.presetExplainer}</p>
      )}

      {/* ── The table ── */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                {interpolate(copy.tableCaption, { brand: data.brandName ?? "" })}
              </caption>
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  {COLUMNS.map((column) => {
                    const isActive = data.sort === column.key;
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        // The live sort state belongs on the header, not only in
                        // the arrow glyph — a screen reader has no arrow.
                        aria-sort={
                          isActive
                            ? data.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className={`px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 ${
                          column.align === "right" ? "text-right" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setParams(sortLink(column.key))}
                          className={`inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            isActive ? "text-gray-900" : ""
                          }`}
                        >
                          {copy.columns[column.key]}
                          {isActive &&
                            (data.dir === "asc" ? (
                              <ArrowUp className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <ArrowDown className="h-3 w-3" aria-hidden="true" />
                            ))}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-gray-500">
                      {copy.noMatches}
                    </td>
                  </tr>
                )}
                {data.rows.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    copy={copy}
                    numberFormat={numberFormat}
                    dateFormat={dateFormat}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Pagination ── */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {interpolate(copy.pageOf, { page: data.page, pages: lastPage, total: numberFormat.format(data.total) })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => setParams({ page: String(data.page - 1) })}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copy.previous}
            </button>
            <button
              type="button"
              disabled={data.page >= lastPage}
              onClick={() => setParams({ page: String(data.page + 1) })}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copy.next}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">{copy.methodNote}</p>
    </div>
  );
}

function Row({
  row,
  copy,
  numberFormat,
  dateFormat,
}: {
  row: CitationSourceRow;
  copy: (typeof CITATION_FINDER_COPY)[DashLocale];
  numberFormat: Intl.NumberFormat;
  dateFormat: Intl.DateTimeFormat;
}) {
  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
      <td className="px-4 py-3">
        {/* The domain is a link out, because the next thing a customer does
            with a source they have never been cited by is go and look at it.
            noreferrer as well as noopener: this is a third-party site the
            engines chose, not one we vouch for. */}
        <a
          href={`https://${row.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          {row.domain}
        </a>
      </td>
      <td className="px-4 py-3 text-gray-600">{copy.kinds[row.kind]}</td>
      <td className="px-4 py-3 text-gray-600">
        {row.engines.length === 0 ? "—" : row.engines.join(", ")}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-900">
        {numberFormat.format(row.seenCount)}
      </td>
      <td className="px-4 py-3">
        {/* Never colour alone: the state is spelled out in words, so the badge
            is redundant reinforcement rather than the only carrier. */}
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            row.citesYou ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
          }`}
        >
          {row.citesYou
            ? interpolate(copy.citesYouYes, { count: numberFormat.format(row.brandCitations) })
            : copy.citesYouNo}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-600">
        {row.topRivals.length === 0
          ? "—"
          : row.topRivals
              .map((rival) => `${rival.brand} (${numberFormat.format(rival.count)})`)
              .join(", ")}
      </td>
      <td className="px-4 py-3 text-right text-gray-500">
        {dateFormat.format(new Date(row.lastSeen))}
      </td>
    </tr>
  );
}
