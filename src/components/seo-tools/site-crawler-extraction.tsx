"use client";

// The Extraction tab (Phase 4b): URL + one column per extractor, a
// has-value / empty filter per extractor, and the CSV of the same rows.
// Self-contained like the Issues tab: it fetches its own rows.

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import { Pager } from "./site-crawler-panels";

interface ExtractionResponse {
  extractors: { name: string; kind: string }[];
  rows: { id: string; url: string; values: (string[] | null)[]; segment: string }[];
  page: number;
  totalPages: number;
  total: number;
}

const CSV_LINK =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-300";

/** "" = all; "3:has" / "3:empty" = extractor 3 has a value / is empty. */
export function extractionQuery(filter: string, segment: string | null, page?: number): string {
  const q = new URLSearchParams();
  const [index, which] = filter.split(":");
  if (index !== undefined && which) {
    q.set("extractor", index);
    q.set("has", which === "has" ? "true" : "false");
  }
  if (segment !== null) q.set("segment", segment);
  if (page !== undefined) q.set("page", String(page));
  return q.toString();
}

export function ExtractionPanel({
  crawlId,
  extractorNames,
  segment = null,
  t,
  int,
}: {
  crawlId: string;
  /** From the crawl's config, so the filter can render before the rows arrive. */
  extractorNames: string[];
  /** Phase 4b segment filter (index), or null for every page. */
  segment?: string | null;
  t: SiteCrawlerCopy;
  int: Intl.NumberFormat;
}) {
  const t4b = t.p4b;
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ExtractionResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/${crawlId}/extractions?${extractionQuery(filter, segment, page)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ExtractionResponse | null) => {
        if (!cancelled) setData(d ?? { extractors: [], rows: [], page: 1, totalPages: 1, total: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [crawlId, filter, segment, page]);

  // The client's names are localised (AI preset labels); the server's are the fallback when the two disagree.
  const names = !data || data.extractors.length === extractorNames.length ? extractorNames : data.extractors.map((e) => e.name);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">{t4b.exTitle}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label={t4b.exTitle}
              className="w-auto"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
                setData(null);
              }}
              options={[
                { value: "", label: t4b.exFilterAll },
                ...names.flatMap((n, i) => [
                  { value: `${i}:has`, label: t4b.exFilterHas(n) },
                  { value: `${i}:empty`, label: t4b.exFilterEmpty(n) },
                ]),
              ]}
            />
            <a className={CSV_LINK} href={`/api/seo/v1/crawl/${crawlId}/extractions?${extractionQuery(filter, segment)}&format=csv`}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t.exportCsv}
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data ? null : data.rows.length === 0 ? (
          <p className="text-sm text-gray-500">{t4b.exNoRows}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">URL</th>
                  {names.map((n, i) => (
                    <th key={i} className="py-2 pr-3 font-medium">
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 align-top">
                    <td className="max-w-xs break-all py-2 pr-3 text-gray-900">{r.url}</td>
                    {names.map((_, i) => (
                      <td key={i} className="max-w-xs break-words py-2 pr-3 text-gray-700">
                        {r.values[i]?.join(" | ") ?? <span className="text-gray-400">{t4b.exNone}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <Pager
            page={data.page}
            totalPages={data.totalPages}
            onPage={(p) => {
              setPage(p);
              setData(null);
            }}
            t={t}
            int={int}
          />
        )}
      </CardContent>
    </Card>
  );
}
