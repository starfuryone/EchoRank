"use client";

// Bot Analytics v1 — crawler ACCESS POSTURE, honestly labeled. Data comes
// from the sidecar's live robots.txt/sitemap/llms.txt evaluation (or the
// stored audit snapshot, flagged stale). Zero traffic numbers: none exist.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, AlertCircle, ScanSearch, Info } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { BOT_CATALOG, type BotCategory } from "@/lib/bot-catalog";
import {
  BOT_ANALYTICS_COPY,
  SEO_TOOLS_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";

interface BotState {
  status: "ALLOWED" | "BLOCKED";
  detail: string;
}
interface PostureData {
  url: string | null;
  source?: "live" | "audit_snapshot";
  checkedAt?: string;
  robotsPresent?: boolean;
  bots?: Record<string, BotState>;
  sitemap?: { found: boolean; urls: string[] } | null;
  llmsTxt?: boolean | null;
  error?: string;
}

const CATEGORY_ORDER: BotCategory[] = ["search", "ai_answers", "ai_training"];

export function BotAnalyticsClient({ locale }: { locale: DashLocale }) {
  const t = BOT_ANALYTICS_COPY[locale];
  const tools = SEO_TOOLS_COPY[locale];
  const [data, setData] = useState<PostureData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai/visibility/bots")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setError(t.loadFailed));
  }, [t]);

  const it = tools.items.bot_analytics;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {it.name}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{it.description}</p>
      </div>

      {/* Honest framing: posture, not traffic */}
      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <p className="text-xs text-gray-500">{t.postureNote}</p>
      </div>

      {error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      )}

      {!data && !error && <p className="text-sm text-gray-400">{t.loading}</p>}

      {data && !error && data.url === null && (
        /* No site configured anywhere → point at the real action */
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Bot className="h-7 w-7 text-gray-400" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">{t.emptyTitle}</h3>
          <p className="mt-2 max-w-md text-sm text-gray-500">{t.emptyBody}</p>
          <Link
            href="/visibility"
            className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <ScanSearch className="mr-2 h-4 w-4" aria-hidden="true" />
            {tools.scaffolds.bot_analytics.related}
          </Link>
        </div>
      )}

      {data && !error && data.url && data.bots && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>
              {t.siteLabel}: <span className="font-medium text-gray-800">{data.url}</span>
            </span>
            {data.checkedAt && data.source === "live" && (
              <span className="text-xs text-gray-400">
                {t.checkedAt(formatDate(data.checkedAt, locale))}
              </span>
            )}
          </div>

          {data.source === "audit_snapshot" && data.checkedAt && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              {t.staleNote(formatDate(data.checkedAt, locale))}
            </p>
          )}

          {/* Crawlability chips (only fields the source actually provided) */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={data.robotsPresent ? "default" : "info"}>
              {data.robotsPresent ? t.robotsPresent : t.robotsMissing}
            </Badge>
            {data.sitemap != null && (
              <Badge variant={data.sitemap.found ? "success" : "warning"}>
                {data.sitemap.found ? t.sitemapFound : t.sitemapMissing}
              </Badge>
            )}
            {data.llmsTxt != null && (
              <Badge variant={data.llmsTxt ? "success" : "default"}>
                {data.llmsTxt ? t.llmsFound : t.llmsMissing}
              </Badge>
            )}
          </div>

          {/* Posture per bot, grouped by what the bot feeds */}
          {CATEGORY_ORDER.map((cat) => {
            const bots = BOT_CATALOG.filter(
              (b) => b.category === cat && data.bots && data.bots[b.token],
            );
            if (bots.length === 0) return null;
            return (
              <Card key={cat}>
                <CardHeader>
                  <h3 className="text-base font-semibold text-gray-900">
                    {t.categoryLabels[cat]}
                  </h3>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-gray-100">
                    {bots.map((b) => {
                      const state = data.bots![b.token];
                      const open = state.status !== "BLOCKED";
                      return (
                        <li
                          key={b.token}
                          className="flex items-center justify-between gap-3 px-6 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {b.token}{" "}
                              <span className="text-xs font-normal text-gray-400">
                                · {b.org}
                              </span>
                            </p>
                            <p className="text-xs text-gray-500">{t.botDesc[b.token]}</p>
                            <p className="mt-0.5 text-xs text-gray-400">{state.detail}</p>
                          </div>
                          <Badge variant={open ? "success" : "danger"}>
                            {open ? t.statusOpen : t.statusBlocked}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
