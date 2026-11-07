"use client";

// The Website Authority Checker's form and result. One component: the form,
// then the free result (score, links, the AI audit card), then the email gate,
// then — once unlocked — the top referring domains, the comparison and the
// PDF. The result's token rides in ?r= so a reload or a shared link reopens
// it (GET, free); the unlock is per browser (an HttpOnly cookie).
//
// Imports only dependency-free modules (copy, config, domains, types).

import { useEffect, useState } from "react";
import { useTurnstile } from "@/components/turnstile/use-turnstile";
import { AUTHORITY_COPY, authorityLocale, type AuthorityErrorCode } from "@/lib/authority-checker/copy";
import { AUTHORITY_SRC, MAX_COMPETITORS } from "@/lib/authority-checker/config";
import { normalizeCheck } from "@/lib/authority-checker/domains";
import type { CheckView } from "@/lib/authority-checker/types";
import s from "../../home2.module.css";
import f from "../_shared/free-tools.module.css";
import a from "./authority.module.css";

const API = "/api/free/v1/authority-checker";
type UnlockView = CheckView & { notice?: "budget" | "upstream" | null };

export function AuthorityChecker({ locale, siteKey }: { locale: string; siteKey?: string }) {
  const c = AUTHORITY_COPY[authorityLocale(locale)];
  const { box, token: challenge, reset } = useTurnstile(siteKey);
  const [domain, setDomain] = useState("");
  const [competitors, setCompetitors] = useState<string[]>(Array(MAX_COMPETITORS).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<UnlockView | null>(null);

  // Reopen a result from ?r=<token> (a reload, or a shared link).
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("r");
    if (!r) return;
    fetch(`${API}/${encodeURIComponent(r)}?locale=${encodeURIComponent(locale)}`, { credentials: "same-origin" })
      .then((res) => (res.ok ? (res.json() as Promise<CheckView>) : null))
      .then((v) => {
        if (v) setView(v);
      })
      .catch(() => {});
  }, [locale]);

  const message = (code: unknown) => c.errors[(typeof code === "string" && code in c.errors ? code : "generic") as AuthorityErrorCode];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = normalizeCheck({ domain, competitors });
    if (!input.ok) {
      setError(c.errors[input.error]);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain, competitors, turnstileToken: challenge ?? undefined, locale }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.token) {
        setError(data?.error ?? message(data?.code));
        reset();
        return;
      }
      setView(data as CheckView);
      window.history.replaceState(null, "", `?r=${data.token}`);
    } catch {
      setError(c.errors.generic);
      reset();
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    setView(null);
    setError(null);
    reset();
    window.history.replaceState(null, "", window.location.pathname);
  };

  if (view) return <Result view={view} locale={locale} onUnlocked={setView} onAgain={again} />;

  return (
    <form className={f.panel} onSubmit={submit} data-testid="authority-form" noValidate>
      <label className={f.label} htmlFor="authority-domain">
        {c.form.domainLabel}
      </label>
      <input
        id="authority-domain"
        className={f.input}
        inputMode="url"
        autoComplete="url"
        required
        maxLength={300}
        placeholder={c.form.domainPlaceholder}
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
      />
      <p className={f.label} style={{ marginTop: 16 }} id="authority-competitors">
        {c.form.competitorsLabel}
      </p>
      <div className={a.competitors} role="group" aria-labelledby="authority-competitors">
        {competitors.map((value, i) => (
          <input
            key={i}
            className={f.input}
            inputMode="url"
            maxLength={300}
            aria-label={`${c.form.competitorsLabel} ${i + 1}`}
            placeholder={c.form.competitorPlaceholder(i + 1)}
            value={value}
            onChange={(e) => setCompetitors((cur) => cur.map((v, j) => (j === i ? e.target.value : v)))}
          />
        ))}
      </div>
      {siteKey && <div ref={box} style={{ marginTop: 14 }} />}
      <div style={{ marginTop: 16 }}>
        <button className={`${s.btn} ${s.btnPrimary}`} type="submit" disabled={busy || !domain.trim() || Boolean(siteKey && !challenge)}>
          {busy ? c.form.checking : c.form.submit}
        </button>
      </div>
      {error && (
        <p className={f.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function Result({
  view,
  locale,
  onUnlocked,
  onAgain,
}: {
  view: UnlockView;
  locale: string;
  onUnlocked: (v: UnlockView) => void;
  onAgain: () => void;
}) {
  const c = AUTHORITY_COPY[authorityLocale(locale)];
  const nf = new Intl.NumberFormat(locale);
  const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(view.createdAt));

  return (
    <div className={a.result} data-testid="authority-result">
      <div className={a.scoreCard}>
        <div className={a.score} aria-label={`${c.result.scoreLabel}: ${view.authority ?? c.result.noRank}`}>
          {view.authority ?? "—"}
          <span className={a.scoreDen}>{c.result.outOf}</span>
        </div>
        <div>
          <p className={a.scoreDomain}>{view.domain}</p>
          <p className={a.scoreLabel}>{view.authority === null ? c.result.noRank : c.result.scoreLabel}</p>
          <p className={a.scoreSource}>{c.result.scoreSource}</p>
        </div>
      </div>

      <div className={a.tiles}>
        <div className={a.tile}>
          <div className={a.tileV}>{nf.format(view.links.referringDomains)}</div>
          <div className={a.tileL}>{c.result.referringDomains}</div>
        </div>
        <div className={a.tile}>
          <div className={a.tileV}>{nf.format(view.links.backlinks)}</div>
          <div className={a.tileL}>{c.result.backlinks}</div>
        </div>
        <div className={a.tile} title={c.result.dofollowHint}>
          <div className={a.tileV}>{pct(view.links.dofollowShare)}</div>
          <div className={a.tileL}>{c.result.dofollowShare}</div>
        </div>
      </div>
      <p className={f.note} style={{ margin: 0 }}>
        {c.result.checkedOn(date)} {c.result.dofollowHint}
      </p>

      <div className={a.ai}>
        <h3>{c.result.aiTitle}</h3>
        <p>{c.result.aiBody}</p>
        <a className={a.link} href={`/${locale}/free-audit?src=${AUTHORITY_SRC}`}>
          {c.result.aiCta} →
        </a>
      </div>

      {view.unlocked ? <Full view={view} locale={locale} onUnlocked={onUnlocked} /> : <Gate view={view} locale={locale} onUnlocked={onUnlocked} />}

      <div className={a.actions}>
        <button type="button" className={s.btn} onClick={onAgain}>
          {c.result.again}
        </button>
      </div>
    </div>
  );
}

function useUnlock(view: CheckView, locale: string, onUnlocked: (v: UnlockView) => void) {
  const c = AUTHORITY_COPY[authorityLocale(locale)];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlock = async (email: string, consent: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/${view.token}/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, consent, locale }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? c.errors.generic);
        return;
      }
      onUnlocked(data as UnlockView);
    } catch {
      setError(c.errors.generic);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, unlock };
}

