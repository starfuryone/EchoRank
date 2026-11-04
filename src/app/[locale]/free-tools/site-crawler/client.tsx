"use client";

// The free site crawler's form: URL, Turnstile, "Crawl 100 pages free". A new
// crawl shows its progress here and opens the result page when it ends; a
// domain crawled in the last 24 hours opens that result straight away.

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useTurnstile } from "@/components/turnstile/use-turnstile";
import { FREE_CRAWLER_COPY, freeBase } from "@/lib/site-crawler/free-copy";
import { FreeCrawlProgress } from "./progress";
import s from "../../home2.module.css";
import f from "../_shared/free-tools.module.css";

export function FreeCrawlerStart({ locale, siteKey }: { locale: string; siteKey?: string }) {
  const c = FREE_CRAWLER_COPY[freeBase(locale)];
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const { box, token: challenge, reset } = useTurnstile(siteKey);
  const resultHref = useCallback((t: string) => `/${locale}/free-tools/site-crawler/r/${encodeURIComponent(t)}`, [locale]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/free/v1/site-crawler", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, turnstileToken: challenge ?? undefined, locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; reused?: boolean; error?: string };
      if (!res.ok || !data.token) {
        setError(c.errors[data.error ?? "generic"] ?? c.errors.generic);
        reset();
        return;
      }
      if (data.reused) router.push(`${resultHref(data.token)}?reused=1`);
      else setRunning(data.token);
    } catch {
      setError(c.errors.generic);
      reset();
    } finally {
      setBusy(false);
    }
  };

  if (running) {
    return <FreeCrawlProgress token={running} locale={locale} onDone={() => router.push(resultHref(running))} />;
  }

  return (
    <form className={f.panel} onSubmit={submit} data-testid="free-crawl-form">
      <div className={f.row}>
        <div className={f.grow}>
          <label className={f.label} htmlFor="free-crawl-url">
            {c.urlLabel}
          </label>
          <input
            id="free-crawl-url"
            className={f.input}
            type="url"
            inputMode="url"
            autoComplete="url"
            required
            maxLength={2048}
            placeholder={c.urlPlaceholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <button className={`${s.btn} ${s.btnPrimary}`} type="submit" disabled={busy || !url.trim() || Boolean(siteKey && !challenge)}>
          {busy ? c.starting : c.submit}
        </button>
      </div>
      {siteKey && (
        <div style={{ marginTop: 14 }}>
          <div ref={box} />
          <p className={f.note}>{c.challengeNote}</p>
        </div>
      )}
      {error && (
        <p className={f.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
