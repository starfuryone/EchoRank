"use client";

// SERP Volatility. A GET of pre-computed data — no form, no limit, no spend.
// Bars are plain divs: a proportional bar is a div with a width, and recharts
// (which is in the dashboard bundle) would be a charting runtime on a marketing
// page to draw one.

import { useEffect, useState } from "react";
import f from "../_shared/free-tools.module.css";

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

/** 0–10 onto a bar width. */
const pct = (v: number) => Math.max(2, Math.min(100, Math.round((v / 10) * 100)));

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

  return (
    <div className={f.panel}>
      <div className={f.scoreRow}>
        <span className={f.scoreBig}>{latest.overall ?? "—"}</span>
        <span className={f.resultMeta}>out of 10 · {latest.date}</span>
      </div>

      <div className={f.bars}>
        {Object.entries(latest.categories).map(([category, score]) => (
          <div className={f.bar} key={category}>
            <span className={f.barLabel}>{CATEGORY_LABELS[category] ?? category}</span>
            <span className={f.barTrack}>
              <span className={f.barFill} style={{ width: `${score === null ? 0 : pct(score)}%` }} />
            </span>
            <span className={f.barValue}>{score === null ? "—" : score}</span>
          </div>
        ))}
      </div>

      {data.days.length > 1 && (
        <>
          <p className={f.note} style={{ marginTop: 22 }}>Last {data.days.length} days</p>
          <div className={f.bars} style={{ marginTop: 8 }}>
            {data.days.slice(-14).map((day) => (
              <div className={f.bar} key={day.date}>
                <span className={f.barLabel}>{day.date.slice(5)}</span>
                <span className={f.barTrack}>
                  <span
                    className={f.barFill}
                    style={{ width: `${day.overall === null ? 0 : pct(day.overall)}%` }}
                  />
                </span>
                <span className={f.barValue}>{day.overall ?? "—"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
