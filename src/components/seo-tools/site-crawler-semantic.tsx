"use client";

// Semantic duplicates on the start card (Phase 4g): embed the crawl's top N
// pages after the crawl on the tenant's own OpenAI key (there is no house
// key for this), N capped by the plan. The estimate is N × ~1,500 tokens at
// OpenAI's published price for text-embedding-3-small.

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SiteCrawler4dCopy } from "@/lib/i18n/site-crawler-4d";
import type { SiteCrawler4gCopy } from "@/lib/i18n/site-crawler-4g";
import type { TopPages } from "@/lib/site-crawler/crawl-config";

/** Mirrors semantic.ts (a server module): ~1,500 tokens a page, $0.02 per million. */
export const SEM_TOKENS_PER_PAGE = 1_500;
export const SEM_USD_PER_MTOK = 0.02;
export const semanticEstimate = (pages: number) => ({ tokens: pages * SEM_TOKENS_PER_PAGE, usd: (pages * SEM_TOKENS_PER_PAGE * SEM_USD_PER_MTOK) / 1_000_000 });
const usd = (n: number) => `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;

export function semanticConfirmLine(t: SiteCrawler4gCopy, top: TopPages, int: Intl.NumberFormat): string {
  return t.confirmSem(int.format(top.pages), usd(semanticEstimate(top.pages).usd));
}

export function SemanticSection({
  t,
  t4d,
  cap,
  hasKey,
  value,
  segments,
  int,
  disabled,
  onChange,
}: {
  t: SiteCrawler4gCopy;
  t4d: SiteCrawler4dCopy;
  cap: number;
  /** The tenant saved an OpenAI key (Settings → Integrations). */
  hasKey: boolean;
  value: TopPages | null;
  segments: string[];
  int: Intl.NumberFormat;
  disabled: boolean;
  onChange: (v: TopPages | null) => void;
}) {
  const est = value ? semanticEstimate(value.pages) : null;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={value !== null}
          disabled={disabled || cap <= 0 || !hasKey}
          onChange={(e) => onChange(e.target.checked ? { pages: Math.min(500, cap), segment: null } : null)}
        />
        {t.semOn}
      </label>
      <p className="pl-6 text-xs text-gray-500">{t.semHelp(int.format(cap))}</p>
      <p className={hasKey ? "pl-6 text-xs text-gray-500" : "pl-6 text-xs text-amber-700"}>
        {hasKey ? (
          t.semOwnKey
        ) : (
          <Link href="/settings" className="underline">
            {t.semNeedsKey}
          </Link>
        )}
      </p>
      {value && est && (
        <div className="space-y-1 pl-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-28">
              <label htmlFor="sem-pages" className="mb-1 block text-xs font-medium text-gray-700">
                {t4d.pagesLabel}
              </label>
              <Input
                id="sem-pages"
                inputMode="numeric"
                value={String(value.pages)}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, pages: Math.max(1, Math.min(cap, Number(e.target.value.replace(/\D/g, "")) || 1)) })}
              />
            </div>
            <div className="w-72">
              <Select
                id="sem-by"
                label={t4d.byLabel}
                value={value.segment === null ? "" : String(value.segment)}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, segment: e.target.value === "" ? null : Number(e.target.value) })}
                options={[{ value: "", label: t4d.byInlinks }, ...segments.map((name, i) => ({ value: String(i), label: t4d.bySegment(name) }))]}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">{t.semEstimate(int.format(est.tokens), usd(est.usd))}</p>
        </div>
      )}
    </div>
  );
}

/** The crawl's semantic step, from summary.metrics.semantic. */
export function semanticStatusText(
  st: { status?: string; stoppedReason?: string; targets?: number; completed?: number; embedded?: number } | undefined,
  t: SiteCrawler4gCopy,
  int: Intl.NumberFormat,
): string | null {
  if (!st?.status) return null;
  if (st.status === "stopped") return t.semStatusKey;
  if (st.status === "done") return t.semStatusDone(int.format(st.embedded ?? 0), int.format(st.targets ?? 0));
  return t.semStatusRunning(int.format(st.completed ?? 0), int.format(st.targets ?? 0));
}
