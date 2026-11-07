"use client";

import { useMemo, useState } from "react";
import { useTurnstile } from "@/components/turnstile/use-turnstile";
import { SIGNUP_COUNTRY_CODES, isBlockedCountry } from "@/lib/geo/blocked-countries";
import { INQUIRY_NEEDS, INQUIRY_SIZES, type InquiryNeed } from "@/lib/sales/inquiry-options";
import { SALES_COPY, salesLocale, type InquiryError } from "@/lib/sales/inquiry-copy";
import f from "./contact.module.css";

export function ContactForm({
  locale,
  src,
  turnstileSiteKey,
}: {
  locale: string;
  src: string | null;
  turnstileSiteKey?: string;
}) {
  const c = SALES_COPY[salesLocale(locale)];
  const { box, token, reset } = useTurnstile(turnstileSiteKey);
  const [v, setV] = useState({ name: "", email: "", company: "", website: "", country: "", size: "", message: "", hp: "" });
  const [needs, setNeeds] = useState<InquiryNeed[]>([]);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<InquiryError | null>(null);
  const [bad, setBad] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return SIGNUP_COUNTRY_CODES.map((code) => [code, names.of(code) ?? code] as const).sort((a, b) =>
      a[1].localeCompare(b[1], locale),
    );
  }, [locale]);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));
  const toggle = (n: InquiryNeed) => setNeeds((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  const invalid = (k: string) => (bad.includes(k) ? true : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBad([]);
    // Same answer the server gives; nothing is sent for a blocked country.
    if (isBlockedCountry(v.country)) {
      setError("blocked");
      return;
    }
    if (turnstileSiteKey && !token) {
      setError("turnstile");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/free/v1/sales-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...v,
          message: v.message || undefined,
          needs,
          marketingConsent: marketing,
          locale,
          src: src ?? undefined,
          referrer: document.referrer || undefined,
          turnstileToken: token ?? undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        const key = (d.error as InquiryError) in c.errors ? (d.error as InquiryError) : "generic";
        setError(key);
        if (Array.isArray(d.fields)) setBad(d.fields);
        reset();
        return;
      }
      setSent(true);
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p role="status" className={f.done} data-testid="inquiry-sent">
        {c.thanks}
      </p>
    );
  }

  return (
    <form className={f.form} onSubmit={submit} noValidate={false} data-testid="inquiry-form">
      <label className={f.field}>
        <span className={f.lbl}>{c.name}</span>
        <input className={f.input} name="name" value={v.name} onChange={set("name")} required maxLength={200} autoComplete="name" aria-invalid={invalid("name")} />
      </label>
      <label className={f.field}>
        <span className={f.lbl}>{c.email}</span>
        <input className={f.input} name="email" type="email" value={v.email} onChange={set("email")} required maxLength={254} autoComplete="email" aria-invalid={invalid("email")} />
      </label>
      <label className={f.field}>
        <span className={f.lbl}>{c.company}</span>
        <input className={f.input} name="company" value={v.company} onChange={set("company")} required maxLength={200} autoComplete="organization" aria-invalid={invalid("company")} />
      </label>
      <label className={f.field}>
        <span className={f.lbl}>{c.website}</span>
        <input className={f.input} name="website" value={v.website} onChange={set("website")} required maxLength={300} placeholder={c.websitePh} inputMode="url" autoComplete="url" aria-invalid={invalid("website")} />
      </label>
      <label className={f.field}>
        <span className={f.lbl}>{c.country}</span>
        <select className={f.select} name="country" value={v.country} onChange={set("country")} required autoComplete="country" aria-invalid={invalid("country")}>
          <option value="">{c.countryPh}</option>
          {countries.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={f.field}>
        <span className={f.lbl}>{c.size}</span>
        <select className={f.select} name="size" value={v.size} onChange={set("size")} required aria-invalid={invalid("size")}>
          <option value="" />
          {INQUIRY_SIZES.map((s) => (
            <option key={s} value={s}>
              {c.sizes[s]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className={`${f.fieldset} ${f.full}`}>
        <legend className={`${f.lbl} ${f.legend}`}>{c.needs}</legend>
        <div className={f.checks}>
          {INQUIRY_NEEDS.map((n) => (
            <label key={n} className={f.check}>
              <input type="checkbox" name="needs" value={n} checked={needs.includes(n)} onChange={() => toggle(n)} />
              <span>{c.needOptions[n]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className={`${f.field} ${f.full}`}>
        <span className={f.lbl}>
          {c.message} <span className={f.opt}>({c.optional})</span>
        </span>
        <textarea className={f.textarea} name="message" value={v.message} onChange={set("message")} maxLength={5000} />
      </label>

      {/* Honeypot: hidden from people and from assistive tech; a bot fills it in. */}
      <div className={f.hp} aria-hidden="true">
        <label>
          Fax
          <input name="fax" tabIndex={-1} autoComplete="off" value={v.hp} onChange={set("hp")} />
        </label>
      </div>

      <label className={`${f.check} ${f.full}`}>
        <input type="checkbox" name="marketingConsent" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        <span>{c.marketing}</span>
      </label>

      <p className={`${f.muted} ${f.full}`}>
        {c.privacy[0]}
        <a href={`/${locale}/legal/privacy`}>{c.privacy[1]}</a>
        {c.privacy[2]}
      </p>

      {turnstileSiteKey && <div ref={box} className={f.full} />}

      {error && (
        <p role="alert" className={`${f.error} ${f.full}`} data-testid="inquiry-error">
          {c.errors[error]}
        </p>
      )}

      <button type="submit" className={`${f.submit} ${f.full}`} disabled={busy}>
        {busy ? c.sending : c.submit}
      </button>
    </form>
  );
}