function Gate({ view, locale, onUnlocked }: { view: CheckView; locale: string; onUnlocked: (v: UnlockView) => void }) {
  const c = AUTHORITY_COPY[authorityLocale(locale)];
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const { busy, error, unlock } = useUnlock(view, locale, onUnlocked);
  return (
    <form
      className={a.gate}
      data-testid="authority-gate"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          sessionStorage.setItem("er-authority-email", email);
        } catch {}
        void unlock(email, consent);
      }}
    >
      <h3>{c.gate.title}</h3>
      <p>{c.gate.body(view.competitors.length)}</p>
      <label className={f.label} htmlFor="authority-email">
        {c.gate.emailLabel}
      </label>
      <input
        id="authority-email"
        className={f.input}
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label className={a.consent}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{c.gate.consent}</span>
      </label>
      <div style={{ marginTop: 14 }}>
        <button className={`${s.btn} ${s.btnPrimary}`} type="submit" disabled={busy || !email.trim()}>
          {busy ? c.gate.sending : c.gate.submit}
        </button>
      </div>
      <p className={f.note}>{c.gate.privacy}</p>
      {error && (
        <p className={f.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function Full({ view, locale, onUnlocked }: { view: UnlockView; locale: string; onUnlocked: (v: UnlockView) => void }) {
  const c = AUTHORITY_COPY[authorityLocale(locale)];
  const nf = new Intl.NumberFormat(locale);
  const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
  const { busy, error, unlock } = useUnlock(view, locale, onUnlocked);

  if (!view.full) {
    const retry = () => {
      let email = "";
      try {
        email = sessionStorage.getItem("er-authority-email") ?? "";
      } catch {}
      void unlock(email, false);
    };
    return (
      <div className={a.gate} data-testid="authority-pending">
        <p>{view.notice === "upstream" ? c.errors.upstream : c.full.pending}</p>
        <button type="button" className={s.btn} onClick={retry} disabled={busy}>
          {c.full.retry}
        </button>
        {error && (
          <p className={f.error} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-testid="authority-full">
      <h3 className={a.h3}>{c.full.compTitle}</h3>
      {view.full.comparison.length > 1 ? (
        <div className={a.tableWrap}>
          <table className={a.table}>
            <thead>
              <tr>
                <th>{c.full.colDomain}</th>
                <th className={a.num}>{c.full.colAuthority}</th>
                <th className={a.num}>{c.full.colReferring}</th>
                <th className={a.num}>{c.full.colBacklinks}</th>
                <th className={a.num}>{c.full.colDofollow}</th>
              </tr>
            </thead>
            <tbody>
              {view.full.comparison.map((row) => (
                <tr key={row.domain}>
                  <td>
                    {row.domain}
                    {row.domain === view.domain && <span className={a.you}>{c.full.you}</span>}
                  </td>
                  <td className={a.num}>{row.authority ?? "—"}</td>
                  <td className={a.num}>{nf.format(row.referringDomains)}</td>
                  <td className={a.num}>{nf.format(row.backlinks)}</td>
                  <td className={a.num}>{pct(row.dofollowShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={f.note}>{c.full.compNone}</p>
      )}

      <h3 className={a.h3} style={{ marginTop: 22 }}>
        {c.full.refTitle}
      </h3>
      {view.full.referringDomains.length > 0 ? (
        <div className={a.tableWrap}>
          <table className={a.table}>
            <thead>
              <tr>
                <th>{c.full.colDomain}</th>
                <th className={a.num}>{c.full.colAuthority}</th>
                <th className={a.num}>{c.full.colBacklinks}</th>
              </tr>
            </thead>
            <tbody>
              {view.full.referringDomains.map((row) => (
                <tr key={row.domain}>
                  <td>{row.domain}</td>
                  <td className={a.num}>{row.authority ?? "—"}</td>
                  <td className={a.num}>{nf.format(row.backlinks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={f.note}>{c.full.refEmpty}</p>
      )}

      <div className={a.actions} style={{ marginTop: 18 }}>
        <a className={`${s.btn} ${s.btnPrimary}`} href={`${API}/${view.token}/pdf?locale=${encodeURIComponent(locale)}`} download>
          {c.full.pdf}
        </a>
      </div>
    </div>
  );
}
