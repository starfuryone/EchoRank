"use client";

// The External tab (Phase 4g): one row per outbound URL, most-linked first,
// with the status it answered once during the crawl, how many pages link to
// it (expandable) and the first anchor text. Filters: status class, host.

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import { Pager } from "./site-crawler-panels";

const CSV_LINK = "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-300";
const CLASSES = ["4xx", "5xx", "3xx", "2xx", "none"] as const;

interface Row {
  url: string;
  host: string;
  status: number | null;
  sources: number;
  firstAnchor: string | null;
}
interface Data {
  rows: Row[];
  page: number;
  totalPages: number;
  total: number;
}

export function externalQuery(status: string, host: string, page?: number): string {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (host.trim()) q.set("host", host.trim().toLowerCase());
  if (page && page > 1) q.set("page", String(page));
  return q.toString();
}

const statusTone = (s: number | null) =>
  s === null ? "text-gray-400" : s >= 500 ? "text-amber-700" : s >= 400 ? "text-red-700" : s >= 300 ? "text-gray-700" : "text-green-700";

function Sources({ crawlId, url, t }: { crawlId: string; url: string; t: SiteCrawlerCopy["p4g"] }) {
  const [rows, setRows] = useState<{ url: string; anchor: string | null }[] | null>(null);
  const [limit, setLimit] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/${crawlId}/external?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { sources?: { url: string; anchor: string | null }[]; limit?: number } | null) => {
        if (cancelled) return;
        setRows(d?.sources ?? []);
        setLimit(d?.limit ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [crawlId, url]);
  if (!rows) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
      {rows.map((r) => (
        <li key={r.url} className="break-all">
          {r.url}
          {r.anchor ? <span className="text-gray-400"> · {r.anchor}</span> : null}
        </li>
      ))}
      {rows.length >= limit && limit > 0 && <li className="text-gray-400">{t.sourcesMore(String(limit))}</li>}
    </ul>
  );
}

export function ExternalPanel({ crawlId, t, int }: { crawlId: string; t: SiteCrawlerCopy; int: Intl.NumberFormat }) {
  const tg = t.p4g;
  const [status, setStatus] = useState("");
  const [host, setHost] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetch(`/api/seo/v1/crawl/${crawlId}/external?${externalQuery(status, host, page)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Data | null) => {
          if (!cancelled) setData(d ?? { rows: [], page: 1, totalPages: 1, total: 0 });
        })
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [crawlId, status, host, page]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{tg.exTitle}</h3>
            <p className="text-xs text-gray-500">{tg.exHelp("50")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label={tg.colStatus}
              className="w-auto"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={[{ value: "", label: tg.statusAll }, ...CLASSES.map((c) => ({ value: c, label: c === "none" ? tg.statusNone : c }))]}
            />
            <Input
              aria-label={tg.hostLabel}
              placeholder={tg.hostAll}
              className="w-48"
              value={host}
              onChange={(e) => {
                setHost(e.target.value);
                setPage(1);
              }}
            />
            <a className={CSV_LINK} href={`/api/seo/v1/crawl/${crawlId}/external?${externalQuery(status, host)}&format=csv`}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t.exportCsv}
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data ? null : data.rows.length === 0 ? (
          <p className="text-sm text-gray-500">{tg.noRows}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">{tg.colUrl}</th>
                  <th className="py-2 pr-3 font-medium">{tg.colStatus}</th>
                  <th className="py-2 pr-3 font-medium">{tg.colSources}</th>
                  <th className="py-2 pr-3 font-medium">{tg.colAnchor}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.url} className="border-t border-gray-100 align-top">
                    <td className="max-w-md break-all py-2 pr-3 text-gray-900">
                      {r.url}
                      {open === r.url && <Sources crawlId={crawlId} url={r.url} t={tg} />}
                    </td>
                    <td className={`py-2 pr-3 tabular-nums ${statusTone(r.status)}`}>{r.status ?? tg.notChecked}</td>
                    <td className="py-2 pr-3">
                      <button type="button" className="tabular-nums text-gray-700 underline-offset-2 hover:underline" onClick={() => setOpen(open === r.url ? null : r.url)}>
                        {open === r.url ? tg.hideSources : tg.showSources(int.format(r.sources))}
                      </button>
                    </td>
                    <td className="max-w-xs break-words py-2 pr-3 text-gray-700">{r.firstAnchor ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.totalPages > 1 && <Pager page={data.page} totalPages={data.totalPages} onPage={(p) => setPage(p)} t={t} int={int} />}
      </CardContent>
    </Card>
  );
}
