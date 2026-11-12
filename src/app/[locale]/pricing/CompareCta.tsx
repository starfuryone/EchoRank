"use client";

// The CTA row under the "Free vs paid" heading (#compare). Session-aware the
// way the top nav is (useSignedIn, the same probe as CrawlerCta): it renders
// signed-out first and corrects itself, so an anonymous visitor never sees an
// app link flash.
//
// Signed out, the primary goes to the plan cards (#pricing), not to a checkout
// or /register: checkout needs a plan picked, and the cards are where that
// happens. It scrolls there smoothly (instantly under reduced motion); the
// plain href is the no-JS fallback. Signed in it goes to /dashboard. The
// secondary is the free tools either way.
//
// Copy arrives as props, resolved on the server from PRICING_PAGE_COPY.

import Link from "next/link";
import type { MouseEvent } from "react";
import { useSignedIn } from "../PublicNav";
import s from "../home2.module.css";
import p from "./pricing.module.css";

export function CompareCta({
  trialLabel,
  dashboardLabel,
  freeToolsLabel,
  freeToolsHref,
}: {
  trialLabel: string;
  dashboardLabel: string;
  freeToolsLabel: string;
  /** Locale-prefixed /free-tools. */
  freeToolsHref: string;
}) {
  const signedIn = useSignedIn();

  function toCards(e: MouseEvent<HTMLAnchorElement>) {
    const cards = document.getElementById("pricing");
    if (!cards) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cards.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", "#pricing");
  }

  return (
    <div className={p.ctaRow} data-testid="compare-cta">
      {signedIn ? (
        <Link className={s.pbuyLink} href="/dashboard" data-cta="primary">
          {dashboardLabel}
        </Link>
      ) : (
        <a className={s.pbuyLink} href="#pricing" onClick={toCards} data-cta="primary">
          {trialLabel}
        </a>
      )}
      <Link className={s.btn} href={freeToolsHref} data-cta="secondary">
        {freeToolsLabel}
      </Link>
    </div>
  );
}
