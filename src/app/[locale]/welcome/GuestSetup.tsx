"use client";

// The three guest states that need a browser: the password form, the wait while
// the webhook lands, and the "already done" note.
//
// CLIENT COMPONENT — it imports NOTHING server-side. Not prisma, not Stripe, not
// guest-welcome.ts. The server component decides the initial state and passes it
// as a plain prop; everything here is fetch() against /api/auth/guest, which
// re-vets the session on every call. A value import from a server module is what
// took production down on 2026-08-18.

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import s from "../home2.module.css";
import g from "../guides/_shared/guide.module.css";
import c from "./guest-setup.module.css";

/** How long to wait for the webhook before saying so. */
const POLL_INTERVAL_MS = 3_000;
const POLL_LIMIT_MS = 60_000;

export type GuestKind = "ready" | "pending" | "consumed";

export interface GuestCopy {
  readyTitle: string;
  readyBody: (email: string) => string;
  passwordLabel: string;
  passwordHint: string;
  submit: string;
  submitBusy: string;
  errShort: string;
  errFailed: string;
  errSignin: string;
  pendingTitle: string;
  pendingBody: string;
  pendingSlow: string;
  consumedTitle: string;
  consumedBody: string;
  loginCta: string;
}

export function GuestSetup({
  sessionId,
  initialKind,
  email,
  planHome,
  loginHref,
  t,
}: {
  sessionId: string;
  initialKind: GuestKind;
  email: string | null;
  planHome: string;
  loginHref: string;
  t: GuestCopy;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<GuestKind>(initialKind);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);
  const startedAt = useRef(0);

  // ── The wait state ────────────────────────────────────────────────────────
  // The buyer can beat Stripe's delivery, so `pending` is a normal outcome and
  // not an error. Bounded: after POLL_LIMIT_MS it stops asking and says so,
  // rather than spinning forever against a webhook that is never coming.
  useEffect(() => {
    if (kind !== "pending") return;
    if (!startedAt.current) startedAt.current = Date.now();

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt.current > POLL_LIMIT_MS) {
        setSlow(true);
        return;
      }
      try {
        const res = await fetch(`/api/auth/guest?s=${encodeURIComponent(sessionId)}`);
        const data = (await res.json()) as { status?: string };
        if (cancelled) return;
        if (data.status === "ready" || data.status === "consumed") {
          setKind(data.status);
          return;
        }
      } catch {
        // A dropped poll is not a failure state; the next tick tries again.
      }
      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    let timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, sessionId]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      if (password.length < 8) {
        setError(t.errShort);
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/auth/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, password }),
        });
        if (!res.ok) {
          // One message for every reject, mirroring the endpoint's one code.
          setError(t.errFailed);
          setBusy(false);
          return;
        }
        const data = (await res.json()) as { email?: string; planHome?: string };

        // Sign in with the password just set. NextAuth has to mint the cookie:
        // the route above deliberately does not.
        const result = await signIn("credentials", {
          email: data.email ?? email ?? "",
          password,
          redirect: false,
        });
        if (result?.error) {
          // The account exists and the password is set — they can simply log in,
          // so this is a detour, not a dead end.
          setError(t.errSignin);
          setBusy(false);
          return;
        }
        router.push(data.planHome ?? planHome);
      } catch {
        setError(t.errFailed);
        setBusy(false);
      }
    },
    [password, sessionId, email, planHome, router, t],
  );

  if (kind === "consumed") {
    return (
      <>
        <p className={s.sub}>{t.consumedTitle}</p>
        <p className={g.para}>{t.consumedBody}</p>
        <div className={s.ctarow} style={{ marginTop: 28 }}>
          <Link className={`${s.btn} ${s.btnPrimary}`} href={loginHref}>
            {t.loginCta}
          </Link>
        </div>
      </>
    );
  }

  if (kind === "pending") {
    return (
      <>
        <p className={s.sub}>
          <span className={c.spinner} aria-hidden="true" />
          {t.pendingTitle}
        </p>
        <p className={g.para} aria-live="polite">
          {slow ? t.pendingSlow : t.pendingBody}
        </p>
      </>
    );
  }

  return (
    <>
      <p className={s.sub}>{t.readyTitle}</p>
      <p className={g.para}>
        {t.readyBody(email ?? "")}
      </p>

      <form className={c.form} onSubmit={submit}>
        <label className={c.label} htmlFor="guest-password">
          {t.passwordLabel}
        </label>
        <input
          id="guest-password"
          className={c.input}
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className={c.hint}>{t.passwordHint}</p>
        {error && (
          <p className={c.error} role="alert">
            {error}
          </p>
        )}
        <div className={c.actions}>
          <button className={`${s.btn} ${s.btnPrimary}`} type="submit" disabled={busy}>
            {busy ? t.submitBusy : t.submit}
          </button>
        </div>
      </form>
    </>
  );
}
