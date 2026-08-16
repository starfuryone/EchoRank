"use client";

// SEO Content Optimizer — runs entirely here. There is no fetch in this file
// and no API route behind it: the draft never leaves the browser, which is both
// the privacy claim the copy makes and the reason the tool costs nothing.

import { useEffect, useMemo, useState } from "react";
import {
  CHECK_META,
  GRADE_COLOR,
  GRADE_LABEL,
  STATUS_ICON,
  STATUS_WORD,
  gradeOf,
  orderChecks,
  scoreContent,
  type CheckStatus,
  type ContentCheck,
} from "@/lib/free-tools/content-score";
import f from "../_shared/free-tools.module.css";

const STATUS_CLASS: Record<CheckStatus, string> = {
  pass: f.pass!,
  warn: f.warn!,
  fail: f.fail!,
};

const ICON_CLASS: Record<CheckStatus, string> = {
  pass: f.iconPass!,
  warn: f.iconWarn!,
  fail: f.iconFail!,
};

/** How long the visitor stops typing before the draft is re-graded. */
const DEBOUNCE_MS = 400;

/**
 * The 0–100 score as a ring.
 *
 * Built like the homepage AI Visibility ring — an SVG circle driven by
 * stroke-dashoffset, rotated -90deg by CSS so the arc starts at the top. The
 * radius and stroke are smaller because this sits inside a tool panel rather
 * than a hero.
 */
function ScoreRing({ score }: { score: number }) {
  const R = 44;
  const CIRC = 2 * Math.PI * R;
  const color = GRADE_COLOR[gradeOf(score)];

  return (
    <div className={f.scoreRing}>
      <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true" focusable="false">
        <circle cx="52" cy="52" r={R} fill="none" stroke="var(--line, #232330)" strokeWidth="8" />
        <circle
          cx="52"
          cy="52"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - score / 100)}
        />
      </svg>
      <div className={f.scoreRingVal}>
        <span className={f.scoreRingNum} style={{ color }}>{score}</span>
        <span className={f.scoreRingDen}>/ 100</span>
      </div>
    </div>
  );
}

/**
 * One check.
 *
 * A warn or a fail is a <details> so its fix is one click away; a pass is a
 * plain div. Both put the same .checkRow inside the same .check shell, so the
 * two render at identical heights — which is what keeps the list from jumping
 * when a status flips mid-sentence.
 */
function CheckRow({ check }: { check: ContentCheck }) {
  const meta = CHECK_META[check.id];
  const expandable = check.status !== "pass";

  const line = (
    <>
      <span className={`${f.checkIcon} ${ICON_CLASS[check.status]}`} aria-hidden="true">
        {STATUS_ICON[check.status]}
      </span>
      <span className={f.srOnly}>{STATUS_WORD[check.status]}:</span>
      <span className={f.checkName}>{meta?.label ?? check.id}</span>
      <span className={f.checkValue}>
        {check.value}
        {meta?.target && <span className={f.checkTarget}> · {meta.target}</span>}
      </span>
      {expandable && <span className={f.checkFix}>Fix</span>}
    </>
  );

  if (!expandable) {
    return (
      <div className={`${f.check} ${STATUS_CLASS[check.status]}`}>
        <div className={f.checkRow}>{line}</div>
      </div>
    );
  }

  return (
    <details className={`${f.check} ${STATUS_CLASS[check.status]}`}>
      <summary className={f.checkRow}>{line}</summary>
      <p className={f.checkHint}>{meta?.hint}</p>
    </details>
  );
}

export function ContentOptimizerClient() {
  const [text, setText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState("");

  // Grading is pure arithmetic and cheap, but re-rendering nine rows that
  // REORDER themselves on every keystroke is not — the list would shuffle
  // under the cursor mid-word. Settling for 400ms first means the visitor sees
  // one considered result rather than nine transient ones.
  const [draft, setDraft] = useState({ text: "", keyword: "", title: "", meta: "" });
  useEffect(() => {
    const id = setTimeout(() => setDraft({ text, keyword, title, meta }), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text, keyword, title, meta]);

  const report = useMemo(
    () =>
      draft.text.trim()
        ? scoreContent({
            text: draft.text,
            keyword: draft.keyword,
            title: draft.title,
            metaDescription: draft.meta,
          })
        : null,
    [draft],
  );

  const passing = report?.checks.filter((c) => c.status === "pass").length ?? 0;

  return (
    <div className={f.panel}>
      <div className={f.row}>
        <div className={f.grow}>
          <label className={f.label} htmlFor="co-keyword">Target keyword</label>
          <input
            id="co-keyword"
            className={f.input}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="running shoes"
          />
        </div>
        <div className={f.grow}>
          <label className={f.label} htmlFor="co-title">Title tag (optional)</label>
          <input
            id="co-title"
            className={f.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Best running shoes for beginners"
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label className={f.label} htmlFor="co-meta">Meta description (optional)</label>
        <input
          id="co-meta"
          className={f.input}
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
          placeholder="A short summary of the page…"
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label className={f.label} htmlFor="co-text">Your draft</label>
        <textarea
          id="co-text"
          className={f.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your draft here. Use # for headings."
        />
      </div>

      {report && (
        <div style={{ marginTop: 24 }}>
          <div className={f.scoreRow}>
            <ScoreRing score={report.score} />
            <div>
              <p className={f.gradeLabel} style={{ color: GRADE_COLOR[gradeOf(report.score)] }}>
                {GRADE_LABEL[gradeOf(report.score)]}
              </p>
              <p className={f.checkCount}>
                {passing} of {report.checks.length} checks passing
              </p>
              <span className={f.resultMeta}>
                {report.wordCount} words · {report.density}% density · readability {report.readability}
              </span>
            </div>
          </div>

          <div className={f.checks}>
            {orderChecks(report.checks).map((check) => (
              <CheckRow check={check} key={check.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
