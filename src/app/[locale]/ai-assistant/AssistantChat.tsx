"use client";

/**
 * The anonymous assistant's chat surface.
 *
 * MARKETING THEME. Every colour here reads a token defined on `.page` in
 * home2.module.css (--bg #181A20, --surface #1E2329, --gold #FCD535). No literal
 * palette values, and nothing from the authenticated dashboard's light theme —
 * the two design systems stay apart, and this component only ever renders inside
 * the dark marketing shell.
 *
 * COPY COMES FROM THE SERVER. Like AuditWidget, this component is locale-
 * agnostic: the page passes plain strings, because the server→client boundary
 * cannot carry functions and the marketing pages fold five locales onto two
 * written catalogues.
 *
 * THE FINDINGS ARE NOT WRITTEN BY THE MODEL. `scan` comes back from the API as
 * structured, deterministic output of the heuristic layer and is rendered as
 * data. The model's prose sits beside it. If the model is having a bad day the
 * facts on screen are still the facts.
 */

import { useCallback, useRef, useState } from "react";

export interface AssistantFinding {
  id: string;
  severity: "critical" | "warning" | "ok";
  title: string;
  evidence: string;
  fix?: string;
}

export interface AssistantScan {
  domain: string;
  score: number;
  grade: string;
  findings: AssistantFinding[];
  counts: { critical: number; warning: number; ok: number };
}

export interface AssistantChatContent {
  scanLabel: string;
  scanPlaceholder: string;
  scanIdle: string;
  scanBusy: string;
  askLabel: string;
  askPlaceholder: string;
  askIdle: string;
  askBusy: string;
  intro: string;
  suggestions: string[];
  you: string;
  assistant: string;
  scoreLabel: string;
  gradeLabel: string;
  criticalLabel: string;
  warningLabel: string;
  okLabel: string;
  fixLabel: string;
  /** "{n} messages left today" — contains "{n}". */
  remainingTemplate: string;
  errGeneric: string;
  errNetwork: string;
  disabled: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  /** Locale-prefixed pricing. House rule: marketing CTAs go to /pricing. */
  ctaHref: string;
  fine: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  /** Deterministic findings attached to this answer, when there were any. */
  scan?: AssistantScan | null;
}

type Status = "idle" | "sending";

const SEVERITY_CLASS: Record<AssistantFinding["severity"], string> = {
  critical: "ai-sev-critical",
  warning: "ai-sev-warning",
  ok: "ai-sev-ok",
};

