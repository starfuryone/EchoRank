"use client";

// The Inlinks panel (Phase 4a): every crawled page that links to one page,
// with its anchor text, from crawl_links. Opened from the Pages table.

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";

type T = SiteCrawlerCopy["p4a"];

interface Inlink {
  id: string;
  source: string;
  anchor: string | null;
  nofollow: boolean;
}

export function InlinksPanel({
  crawlId,
  page,
  t,
  onClose,
}: {
  crawlId: string;
  page: { id: string; url: string };
  t: T;
  /** Absent inside the Pages view's detail panel, which has its own close. */
  onClose?: () => void;
}) {
  const [rows, setRows] = useState<Inlink[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const base = `/api/seo/v1/crawl/${crawlId}/pages/${page.id}/inlinks`;

  async function load(cursor: string | null) {
    const res = await fetch(cursor ? `${base}?cursor=${encodeURIComponent(cursor)}` : base).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    return data as { inlinks: Inlink[]; next: string | null } | null;
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await load(null);
      if (cancelled) return;
      setRows(data?.inlinks ?? []);
      setNext(data?.next ?? null);
    })();
    return () => {
      cancelled = true;
    };
    // `load` closes over `base` only, which the deps cover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4" role="region" aria-label={t.inlinksTitle(page.url)}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="min-w-0 truncate text-sm font-semibold text-gray-900" title={page.url}>
          {t.inlinksTitle(page.url)}
        </h4>
        <div className="flex items-center gap-2">
          <a href={`${base}?format=csv`} className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900">
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> CSV
          </a>
          {onClose && (
            <button type="button" aria-label={t.close} onClick={onClose} className="text-gray-600 hover:text-gray-900">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {rows === null ? null : rows.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">{t.inlinksEmpty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                <th scope="col" className="py-2 pr-3">{t.colSource}</th>
                <th scope="col" className="py-2">{t.colAnchor}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="max-w-md py-2 pr-3">
                    <span className="block truncate text-gray-600" title={r.source}>
                      {r.source}
                    </span>
                  </td>
                  <td className="py-2 text-gray-700">
                    {r.anchor ?? "—"}
                    {r.nofollow && <span className="ml-2 rounded bg-gray-100 px-1.5 text-xs text-gray-500">{t.nofollow}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {next && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={async () => {
                const data = await load(next);
                setRows((r) => [...(r ?? []), ...(data?.inlinks ?? [])]);
                setNext(data?.next ?? null);
              }}
            >
              {t.loadMore}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
