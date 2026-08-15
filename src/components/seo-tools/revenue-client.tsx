"use client";

// AI Revenue — what the answers earned, and what the gap to the top rival costs.
//
// ── THE MODE LABEL SITS WITH THE NUMBER ─────────────────────────────────────
// Every figure on this page carries "measured" or "estimated from visits"
// inline — on the same line as the number, in the same block, never as a
// footnote and never behind a tooltip. A reader who does not know whether
// $4,050 was counted or inferred has been told nothing useful, and a
// disclosure that requires hovering is a disclosure the person quoting the
// number to their client never saw.
//
// Every tenant reads "estimated from visits" today: measured binds to
// AiConversion, which attribution P2 has not shipped. That is the honest state
// rather than a degraded one, so nothing here styles it as a warning.
//
// ── THE FILTERS DRIVE THE SERVER READ ───────────────────────────────────────
// Month and attribution model are query-string params, same as the share of
// voice page's prompt-set and engine filters. Four models over N months is not
// a slice of one payload — each combination is a different set of stored rows
// plus a different credit assignment — and shipping every month's visits to
// the browser to re-credit them there would send far more data than the page
// renders.

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Banknote, TrendingDown, Info } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  REVENUE_COPY,
  SEO_TOOLS_COPY,
  type DashLocale,
  type RevenueCopy,
} from "@/lib/i18n/dashboard";
import type { RevenuePageData } from "@/lib/revenue/page-data";
import type { AttributionModel } from "@/lib/revenue/model";
import { RevenueHelpButton } from "@/components/seo-tools/revenue-help";

const ROUTE = "/visibility/tools/revenue";

const INTL_LOCALE: Record<DashLocale, string> = {
  en: "en",
  fr: "fr",
  "de-CH": "de-CH",
};

/**
 * One colour per assistant, matching ai-attribution-client.tsx exactly so a
 * reader can carry a colour from that page to this one. `dark_ai` stays grey:
 * it is the residual bucket and should not compete with a named assistant.
 */
const SOURCE_COLOR: Record<string, string> = {
  chatgpt: "#10a37f",
  perplexity: "#20808d",
  gemini: "#4285f4",
  copilot: "#7c3aed",
  claude: "#d97757",
  dark_ai: "#9ca3af",
};

/**
 * The mode label, rendered beside a figure.
 *
 * Deliberately low-contrast but not faint: it is a caption on the number, not a
 * warning about it. The title attribute adds the longer explanation for anyone
 * who wants it WITHOUT the short label depending on a hover — the label itself
 * is always visible text.
 */
