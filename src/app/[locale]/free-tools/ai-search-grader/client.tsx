"use client";

// AI Search Grader. One POST to the sidecar-backed route; a letter and the
// three biggest gaps.

import { useState } from "react";
import f from "../_shared/free-tools.module.css";

interface Grade {
  url: string;
  grade: string;
  score: number;
  engines: { name: string; allowed: boolean }[];
  topGaps: { label: string; lost: number; detail: string; fix: string }[];
}

export function AiSearchGraderClient() {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function grade(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/free/v1/ai-search-grader", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Try again.");
        setResult(null);
        return;
      }
      setResult(data);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={f.panel}>
      <form onSubmit={grade} className={f.row}>
        <div className={f.grow}>
          <label className={f.label} htmlFor="ag-domain">Your domain</label>
          <input
            id="ag-domain"
            className={f.input}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
          />
        </div>
        <button className={f.deviceTab} type="submit" disabled={busy || domain.trim().length < 3}>
          {busy ? "Grading…" : "Grade my site"}
        </button>
      </form>

      {error && <p className={f.error}>{error}</p>}

      {result && (
        <div style={{ marginTop: 24 }}>
          <div className={f.scoreRow}>
            <span className={f.scoreBig}>{result.grade}</span>
            <span className={f.resultMeta}>{result.score} / 100 · {result.url}</span>
          </div>

          <div className={f.bars} style={{ marginBottom: 20 }}>
            {result.engines.map((engine) => (
              <div className={f.bar} key={engine.name}>
                <span className={f.barLabel}>{engine.name}</span>
                <span className={f.resultMeta}>{engine.allowed ? "allowed" : "blocked"}</span>
              </div>
            ))}
          </div>

          {result.topGaps.length > 0 && (
            <div className={f.results}>
              {result.topGaps.map((gap) => (
                <div className={f.result} key={gap.label}>
                  <p className={f.resultH}>{gap.label}</p>
                  <p className={f.resultMeta}>{gap.detail}</p>
                  {gap.fix && <p className={f.faqA} style={{ marginTop: 6 }}>{gap.fix}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
