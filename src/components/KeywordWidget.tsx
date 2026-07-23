// components/KeywordWidget.tsx
'use client';

import { useState } from 'react';

interface KeywordItem {
  kw: string;
  score: number;
  difficulty: 'low' | 'medium' | 'high';
  source: string;
}

interface KeywordResult {
  url: string;
  seed_keywords: KeywordItem[];
  seed_total: number;
  question_keywords: KeywordItem[];
  question_total: number;
  ai_visibility_prompts: string[];
  prompt_total: number;
  technical_summary: { pass: number; warn: number; fail: number };
}

type Status = 'idle' | 'running' | 'done' | 'error';

/**
 * Translated copy, passed in from the (server) landing page — same pattern as
 * AuditWidget. Plain strings only; "{n}" placeholders substituted at render.
 */
export interface KeywordWidgetContent {
  label: string;
  placeholder: string;
  runIdle: string;
  runBusy: string;
  note: string;
  errLimit: string;
  errGeneric: string;
  fine: string;
  seedsTitle: string;
  questionsTitle: string;
  promptsTitle: string;
  techTitle: string;
  techSummaryTemplate: string; // contains {pass} {warn} {fail}
  diffLow: string;
  diffMedium: string;
  diffHigh: string;
  lockedTemplate: string; // contains {n}
  upsell: string;
  cta: string;
  again: string;
}

const DIFF_CLASS: Record<string, string> = {
  low: 'av-kw-diff-low',
  medium: 'av-kw-diff-med',
  high: 'av-kw-diff-high',
};

export function KeywordWidget({ c }: { c: KeywordWidgetContent }) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [error, setError] = useState('');

  async function runScan() {
    const u = url.trim();
    if (!u) return;
    setStatus('running');
    setError('');
    try {
      const res = await fetch('/api/av/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      });
      if (res.status === 429) {
        setError(c.errLimit);
        setStatus('error');
        return;
      }
      if (!res.ok) throw new Error(`scan failed: ${res.status}`);
      setResult((await res.json()) as KeywordResult);
      setStatus('done');
    } catch {
      setError(c.errGeneric);
      setStatus('error');
    }
  }

  function diffLabel(d: string): string {
    return d === 'low' ? c.diffLow : d === 'medium' ? c.diffMedium : c.diffHigh;
  }

  const lockedSeeds = result ? Math.max(0, result.seed_total - result.seed_keywords.length) : 0;
  const lockedQuestions = result
    ? Math.max(0, result.question_total - result.question_keywords.length)
    : 0;
  const lockedPrompts = result
    ? Math.max(0, result.prompt_total - result.ai_visibility_prompts.length)
    : 0;

  return (
    <div className="av-kw">
      {status !== 'done' && (
        <>
          <label htmlFor="av-kw-url" className="av-kw-label">
            {c.label}
          </label>
          <div className="av-kw-row">
            <input
              id="av-kw-url"
              type="text"
              placeholder={c.placeholder}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runScan()}
              disabled={status === 'running'}
            />
            <button
              className="av-btn av-btn-gold"
              onClick={runScan}
              disabled={status === 'running' || !url.trim()}
            >
              {status === 'running' ? c.runBusy : c.runIdle}
            </button>
          </div>
          {status === 'running' && <p className="av-kw-note">{c.note}</p>}
          {status === 'error' && <p className="av-kw-err">{error}</p>}
          <p className="av-kw-fine">{c.fine}</p>
        </>
      )}

      {status === 'done' && result && (
        <div className="av-kw-result">
          <h3 className="av-kw-h">{c.seedsTitle}</h3>
          <ul className="av-kw-list">
            {result.seed_keywords.map((k) => (
              <li key={k.kw}>
                <span>{k.kw}</span>
                <span className={`av-kw-diff ${DIFF_CLASS[k.difficulty] ?? ''}`}>
                  {diffLabel(k.difficulty)}
                </span>
              </li>
            ))}
            {lockedSeeds > 0 && (
              <li className="av-kw-locked" aria-hidden="true">
                <span className="av-kw-blur">keyword suggestion locked example</span>
                <span className="av-kw-lock">
                  🔒 {c.lockedTemplate.replace('{n}', String(lockedSeeds))}
                </span>
              </li>
            )}
          </ul>

          <h3 className="av-kw-h">{c.questionsTitle}</h3>
          <ul className="av-kw-list">
            {result.question_keywords.map((k) => (
              <li key={k.kw}>
                <span>{k.kw}</span>
              </li>
            ))}
            {lockedQuestions > 0 && (
              <li className="av-kw-locked" aria-hidden="true">
                <span className="av-kw-blur">how to choose the right example</span>
                <span className="av-kw-lock">
                  🔒 {c.lockedTemplate.replace('{n}', String(lockedQuestions))}
                </span>
              </li>
            )}
          </ul>

          <h3 className="av-kw-h">{c.promptsTitle}</h3>
          <ul className="av-kw-list">
            {result.ai_visibility_prompts.map((p) => (
              <li key={p}>
                <span>“{p}”</span>
              </li>
            ))}
            {lockedPrompts > 0 && (
              <li className="av-kw-locked" aria-hidden="true">
                <span className="av-kw-blur">best example tool for teams</span>
                <span className="av-kw-lock">
                  🔒 {c.lockedTemplate.replace('{n}', String(lockedPrompts))}
                </span>
              </li>
            )}
          </ul>

          <h3 className="av-kw-h">{c.techTitle}</h3>
          <p className="av-kw-tech">
            {c.techSummaryTemplate
              .replace('{pass}', String(result.technical_summary.pass))
              .replace('{warn}', String(result.technical_summary.warn))
              .replace('{fail}', String(result.technical_summary.fail))}
          </p>

          <p className="av-kw-upsell">{c.upsell}</p>
          <a
            className="av-btn av-btn-gold av-btn-block"
            href="/register?plan=ai_visibility"
          >
            {c.cta}
          </a>
          <a
            className="av-kw-again"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setStatus('idle');
              setResult(null);
            }}
          >
            {c.again}
          </a>
        </div>
      )}
    </div>
  );
}
