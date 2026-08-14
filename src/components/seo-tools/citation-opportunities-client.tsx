"use client";

// Citation Opportunities — the ranked worklist and its status buttons.
//
// CARDS, NOT A TABLE, and that is the one real design decision here. Citation
// Finder next door is a table because its job is comparison: seven columns you
// scan down and sort. This is a worklist — each row carries a paragraph of
// instructions somebody has to read and act on, and a paragraph in a table cell
// is a paragraph nobody reads. The card is what makes the how-to the largest
// thing on the row, which is what the tool is for.
//
// ORDER IS THE SERVER'S. `priority DESC` comes off an index (see read.ts); this
// component never sorts. The list is the product and a client-side sort would
// rank whatever arrived.
//
// THE SCORE IS NEVER SHOWN. It is unitless and ordinal — see score.ts — so a
// number on the card would be a number the customer cannot act on. The ORDER
// carries it, and the effort badge carries the only comparison worth printing.
//
// STATUS IS OPTIMISTIC, WITH A REAL ROLLBACK. The button paints the new state
// immediately and puts it back if the PATCH fails, with an error the customer
// can see. A worklist whose buttons feel slow is a worklist people stop
// clicking; a worklist that silently loses a click is worse.
//
// Light mode only, deliberately: this dashboard has no dark theme — there is no
// `darkMode` in the Tailwind config and not one `dark:` class in any sibling
// tool client — so a second set of steps would be unreachable code.

import { useCallback, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, ListChecks, Lock, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  SEO_TOOLS_COPY,
  CITATION_OPPORTUNITIES_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";
import type { OpportunityPageData, OpportunityRow } from "@/lib/citation-opportunities/read";
import type { OpportunityStatus } from "@/lib/citation-opportunities/score";

type Copy = (typeof CITATION_OPPORTUNITIES_COPY)[DashLocale];

/** BCP-47 for the three dashboard locales, for number formatting. */
const INTL_LOCALE: Record<DashLocale, string> = {
  en: "en",
  fr: "fr",
  "de-CH": "de-CH",
};

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) =>
    values[key] === undefined ? "" : String(values[key]),
  );
}

/**
 * The buttons one card offers, per current status.
 *
 * Every status can reach every other one — a worklist is not a workflow, and
 * store.ts says why — but showing all four buttons on every card would mean one
 * of them is always a no-op. These are the transitions that are worth a click
 * from where you are.
 */
const TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  OPEN: ["IN_PROGRESS", "DONE", "DISMISSED"],
  IN_PROGRESS: ["DONE", "OPEN", "DISMISSED"],
  DONE: ["OPEN"],
  DISMISSED: ["OPEN"],
};

const STATUS_CLASS: Record<OpportunityStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-900",
  DONE: "bg-green-100 text-green-800",
  DISMISSED: "bg-gray-100 text-gray-600",
};

/** Effort reads low-to-high, so the colour does too. Never colour alone. */
const EFFORT_CLASS: Record<string, string> = {
  LOW: "bg-green-50 text-green-800 ring-green-200",
  MED: "bg-amber-50 text-amber-900 ring-amber-200",
  HIGH: "bg-rose-50 text-rose-900 ring-rose-200",
};

