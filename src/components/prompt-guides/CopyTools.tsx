"use client";

// Copy buttons, the print button and the toast that reports a copy. The only
// interactive pieces on a guide page besides the nav; everything else is
// server-rendered. A copy tries navigator.clipboard first and falls back to a
// hidden textarea + execCommand("copy"), which still works on plain-http
// previews and older Safari, where the async Clipboard API is unavailable.

import { useEffect, useState } from "react";
import pg from "./prompt-guides.module.css";

const TOAST_EVENT = "prompt-guides:toast";

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function announce(message: string) {
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: message }));
}

export function CopyButton({
  text,
  label,
  ariaLabel,
  okMessage,
  failMessage,
  className,
}: {
  text: string;
  label: string;
  ariaLabel?: string;
  okMessage: string;
  failMessage: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className ?? pg.copyBtn}
      aria-label={ariaLabel}
      onClick={async () => announce((await copyText(text)) ? okMessage : failMessage)}
    >
      {label}
    </button>
  );
}

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className={pg.ghostBtn} onClick={() => window.print()}>
      {label}
    </button>
  );
}

/** One per page. Polite live region, so a screen reader hears "Copied to clipboard". */
export function Toast() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onToast = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 2400);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div role="status" aria-live="polite" className={message ? `${pg.toast} ${pg.toastOn}` : pg.toast}>
      {message}
    </div>
  );
}
