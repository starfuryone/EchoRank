"use client";

// SEO Content Optimizer — runs entirely here. There is no fetch in this file
// and no API route behind it: the draft never leaves the browser, which is both
// the privacy claim the copy makes and the reason the tool costs nothing.

import { useMemo, useState } from "react";
import { scoreContent, type CheckStatus } from "@/lib/free-tools/content-score";
import f from "../_shared/free-tools.module.css";

const CHECK_LABELS: Record<string, string> = {
  word_count: "Word count",
  keyword_in_title: "Keyword in title",
  keyword_in_h1: "Keyword in first heading",
  keyword_first_100: "Keyword in first 100 words",
  keyword_density: "Keyword density",
  heading_structure: "Heading structure",
  readability: "Readability (Flesch)",
  question_coverage: "Questions answered",
  meta_length: "Meta description length",
};

const STATUS_CLASS: Record<CheckStatus, string> = {
  pass: f.pass!,
  warn: f.warn!,
  fail: f.fail!,
};

export function ContentOptimizerClient() {
  const [text, setText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState("");

  // Recomputed on every keystroke — it is pure arithmetic over a few thousand
  // words, which is far cheaper than the debounce it would take to avoid.
  const report = useMemo(
    () => (text.trim() ? scoreContent({ text, keyword, title, metaDescription: meta }) : null),
    [text, keyword, title, meta],
  );

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
            <span className={f.scoreBig}>{report.score}</span>
            <span className={f.resultMeta}>
              {report.wordCount} words · {report.density}% density · readability {report.readability}
            </span>
          </div>

          <div className={f.checks}>
            {report.checks.map((check) => (
              <div className={`${f.check} ${STATUS_CLASS[check.status]}`} key={check.id}>
                <span>{CHECK_LABELS[check.id] ?? check.id}</span>
                <span className={f.checkValue}>{check.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
