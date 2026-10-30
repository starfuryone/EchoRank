// components/AuditWidget.tsx
'use client';

import { useState } from 'react';

// WHAT THE FREE AUDIT ACTUALLY MEASURES. /api/av/audit proxies the sidecar's
// audit_site(): a crawler-readability check (robots, JSON-LD, llms.txt,
// rendering...) whose `score` is points out of 100. It asks NO AI engine
// anything — the route fills `mentionRate: 0` and `engines: []` as constants,
// and `trustScore` falls back to `score`. So the teaser prints `score` as
// "AI readability", and prints a mention count ONLY if real engine results
// ever arrive; until then the line says it was not tested. It used to read
// "appeared in 0% of tested queries" for every brand, about queries never run.
type AuditResult = {
  brand: string;
  score?: number;             // 0–100, crawler readability (sum of checks[].points)
  engines: { name: string; mentioned: boolean }[];
  sampleAnswer?: string;      // short excerpt of one AI answer
  trustScore?: number;        // legacy alias; equals `score` today
};

type Status = 'idle' | 'running' | 'done' | 'error';

/**
 * Translated copy for the widget. Passed in from the (server) page so this
 * client component stays locale-agnostic — mirrors how RegisterForm receives
 * its strings. Everything here must be serializable (plain strings): the
 * server→client boundary can't carry functions, so the two interpolated
 * strings use a `{brand}` placeholder that's substituted at render time.
 */
export interface AuditWidgetContent {
  label: string;
  placeholder: string;
  runIdle: string;
  runBusy: string;
  noteTemplate: string;   // contains "{brand}"
  errLimit: string;
  errGeneric: string;
  fine: string;
  mentionLabel: string;
  /** Contains "{hits}" and "{total}". Used only when engines were really asked. */
  mentionValue: string;
  mentionNotTested: string;
  mentionGloss: string;
  readabilityLabel: string;
  readabilityGloss: string;
  upsell: string;
  ctaTemplate: string;    // contains "{brand}"
  /**
   * Where the post-result CTA goes. Locale-prefixed pricing, per the house
   * rule that a marketing CTA lands on /pricing and never on /register — the
   * visitor picks a plan before they are asked for an account. Passed in for
   * the same reason the copy is: this component never sees the locale.
   */
  ctaHref: string;
  again: string;
  pdfIdle: string;
  pdfBusy: string;
  pdfErr: string;
  pdfRetry: string;
}

type PdfStatus = 'idle' | 'loading' | 'error';

export function AuditWidget({ c }: { c: AuditWidgetContent }) {
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<AuditResult | null>(null);
  // The raw audit JSON (score, checks[], robots…) the API returned — this is
  // what the PDF route renders. `result` is only a typed view of a few fields.
  const [auditJson, setAuditJson] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [pdf, setPdf] = useState<PdfStatus>('idle');
  const readability = result ? result.score ?? result.trustScore : undefined;

  async function runAudit() {
    const b = brand.trim();
    if (!b) return;
    setStatus('running');
    setError('');
    setPdf('idle');
    try {
      const res = await fetch('/api/av/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: b }),
      });
      if (res.status === 429) {
        setError(c.errLimit);
        setStatus('error');
        return;
      }
      if (!res.ok) throw new Error(`audit failed: ${res.status}`);
      const json = (await res.json()) as Record<string, unknown>;
      setAuditJson(json);
      setResult(json as unknown as AuditResult);
      setStatus('done');
    } catch {
      setError(c.errGeneric);
      setStatus('error');
    }
  }

  async function downloadPdf() {
    if (!auditJson || pdf === 'loading') return;
    setPdf('loading');
    try {
      const res = await fetch('/api/av/audit/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditJson),
      });
      if (!res.ok) throw new Error(`report failed: ${res.status}`);
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const m = /filename="?([^"]+)"?/.exec(cd);
      const name = m ? m[1] : 'Echorank-360-AI-Visibility-Report.pdf';
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      setPdf('idle');
    } catch {
      setPdf('error');
    }
  }

  return (
    <div className="av-audit">
      {status !== 'done' && (
        <>
          <label htmlFor="av-brand" className="av-audit-label">
            {c.label}
          </label>
          <div className="av-audit-row">
            <input
              id="av-brand"
              type="text"
              placeholder={c.placeholder}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runAudit()}
              disabled={status === 'running'}
            />
            <button
              className="av-btn av-btn-gold"
              onClick={runAudit}
              disabled={status === 'running' || !brand.trim()}
            >
              {status === 'running' ? c.runBusy : c.runIdle}
            </button>
          </div>
          {status === 'running' && (
            <p className="av-audit-note">
              {c.noteTemplate.replace('{brand}', brand.trim())}
            </p>
          )}
          {status === 'error' && <p className="av-audit-err">{error}</p>}
          <p className="av-audit-fine">{c.fine}</p>
        </>
      )}

      {status === 'done' && result && (
        <div className="av-audit-result">
          <p className="av-audit-headline">
            <strong>{result.brand}</strong>
          </p>
          <p className="av-audit-line">
            <span className="av-audit-line-k">{c.mentionLabel}:</span>{' '}
            {result.engines.length > 0 ? (
              <span className="av-gold">
                {c.mentionValue
                  .replace('{hits}', String(result.engines.filter((e) => e.mentioned).length))
                  .replace('{total}', String(result.engines.length))}
              </span>
            ) : (
              <span className="av-audit-line-na">{c.mentionNotTested}</span>
            )}
            <span className="av-audit-gloss">{c.mentionGloss}</span>
          </p>
          {typeof readability === 'number' && (
            <p className="av-audit-line">
              <span className="av-audit-line-k">{c.readabilityLabel}:</span>{' '}
              <span className="av-gold">{readability}/100</span>
              <span className="av-audit-gloss">{c.readabilityGloss}</span>
            </p>
          )}
          <ul className="av-audit-engines">
            {result.engines.map((e) => (
              <li key={e.name} className={e.mentioned ? 'av-hit' : 'av-miss'}>
                {e.mentioned ? '✓' : '✗'} {e.name}
              </li>
            ))}
          </ul>
          {result.sampleAnswer && (
            <blockquote className="av-audit-sample">{result.sampleAnswer}</blockquote>
          )}
          <p className="av-audit-upsell">{c.upsell}</p>
          <a className="av-btn av-btn-gold av-btn-block" href={c.ctaHref}>
            {c.ctaTemplate.replace('{brand}', result.brand)}
          </a>
          <button
            type="button"
            className="av-btn av-btn-ghost av-btn-block"
            onClick={downloadPdf}
            disabled={pdf === 'loading'}
          >
            {pdf === 'loading' ? c.pdfBusy : c.pdfIdle}
          </button>
          {pdf === 'error' && (
            <p className="av-audit-err">
              {c.pdfErr}{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); downloadPdf(); }}>
                {c.pdfRetry}
              </a>
            </p>
          )}
          <a className="av-audit-again" href="#" onClick={(e) => { e.preventDefault(); setStatus('idle'); setResult(null); setAuditJson(null); setPdf('idle'); }}>
            {c.again}
          </a>
        </div>
      )}
    </div>
  );
}
