"use client";

/**
 * Email capture in front of the gated guides.
 *
 * PLACEHOLDER. Nothing is sent anywhere and nothing is stored. submitLead()
 * below is the single seam where Brevo goes; the form, its validation and the
 * modal around it are already in their final shape, so wiring the real thing
 * should not touch anything else in this file.
 */

import { useId, useState } from "react";
import { z } from "zod";
import type { HomeContent } from "@/lib/i18n/content";
import f from "./resources.module.css";

export interface LeadPayload {
  email: string;
  locale: string;
  /** Where the capture happened, for attribution once this is real. */
  source: "resources-modal";
  marketingOptIn: boolean;
}

/**
 * The ONLY function that will change when Brevo is wired up.
 *
 * TODO(brevo): replace with Brevo contact-create / list-subscribe call.
 * Until then it resolves after a short delay so the form exercises its own
 * loading and success states. It deliberately makes no network request — not
 * to /api/ebooks/lead, not anywhere — so nothing half-real gets recorded and
 * no address is captured that we have not told the visitor we are keeping.
 */
async function submitLead(payload: LeadPayload): Promise<void> {
  void payload;
  await new Promise((resolve) => setTimeout(resolve, 600));
}

const schema = z.object({ email: z.string().email() });

export function EbookLeadForm({
  locale,
  labels,
  onDone,
}: {
  locale: string;
  labels: HomeContent["resourceModal"];
  /** Called once the placeholder "submit" succeeds. */
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailId = useId();
  const errId = useId();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    // zod on top of the input's own type="email" required: the browser check
    // is easy to bypass and differs between engines.
    if (!schema.safeParse({ email: email.trim() }).success) {
      setError(labels.emailInvalid);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await submitLead({
        email: email.trim(),
        locale,
        source: "resources-modal",
        marketingOptIn: optIn,
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate={false}>
      <label className={f.fieldLabel} htmlFor={emailId}>
        {labels.emailLabel}
      </label>
      <input
        id={emailId}
        className={f.input}
        type="email"
        required
        autoComplete="email"
        placeholder={labels.emailPlaceholder}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (error) setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
      />
      {error && (
        <p id={errId} className={f.error} role="alert">
          {error}
        </p>
      )}

      <label className={f.checkRow}>
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
        <span>{labels.optIn}</span>
      </label>

      <p className={f.privacy}>{labels.privacy}</p>

      <button type="submit" className={f.primaryBtn} disabled={busy}>
        {busy ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
