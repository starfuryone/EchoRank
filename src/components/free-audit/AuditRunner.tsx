"use client";

// The free AI Readiness Audit's form and run (ECHORANK-AI-VISIBILITY-PAGES.md
// Phase 2): one run label, the audit's stages while it runs, then the result
// (FreeAuditResult). Posts to /api/av/audit, the same endpoint as before.
//
// THE STAGES ARE THE AUDIT'S REAL STEPS, PACED BY TIME. The sidecar answers in
// one response, so this lists what it does in the order it does it (homepage,
// robots.txt, render, checks, score) and moves the marker on a typical
// schedule; it never claims a step finished that the response has not.
//
// States: site unreachable (friendly, no allowance used), invalid address,
// rate-limited (with the time the next run is possible, from the API), and
// errors. A bot challenge is not an error: it is a result, with its gate and
// its fix.

import { useEffect, useState } from "react";
import { AUDIT_COPY, auditBaseOf } from "@/lib/free-audit/copy";
import type { AuditJson } from "@/lib/free-audit/view";
import { FreeAuditResult, type ResultExtras, type ResultFacts } from "./FreeAuditResult";
import f from "./free-audit.module.css";

type State =
  | { k: "idle" }
  | { k: "running"; step: number }
  | { k: "error"; message: string }
  | { k: "done"; audit: AuditJson; extras: ResultExtras };

/** Seconds into a run at which each stage starts (the typical audit is 20–40 s). */
const STEP_AT = [0, 3, 7, 14, 24];

export function AuditRunner({ facts }: { facts: ResultFacts }) {
  const c = AUDIT_COPY[auditBaseOf(facts.locale)];
  const [domain, setDomain] = useState("");
  const [state, setState] = useState<State>({ k: "idle" });

  const running = state.k === "running";
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const t = setInterval(() => {
      const s = (Date.now() - started) / 1000;
      const step = STEP_AT.filter((at) => s >= at).length - 1;
      setState((cur) => (cur.k === "running" && cur.step !== step ? { k: "running", step } : cur));
    }, 500);
    return () => clearInterval(t);
  }, [running]);

  function when(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(facts.locale.startsWith("fr") ? "fr-CA" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const b = domain.trim();
    if (!b) return;
    setState({ k: "running", step: 0 });
    try {
      const res = await fetch("/api/av/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand: b }) });
      const data = (await res.json().catch(() => null)) as (AuditJson & { error?: string; retryAt?: string | null }) | null;
      if (res.status === 429) {
        setState({ k: "error", message: c.errors.rateLimited(when(data?.retryAt), facts.perDay, facts.hours) });
        return;
      }
      if (res.status === 400) {
        setState({ k: "error", message: c.errors.invalid });
        return;
      }
      if (res.status === 422 && data?.error === "unreachable") {
        setState({ k: "error", message: c.errors.unreachable });
        return;
      }
      if (!res.ok || !data || typeof data.score !== "number") {
        setState({ k: "error", message: c.errors.generic });
        return;
      }
      setState({
        k: "done",
        audit: data,
        extras: {
          resultId: typeof data.resultId === "string" ? data.resultId : null,
          benchmark: (data.benchmark as ResultExtras["benchmark"]) ?? null,
          emailAllowed: data.emailAllowed === true,
        },
      });
    } catch {
      setState({ k: "error", message: c.errors.generic });
    }
  }

  if (state.k === "done") {
    return <FreeAuditResult audit={state.audit} facts={facts} extras={state.extras} onAgain={() => setState({ k: "idle" })} />;
  }

  return (
    <div>
      <form className={f.form} onSubmit={run} noValidate data-testid="audit-form">
        <label htmlFor="audit-domain" className={f.formLabel}>
          {c.form.label}
        </label>
        <div className={f.row}>
          <input
            id="audit-domain"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder={c.form.placeholder}
            value={domain}
            maxLength={120}
            onChange={(e) => setDomain(e.target.value)}
            disabled={running}
          />
          <button type="submit" className={`${f.linkBtn} ${f.primary}`} disabled={running || !domain.trim()} data-testid="audit-run">
            {c.form.run}
          </button>
        </div>
        {state.k === "error" && (
          <p className={f.err} role="alert" data-testid="audit-error">
            {state.message}
          </p>
        )}
        <p className={f.fine}>{c.form.fine(facts.perDay, facts.hours)}</p>
      </form>

      {running && (
        <div className={f.steps} aria-live="polite" data-testid="audit-steps">
          <b>{c.steps.title}</b>
          <ol>
            {c.steps.items.map((label, i) => (
              <li key={label} className={i === state.step ? f.stepOn : i < state.step ? f.stepDone : undefined} aria-current={i === state.step ? "step" : undefined}>
                {label}
              </li>
            ))}
          </ol>
          <p className={f.fine}>{c.steps.note}</p>
        </div>
      )}
    </div>
  );
}
