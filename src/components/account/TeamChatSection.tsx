"use client";

// Team chat provisioning, on /settings/account.
//
// THE PASSWORD IS THE WHOLE DESIGN PROBLEM. It comes back in one HTTP response
// and is never stored — not by us, not by Synapse in recoverable form. So the
// UI has one job beyond looking tidy: make sure nobody clicks away from this
// screen without copying it. Hence the warning above the value rather than
// below it, the copy button next to it, and no auto-dismiss on the panel.
//
// Styling follows this page, which is the dark shell (gray-800 borders,
// gray-100 text) with gold accents — unlike most dashboard pages.

import { useCallback, useState } from "react";
import Link from "next/link";
import { MessageCircle, Copy, Check, AlertTriangle, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccountCopy } from "@/lib/i18n/account";

interface Props {
  copy: AccountCopy;
  /** Plan carries matrix_chat. Resolved server-side. */
  eligible: boolean;
  /** mxid of the live account, or null when none exists. */
  existingMxid: string | null;
  elementUrl: string;
}

interface ProvisionResponse {
  mxid: string;
  password: string;
  elementUrl: string;
}

export function TeamChatSection({ copy, eligible, existingMxid, elementUrl }: Props) {
  const [issued, setIssued] = useState<ProvisionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"mxid" | "password" | null>(null);

  const provision = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/matrix/provision", { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          payload.code === "ALREADY_PROVISIONED"
            ? copy.chatErrExists
            : payload.code === "RATE_LIMITED"
              ? copy.chatErrRate
              : copy.chatErrGeneric,
        );
        return;
      }
      setIssued(payload as ProvisionResponse);
    } catch {
      setError(copy.chatErrGeneric);
    } finally {
      setBusy(false);
    }
  }, [copy]);

  const copyValue = useCallback(async (value: string, which: "mxid" | "password") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard denied. The value is on screen and selectable, so this is
      // not worth an error banner — especially not on the one screen where an
      // extra red box might push the password out of view.
    }
  }, []);

  const heading = (
    <div className="flex items-center gap-2">
      <MessageCircle className="h-4 w-4 text-amber-400" aria-hidden="true" />
      <h2 className="text-sm font-semibold text-gray-100">{copy.chatTitle}</h2>
    </div>
  );

  if (!eligible) {
    return (
      <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
        {heading}
        <div className="mt-3 flex items-start gap-2">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-gray-300">{copy.chatLockedTitle}</p>
            <p className="mt-1 max-w-xl text-sm text-gray-500">{copy.chatLockedBody}</p>
            <Link
              href="/billing"
              className="mt-3 inline-flex items-center rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              {copy.chatUpgrade}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
      {heading}
      <p className="mt-2 max-w-2xl text-sm text-gray-400">{copy.chatIntro}</p>

      {/* Freshly issued: the only moment the password exists anywhere. */}
      {issued ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-amber-200">{copy.chatOnceWarning}</p>
          </div>

          <Field
            label={copy.chatAccountLabel}
            value={issued.mxid}
            onCopy={() => copyValue(issued.mxid, "mxid")}
            copied={copied === "mxid"}
            copyLabel={copy.chatCopy}
            copiedLabel={copy.chatCopied}
          />
          <Field
            label={copy.chatPasswordLabel}
            value={issued.password}
            mono
            onCopy={() => copyValue(issued.password, "password")}
            copied={copied === "password"}
            copyLabel={copy.chatCopy}
            copiedLabel={copy.chatCopied}
          />

          <ElementLink url={issued.elementUrl || elementUrl} label={copy.chatOpenElement} />
        </div>
      ) : existingMxid ? (
        // Already provisioned: identifier and a way in. No password — we do
        // not have it, and pretending otherwise would be the lie this whole
        // design avoids.
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-300">{copy.chatExisting}</p>
          <Field label={copy.chatAccountLabel} value={existingMxid} />
          <ElementLink url={elementUrl} label={copy.chatOpenElement} />
        </div>
      ) : (
        <div className="mt-4">
          <Button onClick={provision} disabled={busy}>
            {busy ? copy.chatProvisioning : copy.chatProvision}
          </Button>
        </div>
      )}

      {error ? (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  onCopy,
  copied,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
  copied?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
}) {
  return (
    <div>
      <span className="block text-xs font-medium text-gray-500">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <code
          className={`min-w-0 flex-1 overflow-x-auto rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-100 ${
            mono ? "font-mono tracking-tight" : ""
          }`}
        >
          {value}
        </code>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-700 px-2.5 py-2 text-xs text-gray-300 hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copied ? copiedLabel : copyLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ElementLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
    >
      {label}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}
