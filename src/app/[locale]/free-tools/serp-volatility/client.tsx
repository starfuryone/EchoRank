"use client";

// SERP Volatility. A GET of pre-computed data — no form, no limit, no spend.
// Bars are plain divs: a proportional bar is a div with a width, and recharts
// (which is in the dashboard bundle) would be a charting runtime on a marketing
// page to draw ten rectangles.
//
// The widths here have always been computed correctly. What made every bar look
// maxed out was .barFill being an inline <span>, which drops width — see the
// note on that rule in free-tools.module.css.

import { useEffect, useState } from "react";
import f from "../_shared/free-tools.module.css";
import {
  severityOf,
  widthPct,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  SEVERITY_SENTENCE,
  type Severity,
} from "@/lib/free-tools/volatility-severity";

interface Day {
  date: string;
  overall: number | null;
  categories: Record<string, number | null>;
}

interface Payload {
  collecting: boolean;
  days: Day[];
  latest: Day | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  ecommerce: "Ecommerce",
  local: "Local",
  finance: "Finance",
  health: "Health",
  tech: "Tech",
};

const CHIP_CLASS: Record<Severity, string> = {
  calm: f.chipCalm,
  elevated: f.chipElevated,
  high: f.chipHigh,
};

const FILL_CLASS: Record<Severity, string> = {
  calm: f.barCalm,
  elevated: f.barElevated,
  high: f.barHigh,
};

/** One labelled bar. Exported shape is deliberately dumb: value in, width out. */
function Bar({ label, score, title }: { label: string; score: number | null; title?: string }) {
  const severity = score === null ? null : severityOf(score);
  return (
    <div className={f.bar} title={title}>
      <span className={f.barLabel}>{label}</span>
      <span className={f.barTrack}>
        <span
          className={`${f.barFill} ${severity ? FILL_CLASS[severity] : ""}`}
          style={{ width: `${score === null ? 0 : widthPct(score)}%` }}
        />
      </span>
      <span className={f.barValue}>{score === null ? "—" : score}</span>
    </div>
  );
}

/**
 * Ten-day history as SVG columns.
 *
 * A viewBox with no fixed width so it scales to the column, and one <title> per
 * bar so hovering names the day and the score. The numeric rows stay rendered
 * underneath rather than being replaced: this component only ever runs after a
 * client fetch, so there is no no-JS rendering to protect, but there IS a
 * screen reader, and a bare <rect> says nothing to it.
 */
function History({ days }: { days: Day[] }) {
  const W = 100;
  const H = 46;
  const gap = 1.6;
  const colW = (W - gap * (days.length - 1)) / days.length;

  return (
    <svg
      className={f.chart}
      viewBox={`0 0 ${W} ${H + 8}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Overall volatility for the last ${days.length} days`}
    >
      {days.map((day, i) => {
        const x = i * (colW + gap);
        const value = day.overall;
        // Scale against the same 0–10 the bars use, so a column and a bar for
        // the same score are the same length. A floor keeps a near-zero day
        // visible as a mark rather than nothing.
        const h = value === null ? 0 : Math.max(1.2, (value / 10) * H);
        const severity = value === null ? null : severityOf(value);
        return (
          <g key={day.date} className={f.chartCol}>
            <title>{`${day.date}: ${value ?? "no data"}`}</title>
            <rect className={f.chartBase} x={x} y={0} width={colW} height={H} rx={1} />
            <rect
              x={x}
              y={H - h}
              width={colW}
              height={h}
              rx={1}
              fill={severity ? SEVERITY_COLOR[severity] : "transparent"}
            />
            <text className={f.chartAxis} x={x + colW / 2} y={H + 6} textAnchor="middle">
              {day.date.slice(8)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function SerpVolatilityClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/free/v1/serp-volatility");
        if (!res.ok) throw new Error("failed");
        const payload = (await res.json()) as Payload;
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <div className={f.panel}>
        <p className={f.error}>Could not load today&apos;s volatility. Try again shortly.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={f.panel}>
        <p className={f.note}>Loading…</p>
      </div>
    );
  }

  // Two consecutive days are needed before anything can be compared, and
  // "collecting" is a different statement from "nothing moved".
  if (data.collecting || !data.latest) {
    return (
      <div className={f.panel}>
        <p className={f.note}>
          Collecting data. We sample the basket once a day, so the first score appears after two
          consecutive days of samples.
        </p>
      </div>
    );
  }

  const latest = data.latest;
  const overall = latest.overall;
  const severity = overall === null ? null : severityOf(overall);

  // Yesterday is the second-to-last sampled day, which is not always the
  // calendar day before — a missed sample leaves a gap, and comparing against
  // "two days ago" is still the honest previous reading.
  const previous = data.days.length > 1 ? data.days[data.days.length - 2].overall : null;
  const delta = overall !== null && previous !== null ? Math.round((overall - previous) * 100) / 100 : null;
  const history = data.days.slice(-10);

  return (
    <div className={f.volGrid}>
      <div className={f.panel}>
        <div className={f.scoreRow}>
          <span className={f.scoreBig}>{overall ?? "—"}</span>
          <span>
            {severity && (
              <span className={`${f.chip} ${CHIP_CLASS[severity]}`}>{SEVERITY_LABEL[severity]}</span>
            )}{" "}
            {delta !== null && (
              <span
                className={`${f.delta} ${delta > 0 ? f.deltaUp : delta < 0 ? f.deltaDown : f.deltaFlat}`}
                title="Change vs the previous sampled day"
              >
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} {Math.abs(delta).toFixed(2)}
              </span>
            )}
            <br />
            <span className={f.resultMeta}>out of 10 · {latest.date}</span>
          </span>
        </div>

        {severity && <p className={f.reading}>{SEVERITY_SENTENCE[severity]}</p>}

        <p className={f.volPanelH} style={{ marginTop: 22 }}>
          By category
        </p>
        <div className={f.bars}>
          {Object.entries(latest.categories).map(([category, score]) => (
            <Bar
              key={category}
              label={CATEGORY_LABELS[category] ?? category}
              score={score}
              title={`${CATEGORY_LABELS[category] ?? category}: ${score ?? "no data"} out of 10`}
            />
          ))}
        </div>
      </div>

      {history.length > 1 && (
        <div className={f.panel}>
          <p className={f.volPanelH}>Last {history.length} days</p>
          <History days={history} />
          <div className={`${f.bars} ${f.chartFallback}`}>
            {history.map((day) => (
              <Bar
                key={day.date}
                label={day.date.slice(5)}
                score={day.overall}
                title={`${day.date}: ${day.overall ?? "no data"} out of 10`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
