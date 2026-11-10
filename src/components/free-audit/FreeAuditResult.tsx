"use client";

// The free AI Readiness Audit's result (ECHORANK-AI-VISIBILITY-PAGES.md
// Phase 2), top to bottom: score card (score, grade, "Capped at N: reason",
// a one-sentence verdict), the benchmark when there is one, the top 3 fixes
// (why, fix, effort, a copyable snippet where it helps), the AI crawler table,
// every check by group, the bridge to the free AI Visibility Check, the upsell
// built from this result, and "keep the result" (PDF, 7-day link, email).
//
// Rendered by the audit runner after a run AND by the permalink page from the
// stored result: one component, so the two cannot drift.
//
// EVERYTHING FROM THE AUDITED SITE IS TEXT. React escapes it; snippets are
// built as plain strings (src/lib/free-audit/view.ts) and shown in <pre>.
// Nothing here uses dangerouslySetInnerHTML.

import { useEffect, useState } from "react";
import { READINESS_COPY, fixLines, gateLine, groupTitle, readinessLocale } from "@/lib/i18n/readiness";
import { AUDIT_COPY, EFFORT, auditBaseOf } from "@/lib/free-audit/copy";
import {
  checkState,
  cloudflareDetected,
  crawlerRows,
  gatesOf,
  groupsOf,
  hostOf,
  orgSnippet,
  robotsSnippet,
  snippetKindFor,
  topFixesOf,
  verdictBand,
  type AuditJson,
} from "@/lib/free-audit/view";
import f from "./free-audit.module.css";

export interface ResultFacts {
  /** The page's locale, for links. */
  locale: string;
  perDay: number;
  hours: number;
  resultDays: number;
  av: { price: string; prompts: number; engines: string; cadence: string; href: string };
  linkAuthority: { price: string; href: string };
  nosyBat: { pages: string; name: string; href: string };
  checkHref: string;
  siteUrl: string;
}

export interface ResultExtras {
  resultId: string | null;
  benchmark: { higherThanPct: number; n: number } | null;
  emailAllowed: boolean;
}

function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={f.copyBtn}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* the text is selectable in the box */
        }
      }}
    >
      {copied ? done : label}
    </button>
  );
}

function KeepResult({ audit, facts, extras }: { audit: AuditJson; facts: ResultFacts; extras: ResultExtras }) {
  const c = AUDIT_COPY[auditBaseOf(facts.locale)].result.keep;
  const [pdf, setPdf] = useState<"idle" | "busy" | "err">("idle");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [mail, setMail] = useState<{ k: "idle" } | { k: "busy" } | { k: "sent" } | { k: "err"; code: keyof typeof c.emailErr }>({ k: "idle" });
  const link = extras.resultId ? `${facts.siteUrl}/${auditBaseOf(facts.locale)}/free-audit/r/${extras.resultId}` : null;

  async function downloadPdf() {
    setPdf("busy");
    try {
      const res = await fetch("/api/av/audit/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(audit) });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const m = /filename="?([^"]+)"?/.exec(res.headers.get("content-disposition") ?? "");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = m ? m[1] : "Echorank-AI-Readiness-Audit.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setPdf("idle");
    } catch {
      setPdf("err");
    }
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!extras.resultId) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMail({ k: "err", code: "invalid" });
      return;
    }
    setMail({ k: "busy" });
    try {
      const res = await fetch("/api/av/audit/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: extras.resultId, email: email.trim(), marketingConsent: consent, locale: facts.locale }),
      });
      if (res.ok) {
        setMail({ k: "sent" });
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      const code = data?.error && data.error in c.emailErr ? (data.error as keyof typeof c.emailErr) : "generic";
      setMail({ k: "err", code });
    } catch {
      setMail({ k: "err", code: "generic" });
    }
  }

  return (
    <section className={f.card} data-testid="audit-keep">
      <h2>{c.title}</h2>
      <div className={f.ctaRow}>
        <button type="button" className={f.linkBtn} onClick={downloadPdf} disabled={pdf === "busy"} data-testid="audit-pdf">
          {pdf === "busy" ? c.pdfBusy : c.pdf}
        </button>
      </div>
      {pdf === "err" && <p className={f.err}>{c.pdfErr}</p>}

      {link ? (
        <div style={{ marginTop: 14 }}>
          <p className={f.muted} style={{ margin: 0 }}>{c.permalink(facts.resultDays)}</p>
          <div className={f.permalink} data-testid="audit-permalink">
            <code>{link}</code>
            <CopyButton text={link} label={c.copyLink} done={c.linkCopied} />
          </div>
        </div>
      ) : (
        <p className={f.muted}>{c.noPermalink}</p>
      )}

      {/* Optional, never a gate: the PDF above does not depend on it. Offered only
          with a stored result and outside blocked countries. */}
      {link && extras.emailAllowed && (
        <form className={f.emailForm} onSubmit={sendEmail} noValidate data-testid="audit-email">
          <label htmlFor="audit-email" className={f.formLabel} style={{ margin: 0 }}>
            {c.emailLabel}
          </label>
          <div className={f.row}>
            <input
              id="audit-email"
              type="email"
              autoComplete="email"
              placeholder={c.emailPh}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mail.k === "busy" || mail.k === "sent"}
            />
            <button type="submit" className={f.linkBtn} disabled={mail.k === "busy" || mail.k === "sent" || !email.trim()}>
              {mail.k === "busy" ? c.emailBusy : c.emailSend}
            </button>
          </div>
          <label className={f.consent}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="audit-consent" />
            <span>{c.consent}</span>
          </label>
          {mail.k === "sent" && <p className={f.ok}>{c.emailSent}</p>}
          {mail.k === "err" && <p className={f.err}>{c.emailErr[mail.code]}</p>}
        </form>
      )}
    </section>
  );
}

