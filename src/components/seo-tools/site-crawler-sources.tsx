"use client";

// The "Add data" section's automatic sources (Phase 4d): whether Search
// Console covers the typed site, and which GA4 property crawls join. Both
// join at aggregation with no opt-in; these lines say whether they will.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SiteCrawler4dCopy } from "@/lib/i18n/site-crawler-4d";

interface Sources {
  /** connectHref: the GSC tool page, or /settings on a plan without the SEO tools (the route decides). */
  gsc: { connected: boolean; property: string | null; covers: boolean; connectHref?: string } | null;
  ga4: { connected: boolean; property: string | null } | null;
}

export function SourceLines({ t, host }: { t: SiteCrawler4dCopy; host: string | null }) {
  const [data, setData] = useState<{ host: string; sources: Sources } | null>(null);
  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetch(`/api/seo/v1/crawl/sources?host=${encodeURIComponent(host)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Sources | null) => {
          if (!cancelled && d) setData({ host, sources: d });
        })
        .catch(() => {});
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [host]);
  const s = data?.host === host ? data.sources : null;
  if (!s) return null;
  const gscConnectHref = s.gsc?.connectHref ?? "/visibility/tools/gsc-insights";
  return (
    <ul className="space-y-1 text-xs text-gray-600">
      {s.gsc && (
        <li>
          {s.gsc.connected && s.gsc.property ? (
            s.gsc.covers ? t.lineGscConnected(s.gsc.property) : t.lineGscOther(s.gsc.property)
          ) : (
            <>
              {t.lineGscNone}{" "}
              <Link className="text-blue-700 hover:underline" href={gscConnectHref}>
                {t.lineGscConnect}
              </Link>
            </>
          )}
        </li>
      )}
      {s.ga4 && (
        <li>
          {s.ga4.property ? (
            t.lineGa4(s.ga4.property)
          ) : (
            <>
              {t.lineGa4None}{" "}
              <Link className="text-blue-700 hover:underline" href="/settings">
                {t.lineGa4Pick}
              </Link>
            </>
          )}
        </li>
      )}
    </ul>
  );
}
