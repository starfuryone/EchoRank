// src/components/visibility/ReadinessBreakdown.tsx
//
// The AI readiness score (v2) explained: its five groups, the gates that cap
// it ("Capped at 45: homepage has under 150 words"), the top 3 fixes by points
// recoverable, and every check behind a disclosure. All words come from
// src/lib/i18n/readiness.ts by the sidecar's ids, so fr / de-CH readers get
// their own language whatever English the sidecar wrote.
import {
  READINESS_COPY,
  fixLines,
  gateLine,
  groupTitle,
  type ReadinessFix,
  type ReadinessGate,
  type ReadinessGroup,
  type ReadinessLocale,
} from "@/lib/i18n/readiness";

export interface ReadinessAudit {
  confidence?: "high" | "low";
  gates?: ReadinessGate[];
  groups?: ReadinessGroup[];
  top_fixes?: ReadinessFix[];
  /** `scored: false` (v3): informational, shown as "not scored" instead of points. */
  checks: { id?: string; category: string; points: number; max: number; status: string; ran?: boolean; scored?: boolean }[];
}

export function ReadinessBreakdown({ audit, locale }: { audit: ReadinessAudit; locale: ReadinessLocale }) {
  const c = READINESS_COPY[locale];
  const fixes = fixLines(audit.top_fixes, locale);
  return (
    <div className="space-y-5" data-testid="readiness-breakdown">
      <div className="space-y-3">
        {(audit.groups ?? []).map((g) => {
          const ratio = g.max ? g.points / g.max : 0;
          const bar = ratio >= 0.999 ? "bg-green-500" : ratio > 0 ? "bg-amber-500" : "bg-red-500";
          return (
            <div key={g.id}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-gray-800">{groupTitle(g, locale)}</span>
                <span className="text-xs text-gray-500">
                  {g.points}/{g.max}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-gray-100">
                <div className={`h-full rounded ${bar}`} style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {(audit.gates?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{c.gatesTitle}</p>
          <ul className="mt-1 space-y-1" data-testid="readiness-gates">
            {audit.gates!.map((g) => (
              <li key={g.id} className="text-sm text-red-700">
                {gateLine(g, locale)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {audit.confidence === "low" && <p className="text-sm text-amber-700">{c.lowConfidence}</p>}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{c.topFixesTitle}</p>
        {fixes.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">{c.noFixes}</p>
        ) : (
          <ol className="mt-1 space-y-2" data-testid="readiness-fixes">
            {fixes.map((f, i) => (
              <li key={f.id} className="text-sm text-gray-800">
                <span className="font-medium">
                  {i + 1}. {f.title}
                </span>{" "}
                {f.recover > 0 && <span className="text-xs text-emerald-700">({c.recover(f.recover)})</span>}
                <p className="text-xs text-gray-600">{f.fix}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">
          {c.allChecks}
        </summary>
        <ul className="mt-2 divide-y divide-gray-100">
          {audit.checks.map((ch) => {
            const known = ch.id ? c.checks[ch.id] : undefined;
            const informational = ch.scored === false;
            return (
              <li key={ch.id ?? ch.category} className="flex items-baseline justify-between gap-3 py-1.5" data-scored={informational ? "false" : undefined}>
                <span className="text-gray-700">
                  {known?.title || ch.category}
                  {known?.note && <span className="block text-xs text-gray-500">{known.note}</span>}
                </span>
                <span className="shrink-0 text-right text-xs text-gray-500">
                  {ch.ran === false ? c.notRun : informational ? c.notScored : `${ch.points}/${ch.max}`}
                </span>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
