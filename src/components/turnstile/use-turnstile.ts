"use client";

// Cloudflare Turnstile, explicit render: the script is loaded once per page and
// the widget mounted in `box`. `token` is the challenge response the server
// verifies (src/lib/snapshot/turnstile.ts); `reset` asks for a fresh one after
// a refused submit. No site key (NEXT_PUBLIC_TURNSTILE_SITE_KEY unset) renders
// nothing and leaves `token` null. Shared by the AI Visibility Check and the
// free site crawler.

import { useCallback, useEffect, useRef, useState } from "react";

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function useTurnstile(siteKey: string | undefined) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (!siteKey || !box.current) return;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !box.current || !window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: siteKey,
        callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(null),
        "error-callback": () => setToken(null),
      });
    };
    if (window.turnstile) mount();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SRC}"]`);
      if (!s) {
        s = document.createElement("script");
        s.src = TURNSTILE_SRC;
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener("load", mount);
    }
    return () => {
      cancelled = true;
    };
  }, [siteKey]);
  const reset = useCallback(() => {
    setToken(null);
    if (widget.current) window.turnstile?.reset(widget.current);
  }, []);
  return { box, token, reset };
}
