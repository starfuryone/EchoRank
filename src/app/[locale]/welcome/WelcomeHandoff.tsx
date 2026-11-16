"use client";

// /welcome's verified states (PLAN-HUB Part 1). The server has already checked
// the session is complete and the signed-in tenant's (checkout-handoff.ts);
// this component only waits for the webhook and moves on.
//
//   ready   — the tenant already shows the plan: report the conversion (once)
//             and go to /plan?welcome=1 at once.
//   pending — "Payment confirmed. Setting up your {Plan}…", polling
//             /api/billing/status every 2 s for up to ~60 s, then /plan.
//   timeout — "Still finishing", a button to /plan and the support address.
//
// Never blank, never a lock screen: every state has words and a way on.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { HandoffConversion } from "@/lib/billing/checkout-handoff";
import { pollUntilReady, type BillingStatusBody } from "@/lib/billing/handoff-poll";
import s from "../home2.module.css";
import g from "../guides/_shared/guide.module.css";

/**
 * DATA ONLY: this crosses from the server-rendered /welcome page, and a
 * function in a Client Component's props is a 500. The page's catalog holds
 * `confirmed` as a function of the plan name (WelcomeHandoffCatalog) and
 * fills it in before handing it over (tests/rsc-client-props.test.ts).
 */
export interface WelcomeHandoffCopy {
  confirmed: string;
  opening: string;
  waitingNote: string;
  stillTitle: string;
  stillBody: string;
  openPlan: string;
  supportLead: string;
}

/** The page's catalog entry: `confirmed` still takes the plan name. */
export type WelcomeHandoffCatalog = Omit<WelcomeHandoffCopy, "confirmed"> & { confirmed: (plan: string) => string };

const PLAN_HREF = "/plan?welcome=1";
const SUPPORT = "support@echorank360.com";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * GA4 conversion, once per checkout session, only where gtag is loaded (the
 * public layout's Consent Mode tag: the event follows the same consent
 * state as everything else it sends).
 */
function reportConversion(c: HandoffConversion | null, planName: string) {
  if (!c || typeof window === "undefined" || typeof window.gtag !== "function") return;
  const key = `echorank.welcome.conversion.${c.transactionId}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    // Storage blocked: send anyway; GA4 dedupes purchases on transaction_id.
  }
  window.gtag("event", c.event, {
    transaction_id: c.transactionId,
    value: c.value,
    currency: c.currency,
    items: [{ item_name: planName }],
  });
}

export function WelcomeHandoff({
  mode,
  plan,
  planName,
  conversion,
  t,
}: {
  mode: "ready" | "pending";
  plan: string;
  planName: string;
  conversion: HandoffConversion | null;
  t: WelcomeHandoffCopy;
}) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    reportConversion(conversion, planName);
    if (mode === "ready") {
      router.replace(PLAN_HREF);
      return;
    }
    let cancelled = false;
    void pollUntilReady({
      plan,
      fetchStatus: async () => {
        const res = await fetch("/api/billing/status", { cache: "no-store" });
        return res.ok ? ((await res.json()) as BillingStatusBody) : null;
      },
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      isCancelled: () => cancelled,
    }).then((outcome) => {
      if (outcome === "ready") router.replace(PLAN_HREF);
      else if (outcome === "timeout") setTimedOut(true);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, plan, planName, conversion, router]);

  if (timedOut) {
    return (
      <div data-testid="welcome-timeout" role="status">
        <p className={s.sub}>{t.stillTitle}</p>
        <p className={g.para}>{t.stillBody}</p>
        <div className={s.ctarow} style={{ marginTop: 28 }}>
          <Link className={`${s.btn} ${s.btnPrimary}`} href="/plan" data-testid="welcome-open-plan">
            {t.openPlan}
          </Link>
        </div>
        <p className={g.uiNote} style={{ marginTop: 16 }}>
          {/* As text: the repo keeps no support@ mailto links (tests/sales-links.test.ts). */}
          {t.supportLead} <span style={{ userSelect: "all" }}>{SUPPORT}</span>
        </p>
      </div>
    );
  }

  return (
    <div data-testid={mode === "ready" ? "welcome-ready" : "welcome-pending"} role="status" aria-live="polite">
      <p className={s.sub}>{t.confirmed}</p>
      <p className={g.uiNote}>{mode === "ready" ? t.opening : t.waitingNote}</p>
      <div className={s.ctarow} style={{ marginTop: 28 }}>
        <Link className={`${s.btn} ${s.btnGhost}`} href={PLAN_HREF}>
          {t.openPlan}
        </Link>
      </div>
    </div>
  );
}
