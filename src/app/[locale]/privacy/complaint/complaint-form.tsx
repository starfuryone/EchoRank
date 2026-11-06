"use client";

import { useState } from "react";
import { useTurnstile } from "@/components/turnstile/use-turnstile";
import { COMPLAINT_PAGE_COPY, complaintLocale } from "@/lib/privacy/complaint-copy";

const field: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #c9ced6",
  borderRadius: 8,
  font: "inherit",
  marginTop: 4,
};

export function ComplaintForm({ locale, turnstileSiteKey }: { locale: string; turnstileSiteKey?: string }) {
  const c = COMPLAINT_PAGE_COPY[complaintLocale(locale)];
  const { box, token, reset } = useTurnstile(turnstileSiteKey);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (turnstileSiteKey && !token) {
      setError(c.errors.turnstile);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/free/v1/privacy-complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, details, locale, turnstileToken: token ?? undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        const key = (d.error as keyof typeof c.errors) ?? "generic";
        setError(c.errors[key] ?? c.errors.generic);
        reset();
        return;
      }
      setReference(d.reference);
    } catch {
      setError(c.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <p role="status" data-testid="complaint-sent" style={{ padding: 16, borderRadius: 8, background: "#eef7f0", color: "#1f5130" }}>
        {c.sent(reference)}
      </p>
    );
  }
  return (
    <form onSubmit={submit} data-testid="complaint-form" style={{ display: "grid", gap: 14, margin: "20px 0", maxWidth: 640 }}>
      <label>
        {c.nameLabel}
        <input style={field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} autoComplete="name" />
      </label>
      <label>
        {c.emailLabel}
        <input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" />
      </label>
      <label>
        {c.detailsLabel}
        <textarea
          style={{ ...field, minHeight: 160 }}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          required
          minLength={20}
          maxLength={10000}
          aria-describedby="complaint-hint"
        />
        <span id="complaint-hint" style={{ fontSize: 13, color: "#5e6673" }}>
          {c.detailsHint}
        </span>
      </label>
      {turnstileSiteKey && <div ref={box} />}
      {error && (
        <p role="alert" style={{ color: "#b23838", margin: 0 }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        style={{ justifySelf: "start", padding: "10px 18px", borderRadius: 8, border: 0, background: "#1e2329", color: "#fff", font: "600 15px/1.2 inherit", cursor: "pointer" }}
      >
        {c.submit}
      </button>
    </form>
  );
}
