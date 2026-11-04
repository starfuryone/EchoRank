"use client";

// The Results view's head (UX restructure, /crawler/[id]): the plain-language
// completeness banner, the Site health hero beside pages and the three kind
// totals, "Fix first", the grouped tab strip (roving tabindex) and the
// Exports menu. Data comes from the client; nothing here fetches.

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Download, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RULE_COPY } from "@/lib/crawl-rules-meta";
import { fixFirst } from "@/lib/site-crawler/site-health";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import type { CrawlDto, CrawlSummaryDto, PartialSummaryDto, RuleKindDto } from "@/lib/site-crawler/types";

type Summary = CrawlSummaryDto | PartialSummaryDto | null;

// ── Completeness ──────────────────────────────────────────────────────────

/** Did any post-crawl data step stop at the SEO data (USD) budget? */
export function budgetStopped(summary: Summary): boolean {
  const status = summary && "metricOverview" in summary ? (summary.metricOverview?.status as Record<string, { stoppedReason?: string | null } | undefined> | undefined) : undefined;
  return Object.values(status ?? {}).some((s) => s?.stoppedReason === "usd_cap");
}

/** Every banner line that applies to this crawl, most important first; empty for a full crawl. */
export function completenessLines(crawl: CrawlDto, summary: Summary, t: SiteCrawlerCopy, int: Intl.NumberFormat): string[] {
  const u = t.ux;
  const out: string[] = [];
  if (crawl.status === "FAILED") out.push(u.bannerFailed);
  else if (crawl.stoppedReason === "time_cap") out.push(u.bannerTime(int.format(crawl.pagesCrawled), int.format(crawl.urlCap)));
  else if (crawl.stoppedReason === "url_cap") out.push(u.bannerUrlCap(int.format(crawl.urlCap)));
  else if (crawl.stoppedReason === "cancelled" || crawl.status === "CANCELLED") out.push(u.bannerCancelled(int.format(crawl.pagesCrawled)));
  else if (crawl.stoppedReason === "list_expired") out.push(t.p4a.stoppedListExpired);
  if (budgetStopped(summary)) out.push(u.bannerUsdCap);
  if (crawl.mode === "list") out.push(u.bannerList);
  if (crawl.dataPurgedAt) out.push(u.bannerPurged);
  return out;
}

export function CompletenessBanner({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div role="status" data-testid="completeness" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <ul className="space-y-0.5">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────

function healthTone(score: number): string {
  // Text colours chosen for ≥ 4.5:1 on white.
  if (score >= 80) return "text-green-800";
  if (score >= 50) return "text-amber-800";
  return "text-red-700";
}

export function ResultsHero({ crawl, summary, t, int }: { crawl: CrawlDto; summary: Summary; t: SiteCrawlerCopy; int: Intl.NumberFormat }) {
  const u = t.ux;
  const health = crawl.health ?? null;
  const byKind: Partial<Record<RuleKindDto, number>> = (summary && summary.issuesByKind) || {};
  const tiles: [string, number | undefined, string][] = [
    [u.pagesCrawled, crawl.pagesCrawled, "pages"],
    [u.kindIssue, byKind.issue, "issue"],
    [u.kindWarning, byKind.warning, "warning"],
    [u.kindOpportunity, byKind.opportunity, "opportunity"],
  ];
  return (
    <section aria-label={u.health} className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))]" data-testid="results-hero">
      <div className="col-span-2 rounded-lg border border-gray-200 bg-white p-4 sm:col-span-1">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-600">{u.health}</p>
        <p className="mt-1 flex items-baseline gap-1">
          <span data-health className={`text-4xl font-semibold tabular-nums ${health === null ? "text-gray-600" : healthTone(health)}`}>
            {health === null ? u.healthNone : int.format(health)}
          </span>
          {health !== null && <span className="text-sm text-gray-600">{u.healthOutOf}</span>}
        </p>
        <p className="mt-1 text-xs text-gray-600">{u.healthHelp}</p>
      </div>
      {tiles.map(([label, value, key]) => (
        <div key={key} className="rounded-lg border border-gray-200 bg-white p-4" data-kind={key}>
          <p className="text-xs font-medium text-gray-600">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value === undefined ? "—" : int.format(value)}</p>
        </div>
      ))}
    </section>
  );
}

// ── Fix first ─────────────────────────────────────────────────────────────

export function FixFirst({ summary, onOpenRule, ruleHref, t, int }: { summary: Summary; onOpenRule: (ruleId: string) => void; ruleHref: (ruleId: string) => string; t: SiteCrawlerCopy; int: Intl.NumberFormat }) {
  const u = t.ux;
  if (!summary || !summary.issues) return null;
  const items = fixFirst(summary.issues, 5);
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{u.fixFirst}</h2>
          <p className="text-xs text-gray-600">{u.fixFirstHelp}</p>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-gray-700">{u.fixFirstNone}</p>
        ) : (
          <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="fix-first">
            {items.map((it) => {
              const copy = RULE_COPY[it.ruleId];
              return (
                <li key={it.ruleId} data-rule={it.ruleId} className="flex min-w-0 flex-col gap-1 rounded-lg border border-gray-200 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="min-w-0 text-sm font-medium text-gray-900">{copy?.name ?? it.ruleId}</h3>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-red-700">{u.fixPages(int.format(it.pages))}</span>
                  </div>
                  {copy?.description && <p className="text-xs text-gray-700">{copy.description}</p>}
                  <a
                    href={ruleHref(it.ruleId)}
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenRule(it.ruleId);
                    }}
                    className="text-sm font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {u.fixSee}
                  </a>
                  {copy?.howToFix && (
                    <details className="text-xs text-gray-700">
                      <summary className="cursor-pointer font-medium text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{u.fixHow}</summary>
                      <p className="mt-1">{copy.howToFix}</p>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ── Tab strip (roving tabindex) ──────────────────────────────────────────

export function TabStrip<T extends string>({
  items,
  current,
  onSelect,
  label,
  size = "md",
}: {
  items: { id: T; label: string }[];
  current: T;
  onSelect: (id: T) => void;
  label: string;
  size?: "md" | "sm";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, items.findIndex((i) => i.id === current));
  const move = (to: number) => {
    const n = (to + items.length) % items.length;
    onSelect(items[n]!.id);
    refs.current[n]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={`flex max-w-full flex-wrap gap-1 ${size === "md" ? "border-b border-gray-200" : ""}`}>
      {items.map((it, i) => {
        const on = i === idx;
        return (
          <button
            key={it.id}
            ref={(b) => {
              refs.current[i] = b;
            }}
            type="button"
            role="tab"
            id={`tab-${it.id}`}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(it.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") move(i + 1);
              else if (e.key === "ArrowLeft") move(i - 1);
              else if (e.key === "Home") move(0);
              else if (e.key === "End") move(items.length - 1);
              else return;
              e.preventDefault();
            }}
            className={
              size === "md"
                ? `-mb-px border-b-2 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${on ? "border-blue-600 text-blue-700" : "border-transparent text-gray-700 hover:text-gray-900"}`
                : `rounded-lg px-3 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${on ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`
            }
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Exports menu ──────────────────────────────────────────────────────────

export function ExportsMenu({ links, children, t }: { links: { href: string; label: string }[]; children?: React.ReactNode; t: SiteCrawlerCopy }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {t.ux.exports}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {/* Kept mounted (hidden) so the PDF and Sheets controls keep their own state. */}
      <div id={id} hidden={!open} data-testid="exports-menu" className="absolute right-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="block rounded px-2 py-1 text-sm text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        {children}
      </div>
    </div>
  );
}
