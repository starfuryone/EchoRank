"use client";

// The free AI Visibility Check widget: form → progress → preview → email gate
// → full report. The run id is kept in ?run= so a reload resumes the poll;
// it is NOT a key to the full report (see GET /api/free/v1/snapshot/<id>).

import { useEffect, useRef, useState } from "react";
import type { SnapshotCopy } from "@/lib/snapshot/copy";
import type { SnapshotPreview, SnapshotReport } from "@/lib/snapshot/types";
import { ShareLink, SnapshotFullView, SnapshotPreviewView, SnapshotUpsell } from "./SnapshotReportView";
import { useTurnstile } from "@/components/turnstile/use-turnstile";
import st from "./snapshot.module.css";

const API = "/api/free/v1/snapshot";
const POLL_MS = 2500;

type Phase =
  | { k: "form" }
  | { k: "running"; id: string; status: string }
  | { k: "preview"; id: string; preview: SnapshotPreview; cached: boolean }
  | { k: "full"; id: string; report: SnapshotReport; token: string; expiresAt: string | null };

export function SnapshotCheck({
  c,
  locale,
  turnstileSiteKey,
}: {
  c: SnapshotCopy;
  locale: string;
  turnstileSiteKey?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ k: "form" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ brand: "", domain: "", city: "", category: "" });
  const touched = useRef<Set<string>>(new Set());
  const [prefilling, setPrefilling] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const { box, token, reset } = useTurnstile(turnstileSiteKey);
  const cachedRef = useRef(false);

  const errText = (code: string | undefined) => c.errors[code ?? "generic"] ?? c.errors.generic;

  const setRun = (id: string | null) => {
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("run", id);
    else u.searchParams.delete("run");
    window.history.replaceState(null, "", u.toString());
  };

  // Poll a run until it is done or failed.
  useEffect(() => {
    if (phase.k !== "running") return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`${API}/${phase.id}`, { cache: "no-store" });
        const data = await res.json();
        if (stop) return;
        if (!res.ok) {
          setError(errText(data.error));
          setPhase({ k: "form" });
          setRun(null);
          return;
        }
        if (data.status === "done" && data.preview) {
          setPhase({ k: "preview", id: phase.id, preview: data.preview, cached: cachedRef.current });
          return;
        }
        if (data.status === "failed") {
          setError(c.errors.failed);
          setPhase({ k: "form" });
          setRun(null);
          return;
        }
        setPhase((p) => (p.k === "running" && p.status !== data.status ? { ...p, status: data.status } : p));
      } catch {
        // A dropped poll is retried on the next tick.
      }
      if (!stop) timer = setTimeout(tick, POLL_MS);
    };
    let timer = setTimeout(tick, 600);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when the run changes
  }, [phase.k === "running" ? phase.id : null]);

  // Resume a run from ?run= after a reload.
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("run");
    if (id && /^[a-z0-9]{20,40}$/.test(id)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot resume from the URL
      setPhase({ k: "running", id, status: "queued" });
    }
  }, []);

  async function prefillFrom(domain: string) {
    if (!domain.includes(".")) return;
    setPrefilling(true);
    try {
      const res = await fetch(`${API}/prefill?domain=${encodeURIComponent(domain)}`);
      const d = await res.json();
      setF((cur) => ({
        ...cur,
        brand: !touched.current.has("brand") && !cur.brand && d.brand ? d.brand : cur.brand,
        category: !touched.current.has("category") && !cur.category && d.category ? d.category : cur.category,
        city: !touched.current.has("city") && !cur.city && d.location ? d.location : cur.city,
      }));
    } catch {
      // Prefill is a convenience; the form works without it.
    } finally {
      setPrefilling(false);
    }
  }

  // From the AI Readiness Audit's bridge (?domain=…): prefill the domain, then
  // brand and category from the same /prefill call a typed domain gets.
  // Nothing runs by itself; the check keeps its own daily limit and Turnstile.
  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    if (params.get("run")) return;
    const domain = (params.get("domain") ?? "").trim().toLowerCase();
    if (!/^[a-z0-9.-]{3,253}$/.test(domain) || !domain.includes(".")) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot prefill from the URL
    setF((cur) => (cur.domain ? cur : { ...cur, domain }));
    void prefillFrom(domain);
  }, []);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!f.brand.trim() || !f.domain.trim() || !f.category.trim()) {
      setError(c.errors.invalid_request);
      return;
    }
    if (turnstileSiteKey && !token) {
      setError(c.errors.turnstile);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, city: f.city || null, locale, turnstileToken: token ?? undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errText(d.error));
        return;
      }
      cachedRef.current = !!d.cached;
      setRun(d.id);
      setPhase({ k: "running", id: d.id, status: d.status });
    } catch {
      setError(c.errors.generic);
    } finally {
      setBusy(false);
      reset();
    }
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (phase.k !== "preview" || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API}/${phase.id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, locale }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errText(d.error));
        return;
      }
      // emailed:false = unlocked without storing the address (EU/EEA/UK), so nothing was sent.
      setSent(d.emailed !== false);
      setPhase({ k: "full", id: phase.id, report: d.report, token: d.token, expiresAt: d.expiresAt ?? null });
    } catch {
      setError(c.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  const again = () => {
    setRun(null);
    setPhase({ k: "form" });
    setSent(false);
    setError(null);
  };

  const field = (name: keyof typeof f, label: string, ph: string, opts: { wide?: boolean; hint?: string; required?: boolean } = {}) => (
    <div className={`${st.field} ${opts.wide ? st.fieldWide : ""}`}>
      <label htmlFor={`snap-${name}`}>{label}</label>
      <input
        id={`snap-${name}`}
        name={name}
        value={f[name]}
        placeholder={ph}
        required={opts.required}
        maxLength={name === "domain" ? 253 : 80}
        autoComplete={name === "domain" ? "url" : name === "brand" ? "organization" : "off"}
        onChange={(ev) => {
          touched.current.add(name);
          const v = ev.target.value;
          setF((cur) => ({ ...cur, [name]: v }));
        }}
        onBlur={name === "domain" ? (ev) => prefillFrom(ev.target.value.trim()) : undefined}
      />
      {opts.hint && <span className={st.hint}>{opts.hint}</span>}
    </div>
  );

  if (phase.k === "form") {
    return (
      <form className={st.form} onSubmit={start} noValidate data-testid="snapshot-form">
        {field("domain", c.form.domain, c.form.domainPh, { required: true })}
        {field("brand", c.form.brand, c.form.brandPh, { required: true })}
        {field("category", c.form.category, c.form.categoryPh, { required: true, hint: prefilling ? c.form.prefilling : c.form.categoryHint })}
        {field("city", c.form.city, c.form.cityPh)}
        <div className={st.actions}>
          {turnstileSiteKey && <div ref={box} />}
          <button className={st.btn} type="submit" disabled={busy}>
            {busy ? c.form.submitting : c.form.submit}
          </button>
          {error && (
            <p className={st.err} role="alert">
              {error}
            </p>
          )}
          <p className={st.fine}>{c.form.fine}</p>
        </div>
      </form>
    );
  }

  if (phase.k === "running") {
    return (
      <div className={st.card} aria-live="polite" data-testid="snapshot-running">
        <p className={st.cardTitle}>{phase.status === "running" ? c.progress.running : c.progress.queued}</p>
        <p className={st.note}>{c.progress.note}</p>
      </div>
    );
  }

  const shareUrl = phase.k === "full" ? `${window.location.origin}/${locale}/ai-visibility-check/r/${phase.token}` : "";

  return (
    <>
      <div className={st.card} data-testid={phase.k === "full" ? "snapshot-full" : "snapshot-preview"}>
        <p className={st.cardTitle}>{c.result.title}</p>
        {phase.k === "preview" ? (
          <>
            <SnapshotPreviewView p={phase.preview} c={c} cached={phase.cached} />
            <form className={st.gate} onSubmit={unlock} noValidate>
              <p className={st.cardTitle}>{c.gate.title}</p>
              <p className={st.muted}>{c.gate.body}</p>
              <div className={st.gateRow}>
                <input
                  type="email"
                  required
                  aria-label={c.gate.email}
                  placeholder={c.gate.email}
                  value={email}
                  autoComplete="email"
                  onChange={(ev) => setEmail(ev.target.value)}
                />
                <button className={st.btn} type="submit" disabled={busy}>
                  {busy ? c.gate.sending : c.gate.submit}
                </button>
              </div>
              <label className={st.consent}>
                <input type="checkbox" checked={consent} onChange={(ev) => setConsent(ev.target.checked)} />
                <span>{c.gate.consent}</span>
              </label>
              <p className={st.fine}>{c.gate.privacy}</p>
              {error && (
                <p className={st.err} role="alert">
                  {error}
                </p>
              )}
            </form>
          </>
        ) : (
          <>
            {sent && <p className={st.note}>{c.gate.sent}</p>}
            <SnapshotFullView r={phase.report} c={c} />
            <ShareLink url={shareUrl} expiresAt={phase.expiresAt} c={c} locale={locale} />
          </>
        )}
        <button type="button" className={st.again} onClick={again}>
          {c.again}
        </button>
      </div>
      <SnapshotUpsell c={c} locale={locale} snapshotId={phase.id} />
    </>
  );
}
