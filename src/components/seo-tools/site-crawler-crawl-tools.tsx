"use client";

// Per-crawl tools under the crawl header (Phase 4a): pin, the link-graph
// exports, and the XML sitemap generator. The sitemap form builds a plain
// download link to /crawl/[id]/sitemap; nothing is generated until it is
// clicked, and nothing is stored.

import { useState } from "react";
import { Download, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import type { CrawlDto } from "@/lib/site-crawler/types";
import { flag } from "@/lib/flags";
import { CRAWL_PIN_MAX } from "@/lib/site-crawler/constants";

type T = SiteCrawlerCopy["p4a"];

const linkClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-300";

export function sitemapHref(
  crawlId: string,
  o: { lastmod: string; changefreq: string; priority: string; exclude: string; images: boolean },
): string {
  const q = new URLSearchParams({ lastmod: o.lastmod, changefreq: o.changefreq, priority: o.priority });
  for (const p of o.exclude.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 20)) q.append("exclude", p);
  if (o.images) q.set("images", "1");
  return `/api/seo/v1/crawl/${crawlId}/sitemap?${q}`;
}

export function CrawlTools({
  crawl,
  segment = null,
  t,
  kept,
  onUpdated,
}: {
  /** Phase 4b: the selected segment (index); the exports follow it. */
  segment?: string | null;
  crawl: CrawlDto;
  t: T;
  kept: string;
  onUpdated: (c: CrawlDto) => void;
}) {
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);
  const [lastmod, setLastmod] = useState("crawl");
  const [changefreq, setChangefreq] = useState("none");
  const [priority, setPriority] = useState("none");
  const [exclude, setExclude] = useState("");
  const [images, setImages] = useState(false);

  const purged = Boolean(crawl.dataPurgedAt);
  const segQ = segment ? `&segment=${encodeURIComponent(segment)}` : "";
  const settled = crawl.status === "COMPLETED" || crawl.status === "FAILED" || crawl.status === "CANCELLED";

  async function togglePin() {
    setPinning(true);
    setPinError(null);
    const res = await fetch(`/api/seo/v1/crawl/${crawl.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pinned: !crawl.pinned }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (res?.ok && data) onUpdated({ ...crawl, ...data, severityCounts: crawl.severityCounts });
    else if (data?.code === "PIN_LIMIT") setPinError(t.errPinLimit(String(CRAWL_PIN_MAX)));
    setPinning(false);
  }

  if (!settled) return null;

  return (
    <div className="space-y-3 border-t border-gray-100 pt-4">
      {purged && <p className="text-sm text-gray-600">{t.purgedNote}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!purged && (
          <Button type="button" size="sm" variant="outline" onClick={togglePin} disabled={pinning}>
            {crawl.pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
            {crawl.pinned ? t.unpin : t.pin}
          </Button>
        )}
        {!purged && flag("crawl.links") && (
          <>
            <a href={`/api/seo/v1/crawl/${crawl.id}/export?view=broken-links${segQ}`} className={linkClass}>
              <Download className="h-4 w-4" aria-hidden="true" /> {t.exportBrokenLinks}
            </a>
            <a href={`/api/seo/v1/crawl/${crawl.id}/export?view=redirects${segQ}`} className={linkClass}>
              <Download className="h-4 w-4" aria-hidden="true" /> {t.exportRedirectHops}
            </a>
          </>
        )}
      </div>
      {!purged && <p className="text-xs text-gray-500">{t.pinnedHelp(kept, String(CRAWL_PIN_MAX))}</p>}
      {pinError && <p className="text-xs text-red-600">{pinError}</p>}

      {!purged && crawl.status === "COMPLETED" && crawl.mode !== "list" && flag("crawl.sitemapGen") && (
        <details className="rounded-lg border border-gray-200">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-900">{t.sitemapTitle}</summary>
          <div className="space-y-3 border-t border-gray-100 p-3">
            <p className="text-xs text-gray-500">{t.sitemapHelp}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select
                id={`sm-lastmod-${crawl.id}`}
                label={t.sitemapLastmod}
                value={lastmod}
                onChange={(e) => setLastmod(e.target.value)}
                options={[
                  { value: "crawl", label: t.lastmodCrawl },
                  { value: "header", label: t.lastmodHeader },
                  { value: "none", label: t.lastmodNone },
                ]}
              />
              <Select
                id={`sm-changefreq-${crawl.id}`}
                label={t.sitemapChangefreq}
                value={changefreq}
                onChange={(e) => setChangefreq(e.target.value)}
                // The protocol's own values: shown as written, like lastmod.
                options={[{ value: "none", label: t.leaveOut }, ...["daily", "weekly", "monthly", "yearly"].map((v) => ({ value: v, label: v }))]}
              />
              <Select
                id={`sm-priority-${crawl.id}`}
                label={t.sitemapPriority}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                options={[
                  { value: "none", label: t.leaveOut },
                  { value: "depth", label: t.priorityDepth },
                  { value: "0.5", label: t.priorityFixed },
                ]}
              />
            </div>
            <div>
              <label htmlFor={`sm-exclude-${crawl.id}`} className="mb-1 block text-xs font-medium text-gray-700">
                {t.sitemapExclude}
              </label>
              <textarea
                id={`sm-exclude-${crawl.id}`}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                value={exclude}
                onChange={(e) => setExclude(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={images} onChange={(e) => setImages(e.target.checked)} />
              {t.sitemapImages}
            </label>
            <a href={sitemapHref(crawl.id, { lastmod, changefreq, priority, exclude, images })} className={linkClass}>
              <Download className="h-4 w-4" aria-hidden="true" /> {t.sitemapDownload}
            </a>
          </div>
        </details>
      )}
    </div>
  );
}