function ModeLabel({ t, mode }: { t: RevenueCopy; mode: "measured" | "proxy" }) {
  const measured = mode === "measured";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
        measured ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
      }`}
      title={measured ? t.modeMeasuredHint : t.modeProxyHint}
    >
      {measured ? t.modeMeasured : t.modeProxy}
    </span>
  );
}

export function RevenueClient({
  locale,
  data,
  currency,
}: {
  locale: DashLocale;
  data: RevenuePageData;
  /** ISO 4217 from the tenant's Stripe price, or USD when there is no subscription. */
  currency: string;
}) {
  const t = REVENUE_COPY[locale];
  const item = SEO_TOOLS_COPY[locale].items.ai_revenue;
  const router = useRouter();
  const search = useSearchParams();

  const money = useMemo(() => {
    const fmt = new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    return (value: number) => fmt.format(value);
  }, [locale, currency]);

  const percent = useMemo(() => {
    const fmt = new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    // Shares arrive as fractions 0..1, which is what Intl's percent style wants.
    return (value: number) => fmt.format(value);
  }, [locale]);

  const number = useMemo(() => {
    const fmt = new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 1 });
    return (value: number) => fmt.format(value);
  }, [locale]);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(search?.toString() ?? "");
      next.set(key, value);
      router.push(`${ROUTE}?${next.toString()}`);
    },
    [router, search],
  );

  const modelLabel: Record<AttributionModel, string> = {
    first: t.modelFirst,
    last: t.modelLast,
    linear: t.modelLinear,
    influenced: t.modelInfluenced,
  };
  const modelHint: Record<AttributionModel, string> = {
    first: t.modelHintFirst,
    last: t.modelHintLast,
    linear: t.modelHintLinear,
    influenced: t.modelHintInfluenced,
  };

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{item.name}</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">{t.subtitle}</p>
      </div>
      <RevenueHelpButton locale={locale} />
    </div>
  );

  // ── Empty: neither a visit nor a snapshot to price ───────────────────────
  if (!data.hasData) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <Banknote className="h-7 w-7 text-gray-400" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">{t.emptyTitle}</h3>
            <p className="mt-2 max-w-md text-sm text-gray-500">{t.emptyBody}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              <Link
                href="/visibility/tools/ai-attribution"
                className="text-sm font-medium text-amber-700 hover:underline"
              >
                {t.emptyAttribution}
              </Link>
              <Link
                href="/visibility/tools/share-of-voice"
                className="text-sm font-medium text-amber-700 hover:underline"
              >
                {t.emptyShare}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <label
            htmlFor="revenue-month"
            className="block text-xs font-medium uppercase tracking-wide text-gray-500"
          >
            {t.monthLabel}
          </label>
          <select
            id="revenue-month"
            value={data.month}
            onChange={(e) => setParam("month", e.target.value)}
            className="mt-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900"
          >
            {data.months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">
            {t.modelLabel}
          </span>
          {/* role="radiogroup" so the four are announced as one exclusive
              choice rather than four unrelated buttons. They remain individually
              tabbable — no roving tabindex — because that is what the native
              button behaviour already gives, and a half-implemented arrow-key
              handler is worse than none. */}
          <div className="mt-1 inline-flex rounded-md border border-gray-200 p-0.5" role="radiogroup" aria-label={t.modelLabel}>
            {data.models.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={m === data.model}
                title={modelHint[m]}
                onClick={() => setParam("model", m)}
                className={`rounded px-3 py-1 text-sm ${
                  m === data.model
                    ? "bg-gray-900 font-medium text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {modelLabel[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500">{modelHint[data.model]}</p>

      {/* ── The two headline numbers ──────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-500">{t.wonTitle}</p>
          </div>
          {/* The mode label is on this line, with the number. */}
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">{money(data.wonRevenue)}</p>
            <ModeLabel t={t} mode={data.mode} />
          </div>
          <p className="mt-2 text-xs text-gray-400">{t.wonHint}</p>
          <p className="mt-2 text-xs text-gray-500">
            {t.leadsLabel}: <span className="font-medium text-gray-700">{number(data.leads)}</span>
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-rose-600" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-500">{t.lostTitle}</p>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">{money(data.lostRevenueEst)}</p>
            <ModeLabel t={t} mode={data.mode} />
          </div>
          <p className="mt-2 text-xs text-gray-400">{t.lostHint}</p>
          {data.shares.asOf === null ? (
            <p className="mt-2 text-xs text-amber-700">{t.noShare}</p>
          ) : (
            <p className="mt-2 text-xs text-gray-500">
              {t.shareAsOf(data.shares.asOf)} —{" "}
              <span className="font-medium text-gray-700">{percent(data.shares.ownShare)}</span>
              {data.shares.topRivalBrand !== null && (
                <>
                  {" · "}
                  {data.shares.topRivalBrand}{" "}
                  <span className="font-medium text-gray-700">
                    {percent(data.shares.topRivalShare)}
                  </span>
                </>
              )}
            </p>
          )}
        </Card>
      </div>

      {/* The disclaimer sits directly under the two numbers it qualifies. It is
          the homepage ROI calculator's, read from the shared module rather than
          retyped — see src/lib/revenue/disclaimer.ts. */}
      <p className="text-xs text-gray-400">{t.disclaimer}</p>

      {/* State notes. Each explains a way the shown number can differ from what
          a reader expects, and none of them is an error. */}
      {(data.stale || !data.fromRollup || data.alsoHasProxy) && (
        <div className="space-y-1.5">
          {!data.fromRollup && (
            <p className="flex items-start gap-1.5 text-xs text-gray-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t.liveNote}
            </p>
          )}
          {data.stale && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t.staleNote}
            </p>
          )}
          {data.alsoHasProxy && (
            <p className="flex items-start gap-1.5 text-xs text-gray-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t.alsoHasProxyNote}
            </p>
          )}
        </div>
      )}

      {/* ── Per assistant ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{t.bySourceTitle}</h3>
            <ModeLabel t={t} mode={data.mode} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {data.bySource.length === 0 ? (
            <p className="px-6 pb-5 text-sm text-gray-500">{t.emptyBody}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-6 py-2 font-medium">{t.colSource}</th>
                    <th className="px-6 py-2 text-right font-medium">{t.colLeads}</th>
                    <th className="px-6 py-2 text-right font-medium">{t.colWon}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.bySource.map((row) => (
                    <tr key={row.source}>
                      <td className="px-6 py-2.5">
                        <span
                          className="rounded px-1.5 py-0.5 text-xs text-white"
                          style={{ backgroundColor: SOURCE_COLOR[row.source] ?? "#9ca3af" }}
                        >
                          {t.sourceNames[row.source] ?? row.source}
                        </span>
                      </td>
                      <td className="px-6 py-2.5 text-right text-gray-500">
                        {number(row.leads)}
                      </td>
                      <td className="px-6 py-2.5 text-right font-medium text-gray-900">
                        {money(row.wonRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Per engine ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{t.byEngineTitle}</h3>
            <ModeLabel t={t} mode={data.mode} />
          </div>
          <p className="mt-1 text-xs text-gray-400">{t.byEngineHint}</p>
        </CardHeader>
        <CardContent className="p-0">
          {data.byEngine.length === 0 ? (
            <p className="px-6 pb-5 text-sm text-gray-500">{t.noShare}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-6 py-2 font-medium">{t.colEngine}</th>
                    <th className="px-6 py-2 text-right font-medium">{t.colYourShare}</th>
                    <th className="px-6 py-2 text-right font-medium">{t.colRivalShare}</th>
                    <th className="px-6 py-2 text-right font-medium">{t.colLost}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.byEngine.map((row) => (
                    <tr key={row.engine}>
                      <td className="px-6 py-2.5 font-medium text-gray-800">{row.engine}</td>
                      <td className="px-6 py-2.5 text-right text-gray-500">
                        {percent(row.ownShare)}
                      </td>
                      <td className="px-6 py-2.5 text-right text-gray-500">
                        {percent(row.topRivalShare)}
                      </td>
                      <td className="px-6 py-2.5 text-right font-medium text-gray-900">
                        {money(row.lostRevenueEst)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── The assumptions every figure above was built from ──────────────── */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.assumptionsTitle}</h3>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">{t.convRateLabel}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-gray-900">
                {percent(data.assumptions.convRate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                {t.avgSaleValueLabel}
              </dt>
              <dd className="mt-0.5 text-lg font-semibold text-gray-900">
                {money(data.assumptions.avgSaleValue)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                {t.addressableLabel}
              </dt>
              <dd className="mt-0.5 text-lg font-semibold text-gray-900">
                {number(data.addressable)}
              </dd>
              <p className="mt-1 text-xs text-gray-400">{t.addressableHint}</p>
            </div>
          </dl>
          <Link
            href="/settings/account"
            className="mt-4 inline-block text-sm font-medium text-amber-700 hover:underline"
          >
            {t.editAssumptions}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