export function AssistantChat({
  c,
  locale,
  enabled,
}: {
  c: AssistantChatContent;
  locale: string;
  enabled: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const send = useCallback(
    async (text: string, scanDomain?: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === "sending") return;

      setStatus("sending");
      setError("");
      // The history sent up is the transcript BEFORE this turn; the server does
      // not persist anything, so the browser is the only place it lives.
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setQuestion("");

      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // same-origin: the endpoint is origin-checked, so a cross-origin
          // caller is refused before it reaches the route.
          credentials: "same-origin",
          body: JSON.stringify({
            message: trimmed,
            history,
            locale,
            ...(scanDomain ? { domain: scanDomain } : {}),
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setError((data && typeof data.error === "string" && data.error) || c.errGeneric);
          setStatus("idle");
          return;
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: String(data.answer ?? ""), scan: data.scan ?? null },
        ]);
        if (data.remaining && typeof data.remaining.chat === "number") {
          setRemaining(data.remaining.chat);
        }
      } catch {
        setError(c.errNetwork);
      } finally {
        setStatus("idle");
        // Scroll after the answer lands, not before — otherwise the reader is
        // moved away from the question they just asked.
        requestAnimationFrame(() => {
          logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
        });
      }
    },
    [c.errGeneric, c.errNetwork, locale, messages, status],
  );

  const runScan = useCallback(() => {
    const d = domain.trim();
    if (!d) return;
    void send(`Scan ${d} and tell me what is stopping AI assistants from recommending it.`, d);
    setDomain("");
  }, [domain, send]);

  if (!enabled) {
    return (
      <div className="ai-panel">
        <p className="ai-disabled">{c.disabled}</p>
      </div>
    );
  }

  const busy = status === "sending";

  return (
    <div className="ai-panel">
      {/* The scan box: the one action that fetches somebody's website. */}
      <label className="ai-label" htmlFor="ai-domain">
        {c.scanLabel}
      </label>
      <div className="ai-row">
        <input
          id="ai-domain"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder={c.scanPlaceholder}
          value={domain}
          disabled={busy}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runScan();
            }
          }}
        />
        <button type="button" className="ai-btn ai-btn-gold" disabled={busy || !domain.trim()} onClick={runScan}>
          {busy ? c.scanBusy : c.scanIdle}
        </button>
      </div>

      <div className="ai-log" ref={logRef} aria-live="polite">
        {messages.length === 0 && <p className="ai-intro">{c.intro}</p>}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ai-msg ai-msg-user" : "ai-msg"}>
            <span className="ai-who">{m.role === "user" ? c.you : c.assistant}</span>
            {m.content.split("\n").filter(Boolean).map((para, j) => (
              <p key={j} className="ai-text">
                {para}
              </p>
            ))}
            {m.scan && <ScanCard scan={m.scan} c={c} />}
          </div>
        ))}

        {busy && <p className="ai-intro">{c.askBusy}</p>}
      </div>

      {messages.length === 0 && (
        <div className="ai-chips">
          {c.suggestions.map((q) => (
            <button key={q} type="button" className="ai-chip" disabled={busy} onClick={() => void send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <label className="ai-label" htmlFor="ai-question">
        {c.askLabel}
      </label>
      <div className="ai-row">
        <input
          id="ai-question"
          type="text"
          placeholder={c.askPlaceholder}
          value={question}
          disabled={busy}
          maxLength={1200}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void send(question);
            }
          }}
        />
        <button
          type="button"
          className="ai-btn ai-btn-gold"
          disabled={busy || !question.trim()}
          onClick={() => void send(question)}
        >
          {busy ? c.askBusy : c.askIdle}
        </button>
      </div>

      {error && <p className="ai-err">{error}</p>}
      {remaining !== null && (
        <p className="ai-fine">{c.remainingTemplate.replace("{n}", String(remaining))}</p>
      )}
      <p className="ai-fine">{c.fine}</p>

      {messages.length > 0 && (
        <div className="ai-cta">
          <span className="ai-cta-title">{c.ctaTitle}</span>
          <span className="ai-text">{c.ctaBody}</span>
          <a className="ai-btn ai-btn-gold ai-btn-block" href={c.ctaHref}>
            {c.ctaButton}
          </a>
        </div>
      )}
    </div>
  );
}

/** The deterministic half of an answer. Rendered as data, never as prose. */
function ScanCard({ scan, c }: { scan: AssistantScan; c: AssistantChatContent }) {
  return (
    <div className="ai-scan">
      <div className="ai-scan-head">
        <span className="ai-scan-domain">{scan.domain}</span>
        <span className="ai-scan-score">
          <b>{scan.score}</b>
          <span>/100 {c.scoreLabel}</span>
        </span>
        <span className="ai-scan-grade">
          {c.gradeLabel} {scan.grade}
        </span>
      </div>
      <p className="ai-scan-counts">
        {scan.counts.critical} {c.criticalLabel} · {scan.counts.warning} {c.warningLabel} ·{" "}
        {scan.counts.ok} {c.okLabel}
      </p>
      <ul className="ai-findings">
        {scan.findings
          .filter((f) => f.severity !== "ok")
          .map((f) => (
            <li key={f.id} className={SEVERITY_CLASS[f.severity]}>
              <span className="ai-finding-title">{f.title}</span>
              <span className="ai-finding-body">{f.evidence}</span>
              {f.fix && (
                <span className="ai-finding-fix">
                  {c.fixLabel} {f.fix}
                </span>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}
