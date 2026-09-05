// src/components/seo-tools/recent-research-panel.tsx
//
// "Recent research" on the SEO Tools hub: the last few paid analyses this
// workspace ran, with how old each one is and what it cost.
//
// ── WHY IT SITS ON THE HUB ────────────────────────────────────────────────
// The hub is the page someone is on immediately before they decide which tool
// to open, which makes it the only place this panel changes a decision. On a
// tool page it would be an epitaph; here it is a prompt — "you looked this up
// four days ago" before the click, not after the charge.
//
// ── A SERVER COMPONENT, AND NO LINK PER ROW ───────────────────────────────
// Rows link to the TOOL, not to a stored result: the tool pages read their own
// history and none of them takes a result id in the URL today. Linking to a
// deep URL that does not exist would be worse than linking to the page that
// does.
//
// ── THE ROW IS ASSEMBLED FROM A KEY AND NUMBERS, NEVER FROM STORED PROSE ──
// research_log holds a `feature` key and a small metrics object precisely so
// this component can build its own sentence in the reader's language. A stored
// English summary would render untranslated here forever — see the schema
// comment on ResearchLog.

import Link from "next/link";
import { Clock } from "lucide-react";
import { RESEARCH_LOG_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import {
  RESEARCH_FEATURE_HREFS,
  type ResearchLogEntry,
} from "@/lib/research-log/types";

/**
 * Age as the reader would say it.
 *
 * Locale-aware through the catalog's own functions rather than
 * Intl.RelativeTimeFormat: the three dashboard locales each phrase this
 * differently enough ("il y a 2 jours", "vor 2 Tagen") that the catalog is
 * where it belongs, and this keeps the component free of a second formatting
 * system for one string.
 */
function ageLabel(entry: ResearchLogEntry, t: (typeof RESEARCH_LOG_COPY)[DashLocale]): string {
  if (entry.ageHours < 1) return t.ageJustNow;
  if (entry.ageHours < 24) return t.ageHours(Math.round(entry.ageHours));
  return t.ageDays(Math.round(entry.ageHours / 24));
}

export function RecentResearchPanel({
  locale,
  entries,
}: {
  locale: DashLocale;
  entries: ResearchLogEntry[];
}) {
  const t = RESEARCH_LOG_COPY[locale];

  // Nothing logged is not worth a card. A new workspace's hub should show
  // tools, not an empty box explaining a feature it has not used.
  if (entries.length === 0) return null;

  return (
    <section
      aria-labelledby="recent-research"
      className="border-t border-gray-200 pt-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          id="recent-research"
          className="text-xs font-semibold uppercase tracking-wide text-gray-400"
        >
          {t.panelTitle}
        </h3>
        <p className="text-xs text-gray-400">{t.panelHint}</p>
      </div>

      <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {entries.map((entry) => {
          const href = RESEARCH_FEATURE_HREFS[entry.feature];
          const label = t.features[entry.feature] ?? entry.feature;
          return (
            <li key={entry.id}>
              <Link
                href={href ?? "/visibility/tools"}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none"
              >
                <span className="text-sm font-medium text-gray-900">{label}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-500">
                  {entry.target}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {ageLabel(entry, t)}
                </span>
                {/* Zero-cost research is real — a site crawl buys nothing from
                    the provider — so the cost is omitted rather than shown as
                    "$0.00", which reads as a missing figure. */}
                {entry.costUsd > 0 && (
                  <span className="text-xs tabular-nums text-gray-400">
                    ${entry.costUsd.toFixed(2)}
                  </span>
                )}
                {entry.reusable && (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                    {t.reusable}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
