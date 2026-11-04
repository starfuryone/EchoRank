"use client";

// The result page's interactive pieces: the progress view while the crawl is
// still queued or running (refreshes the page when it ends), the email gate
// that unlocks the full list for this browser, and the share button.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FREE_CRAWLER_COPY, freeBase } from "@/lib/site-crawler/free-copy";
import { FreeCrawlProgress } from "./progress";
import s from "../../home2.module.css";
import f from "../_shared/free-tools.module.css";

export function FreeResultProgress({ token, locale, reused }: { token: string; locale: string; reused?: boolean }) {
  const router = useRouter();
  return <FreeCrawlProgress token={token} locale={locale} reused={reused} onDone={() => router.refresh()} />;
}

export function FreeUnlockForm({ token, locale }: { token: string; locale: string }) {
  const c = FREE_CRAWLER_COPY[freeBase(locale)];
  const r = c.result;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/free/v1/site-crawler/${encodeURIComponent(token)}/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, consent, locale }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(c.errors[data.error ?? "generic"] ?? c.errors.generic);
        return;
      }
      router.refresh();
    } catch {
      setError(c.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={f.panel} onSubmit={submit} data-testid="free-unlock-form">
      <h2 className={f.resultH}>{r.unlockTitle}</h2>
      <p className={f.note} style={{ marginTop: 4 }}>
        {r.unlockBody}
      </p>
      <div className={f.row} style={{ marginTop: 14 }}>
        <div className={f.grow}>
          <label className={f.label} htmlFor="free-unlock-email">
            {r.emailLabel}
          </label>
          <input id="free-unlock-email" className={f.input} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className={`${s.btn} ${s.btnPrimary}`} type="submit" disabled={busy || !email.trim()}>
          {busy ? r.unlocking : r.unlockButton}
        </button>
      </div>
      <label className={f.note} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{r.consentLabel}</span>
      </label>
      {error && (
        <p className={f.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function ShareResultButton({ locale }: { locale: string }) {
  const r = FREE_CRAWLER_COPY[freeBase(locale)].result;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const u = new URL(window.location.href);
    u.search = "";
    try {
      await navigator.clipboard.writeText(u.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(r.share, u.toString());
    }
  };
  return (
    <button type="button" className={s.btn} onClick={copy} data-testid="free-share">
      <span aria-live="polite">{copied ? r.copied : r.share}</span>
    </button>
  );
}