export function CitationOpportunitiesClient({
  locale,
  data,
  locked,
}: {
  locale: DashLocale;
  data: OpportunityPageData;
  locked: boolean;
}) {
  const copy = CITATION_OPPORTUNITIES_COPY[locale];
  const item = SEO_TOOLS_COPY[locale].items.citation_opportunities;

  // The server's rows are the source of truth; this map only holds statuses the
  // customer has changed since the page loaded, so a refresh discards nothing.
  const [overrides, setOverrides] = useState<Record<string, OpportunityStatus>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  const setStatus = useCallback(async (id: string, previous: OpportunityStatus, next: OpportunityStatus) => {
    setOverrides((current) => ({ ...current, [id]: next }));
    setSaving((current) => ({ ...current, [id]: true }));
    setFailed((current) => ({ ...current, [id]: false }));

    try {
      const response = await fetch(`/api/citation-opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      // Put it back. An optimistic update that quietly stays wrong is how a
      // customer ends up believing they marked ten things done.
      setOverrides((current) => ({ ...current, [id]: previous }));
      setFailed((current) => ({ ...current, [id]: true }));
    } finally {
      setSaving((current) => ({ ...current, [id]: false }));
    }
  }, []);

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{item.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{item.description}</p>
      </div>
    </div>
  );

  // ── Locked (below Growth) ──────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Lock className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{copy.lockedTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{copy.lockedBody}</p>
              <Link
                href="/billing"
                className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {copy.lockedCta}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Empty (unlocked, nothing scored yet) ──────────────────────────────────
  if (!data.hasData) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <ListChecks className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{copy.emptyTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{copy.emptyBody}</p>
              <Link
                href="/visibility/tools/citation-finder"
                className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {copy.emptyFinderCta}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const numberFormat = new Intl.NumberFormat(INTL_LOCALE[locale]);

  return (
    <div className="space-y-6">
      {header}

      {/* ── Counts. "N sources" is the header count the spec asks for; the
          other two only appear when they are non-zero, because "0 now citing
          you" on a customer's first week reads as a failure report. ── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
        <span className="font-medium text-gray-900">
          {interpolate(copy.sourcesCount, { count: numberFormat.format(data.total) })}
        </span>
        {data.openCount > 0 && (
          <span>{interpolate(copy.openCount, { count: numberFormat.format(data.openCount) })}</span>
        )}
        {data.provenCount > 0 && (
          <span className="inline-flex items-center gap-1 text-green-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {interpolate(copy.provenCount, { count: numberFormat.format(data.provenCount) })}
          </span>
        )}
      </div>

      <ul className="space-y-4">
        {data.rows.map((row) => (
          <OpportunityCard
            key={row.id}
            row={row}
            copy={copy}
            status={overrides[row.id] ?? row.status}
            saving={saving[row.id] === true}
            failed={failed[row.id] === true}
            onStatus={setStatus}
          />
        ))}
      </ul>

      <p className="text-xs text-gray-400">{copy.methodNote}</p>
    </div>
  );
}

function OpportunityCard({
  row,
  copy,
  status,
  saving,
  failed,
  onStatus,
}: {
  row: OpportunityRow;
  copy: Copy;
  status: OpportunityStatus;
  saving: boolean;
  failed: boolean;
  onStatus: (id: string, previous: OpportunityStatus, next: OpportunityStatus) => void;
}) {
  // The localized template, keyed on the same `kind` the job used. `row.howTo`
  // is the stored English and is the fallback for a kind this catalog does not
  // know — see the catalog header and the schema comment on the column.
  const template = copy.howTo[row.kind] ?? row.howTo;
  const howTo = template
    .replace(/\{domain\}/g, row.domain)
    .replace(/\{theme\}/g, row.theme?.trim() || copy.themeFallback);

  // Only a DONE row can be proven, and only a proven one gets the badge. The
  // read model derives it from the live rollup; nothing is stored.
  const showProof = status === "DONE" && row.proven;

  return (
    <li>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {/* The domain is a link out, because the next thing anybody
                    does with a source they need to get onto is go and look at
                    it. noreferrer as well as noopener: a third-party site the
                    engines chose, not one we vouch for. */}
                <a
                  href={`https://${row.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-base font-semibold text-blue-600 hover:text-blue-700"
                >
                  {row.domain}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>

                {showProof && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                    title={copy.provenTitle}
                  >
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    {copy.provenBadge}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-500">{copy.kinds[row.kind]}</span>
                {/* Effort is spelled out, not colour-coded alone. */}
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${
                    EFFORT_CLASS[row.effort] ?? EFFORT_CLASS.MED
                  }`}
                >
                  {copy.effortLabel}: {copy.efforts[row.effort]}
                </span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 font-medium ${STATUS_CLASS[status]}`}
                >
                  {copy.statuses[status]}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {TRANSITIONS[status].map((next) => (
                <button
                  key={next}
                  type="button"
                  disabled={saving}
                  onClick={() => onStatus(row.id, status, next)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copy.actions[next]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {copy.howToTitle}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-700">{howTo}</p>
            {/* The one how-to that hands off to another tool in this product,
                as a real link rather than a sentence naming a page. */}
            {row.kind === "REVIEW_SITE" && (
              <Link
                href="/campaigns"
                className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {copy.campaignsCta}
              </Link>
            )}
          </div>

          {/* aria-live so a failed save is announced, not just coloured. */}
          <p aria-live="polite" className="text-xs">
            {saving && <span className="text-gray-500">{copy.statusSaving}</span>}
            {failed && !saving && <span className="text-rose-700">{copy.statusError}</span>}
          </p>
        </CardContent>
      </Card>
    </li>
  );
}