export function FreeAuditResult({
  audit,
  facts,
  extras,
  onAgain,
}: {
  audit: AuditJson;
  facts: ResultFacts;
  extras: ResultExtras;
  onAgain?: () => void;
}) {
  const base = auditBaseOf(facts.locale);
  const c = AUDIT_COPY[base].result;
  // The page is en or fr (auditBaseOf); the check titles and fixes follow it.
  const rl = readinessLocale(base);
  const rc = READINESS_COPY[rl];
  const score = typeof audit.score === "number" ? Math.round(audit.score) : 0;
  const grade = typeof audit.grade === "string" ? audit.grade : "";
  const gates = gatesOf(audit);
  const host = hostOf(audit);
  const fixes = topFixesOf(audit);
  const lines = fixLines(fixes, rl);
  const rows = crawlerRows(audit);
  const groups = groupsOf(audit);

  // All checks: collapsed on a phone, open on a wider screen.
  const [checksOpen, setChecksOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of the viewport after mount
    if (window.matchMedia?.("(min-width: 641px)").matches) setChecksOpen(true);
  }, []);

  return (
    <div className={f.result} data-testid="audit-result">
      <section className={f.card} data-testid="audit-score">
        <div className={f.score}>
          <span className={f.scoreNum}>{score}</span>
          <span className={f.scoreOf}>/ 100</span>
          {grade && <span className={f.grade}>{grade}</span>}
        </div>
        <p className={f.host}>
          {rc.label} · {host}
        </p>
        {gates.map((g) => (
          <p key={g.id} className={f.cap} data-testid="audit-gate">
            {gateLine(g, rl)}
          </p>
        ))}
        {audit.confidence === "low" && <p className={f.muted}>{rc.lowConfidence}</p>}
        <p className={f.verdict}>{c.verdict[verdictBand(score, gates.length > 0)]}</p>
        {extras.benchmark && (
          <p className={f.benchmark} data-testid="audit-benchmark">
            {c.benchmark(extras.benchmark.higherThanPct)}
          </p>
        )}
      </section>

      {lines.length > 0 && (
        <section className={f.card} data-testid="audit-fixes">
          <h2>{c.topFixesTitle}</h2>
          <ol className={f.fixes}>
            {lines.map((line, i) => {
              const id = fixes[i].id;
              const kind = snippetKindFor(id);
              const snippet = kind === "robots" ? robotsSnippet() : kind === "org" ? orgSnippet(audit) : null;
              const effort = EFFORT[id];
              return (
                <li key={id} className={f.fix} data-fix={id}>
                  <div className={f.fixHead}>
                    <h3 style={{ margin: 0 }}>
                      {i + 1}. {line.title}
                    </h3>
                    {line.recover > 0 && <span className={f.recover}>{c.recover(line.recover)}</span>}
                    {effort && (
                      <span className={f.tag} data-testid="audit-effort">
                        {c.effortLabel}: {c.effort[effort]}
                      </span>
                    )}
                  </div>
                  {c.whyById[id] && (
                    <p className={f.kv}>
                      <b>{c.why}:</b> {c.whyById[id]}
                    </p>
                  )}
                  {line.fix && (
                    <p className={f.kv}>
                      <b>{c.fix}:</b> {line.fix}
                    </p>
                  )}
                  {snippet && kind && (
                    <div className={f.snippet} data-testid="audit-snippet" data-kind={kind}>
                      <div className={f.snippetHead}>
                        <span>{kind === "robots" ? c.snippet.robots : c.snippet.org}</span>
                        <CopyButton text={snippet} label={c.snippet.copy} done={c.snippet.copied} />
                      </div>
                      <pre>{snippet}</pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className={f.card} data-testid="audit-crawlers">
        <h2>{c.crawlers.title}</h2>
        <p className={f.muted}>{c.crawlers.lead}</p>
        <table className={f.table}>
          <thead>
            <tr>
              <th scope="col">{c.crawlers.cols.bot}</th>
              <th scope="col">{c.crawlers.cols.status}</th>
              <th scope="col">{c.crawlers.cols.rule}</th>
              <th scope="col">{c.crawlers.cols.meaning}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bot} data-bot={r.bot} data-status={r.status}>
                <td data-label={c.crawlers.cols.bot}>
                  <b>{r.bot}</b>
                </td>
                <td data-label={c.crawlers.cols.status} className={f[`st_${r.status}`]}>
                  {c.crawlers.status[r.status]}
                </td>
                <td data-label={c.crawlers.cols.rule}>{r.rule ? <code>{r.rule}</code> : <span className={f.muted}>{c.crawlers.noRule}</span>}</td>
                <td data-label={c.crawlers.cols.meaning}>{c.crawlers.meaning(r.bot, r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {cloudflareDetected(audit) && (
          <p className={f.kv} data-testid="audit-cloudflare">
            {c.crawlers.cloudflare}
          </p>
        )}
      </section>

      <section className={f.card} data-testid="audit-checks">
        <details className={f.details} open={checksOpen} onToggle={(e) => setChecksOpen((e.target as HTMLDetailsElement).open)}>
          <summary>{c.checks.title}</summary>
          {groups.map((g) => (
            <div key={g.id} className={f.group} data-group={g.id}>
              {g.title && (
                <div className={f.groupHead}>
                  <span>{groupTitle({ id: g.id, title: g.title, points: g.points, max: g.max }, rl)}</span>
                  <span>{c.checks.group(g.points, g.max)}</span>
                </div>
              )}
              <ul className={f.checkList}>
                {g.checks.map((ch) => {
                  const st = checkState(ch);
                  const title = (ch.id && rc.checks[ch.id]?.title) || ch.category;
                  return (
                    <li key={ch.id ?? ch.category} data-check={ch.id} data-state={st}>
                      <span>{title}</span>
                      <span>
                        {st === "not_scored" ? rc.notScored : st === "not_assessable" ? c.checks.state.not_assessable : `${ch.points} / ${ch.max} · ${c.checks.state[st]}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </details>
      </section>

      <section className={f.card} data-testid="audit-bridge">
        <p style={{ margin: 0 }}>{c.bridge.text}</p>
        <div className={f.ctaRow}>
          <a className={f.linkBtn} href={`${facts.checkHref}?domain=${encodeURIComponent(host)}`} data-testid="audit-bridge-link">
            {c.bridge.cta}
          </a>
        </div>
      </section>

      <section className={f.card} data-testid="audit-upsell">
        <h2>{c.upsell.title}</h2>
        <p className={f.muted} style={{ margin: 0 }}>
          {c.upsell.allowance(facts.av.prompts, facts.av.engines, facts.av.cadence)}
        </p>
        <p className={f.kv}>{c.upsell.body}</p>
        <div className={f.ctaRow}>
          <a className={`${f.linkBtn} ${f.primary}`} href={facts.av.href} data-testid="audit-upsell-cta">
            {c.upsell.cta(facts.av.price)}
          </a>
        </div>
        <ul className={f.lines}>
          <li>
            <a href={facts.linkAuthority.href}>{c.upsell.linkAuthority(facts.linkAuthority.price)}</a>
          </li>
          <li>
            <a href={facts.nosyBat.href}>{c.upsell.nosyBat(facts.nosyBat.pages, facts.nosyBat.name)}</a>
          </li>
        </ul>
      </section>

      <KeepResult audit={audit} facts={facts} extras={extras} />

      {onAgain && (
        <button type="button" className={f.again} onClick={onAgain}>
          {c.again}
        </button>
      )}
    </div>
  );
}
