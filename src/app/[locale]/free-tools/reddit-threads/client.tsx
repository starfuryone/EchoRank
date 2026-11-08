"use client";

// The Reddit Threads Finder's form and result: keyword, country, an optional
// time filter, Turnstile; then up to ten threads (title, subreddit, Google's
// snippet, position, date when Google shows one), each opening on reddit.com
// in a new tab; then the CSV behind an email. Nothing is fetched from
// reddit.com by us — the links are plain links.
//
// Imports only dependency-free modules (copy, config, parse types).

import { useMemo, useState } from "react";
import { useTurnstile } from "@/components/turnstile/use-turnstile";
import { REDDIT_COPY, redditLocale, type RedditErrorCode } from "@/lib/reddit-threads/copy";
import { DEFAULT_COUNTRY, MAX_KEYWORD_LENGTH, REDDIT_COUNTRIES, TIME_FILTERS, type TimeFilter } from "@/lib/reddit-threads/config";
import type { RedditThread } from "@/lib/reddit-threads/parse";
import s from "../../home2.module.css";
import f from "../_shared/free-tools.module.css";

const API = "/api/free/v1/reddit-threads";

interface SearchView {
  keyword: string;
  countryCode: number;
  time: TimeFilter;
  threads: RedditThread[];
  forumsBlock: boolean;
}

export function RedditThreadsFinder({ locale, siteKey }: { locale: string; siteKey?: string }) {
  const base = redditLocale(locale);
  const c = REDDIT_COPY[base];
  const { box, token: challenge, reset } = useTurnstile(siteKey);
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState<number>(DEFAULT_COUNTRY);
  const [time, setTime] = useState<TimeFilter>("any");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<SearchView | null>(null);

  const regions = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([base], { type: "region" });
    } catch {
      names = null;
    }
    return REDDIT_COUNTRIES.map((x) => ({ code: x.code, label: names?.of(x.region) ?? x.region }));
  }, [base]);

  const message = (code: unknown) => c.errors[(typeof code === "string" && code in c.errors ? code : "generic") as RedditErrorCode];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!keyword.trim()) {
      setError(c.errors.invalid_keyword);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword, country, time, turnstileToken: challenge ?? undefined, locale }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.threads)) {
        setError(data?.error ?? message(data?.code));
        reset();
        return;
      }
      setView(data as SearchView);
    } catch {
      setError(c.errors.generic);
      reset();
    } finally {
      setBusy(false);
    }
  };

  if (view) {
    return (
      <Result
        view={view}
        locale={locale}
        onAgain={() => {
          setView(null);
          reset();
        }}
      />
    );
  }

  return (
    <form className={f.panel} onSubmit={submit} data-testid="reddit-form" noValidate>
      <label className={f.label} htmlFor="reddit-keyword">
        {c.form.keywordLabel}
      </label>
      <input
        id="reddit-keyword"
        className={f.input}
        required
        maxLength={MAX_KEYWORD_LENGTH}
        placeholder={c.form.keywordPlaceholder}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <div className={f.row} style={{ marginTop: 14, gap: 12, flexWrap: "wrap" }}>
        <label className={f.label} style={{ display: "grid", gap: 6 }}>
          {c.form.countryLabel}
          <select className={f.input} value={country} onChange={(e) => setCountry(Number(e.target.value))}>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className={f.label} style={{ display: "grid", gap: 6 }}>
          {c.form.timeLabel}
          <select className={f.input} value={time} onChange={(e) => setTime(e.target.value as TimeFilter)}>
            {TIME_FILTERS.map((t) => (
              <option key={t} value={t}>
                {c.form.time[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {siteKey && <div ref={box} style={{ marginTop: 14 }} />}
      <div style={{ marginTop: 16 }}>
        <button className={`${s.btn} ${s.btnPrimary}`} type="submit" disabled={busy || !keyword.trim() || Boolean(siteKey && !challenge)}>
          {busy ? c.form.searching : c.form.submit}
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

function Result({ view, locale, onAgain }: { view: SearchView; locale: string; onAgain: () => void }) {
  const c = REDDIT_COPY[redditLocale(locale)];
  return (
    <div className={f.panel} data-testid="reddit-result">
      <h2 className={f.resultH}>{c.result.heading(view.threads.length, view.keyword)}</h2>
      {view.threads.length === 0 ? (
        <p className={f.note}>{c.result.none}</p>
      ) : (
        <ol className={f.results} data-testid="reddit-threads">
          {view.threads.map((t) => (
            <li key={t.url} className={f.result}>
              <a className={f.resultLink} href={t.url} target="_blank" rel="noopener noreferrer nofollow">
                {t.title}
                <span className={f.srOnly}> {c.result.opens}</span>
              </a>
              <p className={f.resultMeta}>
                {[t.subreddit, t.position !== null ? `${c.result.position} ${t.position}` : c.result.forums, t.date].filter(Boolean).join(" · ")}
              </p>
              {t.snippet && <p className={f.snippet}>{t.snippet}</p>}
            </li>
          ))}
        </ol>
      )}
      <p className={f.note} data-testid="reddit-ai-line">
        {c.aiLine}
      </p>
      {view.threads.length > 0 && <CsvGate view={view} locale={locale} />}
      <button className={s.btn} type="button" onClick={onAgain} style={{ marginTop: 12 }}>
        {c.result.again}
      </button>
    </div>
  );
}

function CsvGate({ view, locale }: { view: SearchView; locale: string }) {
  const c = REDDIT_COPY[redditLocale(locale)];
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API}/csv`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, consent, keyword: view.keyword, country: view.countryCode, time: view.time, locale }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? c.errors.generic);
        return;
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "reddit-threads.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(c.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={download} data-testid="reddit-csv-gate" style={{ marginTop: 18 }} noValidate>
      <h3 className={f.resultH} style={{ fontSize: 16 }}>
        {c.gate.title}
      </h3>
      <p className={f.note}>{c.gate.body}</p>
      <label className={f.label} htmlFor="reddit-email">
        {c.gate.emailLabel}
      </label>
      <input id="reddit-email" className={f.input} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className={f.note} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        {c.gate.consent}
      </label>
      <button className={`${s.btn} ${s.btnPrimary}`} type="submit" disabled={busy || !email.trim()} style={{ marginTop: 12 }}>
        {busy ? c.gate.working : c.gate.submit}
      </button>
      {error && (
        <p className={f.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
