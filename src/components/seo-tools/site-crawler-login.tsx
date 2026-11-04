"use client";

// Forms login in the crawl configuration (Phase 4e, verified sites only):
// where the login form is, how to fill it, how to tell it worked. Saved per
// host through /api/seo/v1/crawl/sites/login (credentials write-only: a
// saved one shows as "Saved", blank keeps it), with a "Test login" button.
// Whether a crawl uses it is the "Log in before crawling" toggle.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SiteCrawler4eCopy } from "@/lib/i18n/site-crawler-4e";
import { LOGIN_LIMITS, type LoginInput, type LoginView } from "@/lib/site-crawler/login-config";

interface Draft {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  checkKind: "urlPrefix" | "selector";
  checkValue: string;
  username: string;
  password: string;
}

const EMPTY: Draft = { loginUrl: "", usernameSelector: "", passwordSelector: "", submitSelector: "", checkKind: "urlPrefix", checkValue: "", username: "", password: "" };

export function fromLoginView(v: LoginView | null): Draft {
  return v
    ? { loginUrl: v.loginUrl, usernameSelector: v.usernameSelector, passwordSelector: v.passwordSelector, submitSelector: v.submitSelector, checkKind: v.successCheck.kind, checkValue: v.successCheck.value, username: "", password: "" }
    : EMPTY;
}

/** The draft as the API takes it: a blank credential keeps the saved one. */
export function toLoginInput(d: Draft, saved: boolean): LoginInput {
  const secret = (v: string) => (v ? v : saved ? ({ keep: true } as const) : null);
  return {
    loginUrl: d.loginUrl.trim(),
    usernameSelector: d.usernameSelector.trim(),
    passwordSelector: d.passwordSelector.trim(),
    submitSelector: d.submitSelector.trim(),
    successCheck: { kind: d.checkKind, value: d.checkValue.trim() },
    username: secret(d.username),
    password: secret(d.password),
  };
}

export function LoginEditor({
  t,
  host,
  verified,
  use,
  onUse,
  disabled,
}: {
  t: SiteCrawler4eCopy;
  host: string;
  verified: boolean;
  /** "Log in before crawling" for this crawl. */
  use: boolean;
  onUse: (v: boolean) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const api = "/api/seo/v1/crawl/sites/login";

  useEffect(() => {
    if (!verified) return;
    let cancelled = false;
    void fetch(`${api}?host=${encodeURIComponent(host)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { login: LoginView | null } | null) => {
        if (cancelled || !d) return;
        setDraft(fromLoginView(d.login));
        setSaved(Boolean(d.login));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [host, verified]);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setNote(null);
  };

  async function send(method: "PUT" | "POST" | "DELETE") {
    setBusy(true);
    setNote(method === "POST" ? t.loginTesting : null);
    try {
      const res = await fetch(method === "DELETE" ? `${api}?host=${encodeURIComponent(host)}` : api, {
        method,
        headers: { "content-type": "application/json" },
        ...(method === "DELETE" ? {} : { body: JSON.stringify({ host, login: toLoginInput(draft, saved) }) }),
      });
      const d = await res.json().catch(() => null);
      if (method === "DELETE") {
        if (res.ok) {
          setDraft(EMPTY);
          setSaved(false);
          onUse(false);
          setNote(t.loginRemoved);
        }
      } else if (method === "PUT") {
        if (res.ok) {
          setSaved(true);
          setDraft((x) => ({ ...x, username: "", password: "" }));
          setNote(t.loginSaved);
        } else setNote(t.loginSaveFailed);
      } else {
        setNote(res.ok && d?.ok ? t.loginTestOk : t.loginTestFailed(t.loginReasons[d?.reason ?? ""] ?? t.loginReasons.success_check_failed));
      }
    } finally {
      setBusy(false);
    }
  }

  const field = (id: keyof Draft, label: string, type = "text", max: number = LOGIN_LIMITS.selectorChars) => (
    <div>
      <label htmlFor={`login-${id}`} className="mb-1 block text-xs font-medium text-gray-700">
        {label}
      </label>
      <Input
        id={`login-${id}`}
        type={type}
        autoComplete={type === "password" ? "new-password" : "off"}
        maxLength={max}
        placeholder={saved && (id === "username" || id === "password") ? t.loginSecretSet : undefined}
        value={draft[id]}
        disabled={disabled || busy}
        onChange={(e) => set({ [id]: e.target.value } as Partial<Draft>)}
      />
    </div>
  );

  return (
    <div className="space-y-2" aria-labelledby="cfg-login-title">
      <p id="cfg-login-title" className="text-sm font-medium text-gray-900">
        {t.loginTitle}
      </p>
      <p className="text-xs text-gray-500">{t.loginHelp}</p>
      {!verified ? (
        <p className="text-xs text-gray-500">{t.loginVerifiedOnly}</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {field("loginUrl", t.loginUrl, "url", LOGIN_LIMITS.urlChars)}
            <span />
            {field("username", t.loginUser, "text", LOGIN_LIMITS.credentialChars)}
            {field("password", t.loginPass, "password", LOGIN_LIMITS.credentialChars)}
            {field("usernameSelector", t.loginUserSel)}
            {field("passwordSelector", t.loginPassSel)}
            {field("submitSelector", t.loginSubmitSel)}
            <span />
            <Select
              id="login-check-kind"
              label={t.loginCheck}
              value={draft.checkKind}
              disabled={disabled || busy}
              onChange={(e) => set({ checkKind: e.target.value as Draft["checkKind"] })}
              options={(["urlPrefix", "selector"] as const).map((k) => ({ value: k, label: t.loginCheckKinds[k] ?? k }))}
            />
            {field("checkValue", t.loginCheckValue, "text", LOGIN_LIMITS.urlChars)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={disabled || busy} onClick={() => void send("PUT")}>
              {t.loginSave}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => void send("POST")}>
              {t.loginTest}
            </Button>
            {saved && (
              <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => void send("DELETE")}>
                {t.loginRemove}
              </Button>
            )}
          </div>
          {note && (
            <p role="status" className="text-xs text-gray-600">
              {note}
            </p>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={use} disabled={disabled || !saved} onChange={(e) => onUse(e.target.checked)} />
            {t.loginUse}
          </label>
        </>
      )}
    </div>
  );
}
