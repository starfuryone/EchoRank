// components/AuditWidget.tsx
'use client';

import { useState } from 'react';

type AuditResult = {
  brand: string;
  mentionRate: number;        // 0–100, % of test prompts where brand appeared
  engines: { name: string; mentioned: boolean }[];
  sampleAnswer?: string;      // short excerpt of one AI answer
  trustScore?: number;        // 0–100
};

type Status = 'idle' | 'running' | 'done' | 'error';

export function AuditWidget() {
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState('');

  async function runAudit() {
    const b = brand.trim();
    if (!b) return;
    setStatus('running');
    setError('');
    try {
      const res = await fetch('/api/av/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: b }),
      });
      if (res.status === 429) {
        setError('Free audit limit reached for today. Sign up to run unlimited audits.');
        setStatus('error');
        return;
      }
      if (!res.ok) throw new Error(`audit failed: ${res.status}`);
      setResult((await res.json()) as AuditResult);
      setStatus('done');
    } catch {
      setError('The audit could not run. Try again in a minute.');
      setStatus('error');
    }
  }

  return (
    <div className="av-audit">
      {status !== 'done' && (
        <>
          <label htmlFor="av-brand" className="av-audit-label">
            Run a free basic audit
          </label>
          <div className="av-audit-row">
            <input
              id="av-brand"
              type="text"
              placeholder="Your brand or domain, e.g. acme.com"
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
              {status === 'running' ? 'Auditing…' : 'Run free audit'}
            </button>
          </div>
          {status === 'running' && (
            <p className="av-audit-note">
              Asking the AIs about “{brand.trim()}” — takes ~20 seconds.
            </p>
          )}
          {status === 'error' && <p className="av-audit-err">{error}</p>}
          <p className="av-audit-fine">No account needed. One audit per day.</p>
        </>
      )}

      {status === 'done' && result && (
        <div className="av-audit-result">
          <p className="av-audit-headline">
            <strong>{result.brand}</strong> appeared in{' '}
            <span className="av-gold">{result.mentionRate}%</span> of test
            prompts
            {typeof result.trustScore === 'number' && (
              <> · Trust Score <span className="av-gold">{result.trustScore}</span></>
            )}
          </p>
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
          <p className="av-audit-upsell">
            This was 3 generic prompts, one engine pass. The full plan tracks
            25 prompts of your choosing, weekly, with alerts when you drop out.
          </p>
          <a
            className="av-btn av-btn-gold av-btn-block"
            href={`/register?plan=ai_visibility&brand=${encodeURIComponent(result.brand)}`}
          >
            Track {result.brand} — $29/mo
          </a>
          <a className="av-audit-again" href="#" onClick={(e) => { e.preventDefault(); setStatus('idle'); setResult(null); }}>
            Run another audit
          </a>
        </div>
      )}
    </div>
  );
}
