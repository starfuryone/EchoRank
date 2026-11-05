"use client";

// <GuideCta> — the crawler guides' calls to action: the inline band after the
// first numbered step, the one-sentence nudge, and the closing card.
//
// Auth-aware like the top nav: signed out the button is "See plans" →
// /{locale}/pricing (plus the free-crawl link when crawl.free is on); signed in
// it is "Open <brand>" → /crawler. It starts signed-out and corrects itself,
// exactly like CrawlerCta, so anonymous visitors never see an app link flash.
// Never the registration form — site rule.
//
// One session probe per page, not one per CTA: <GuideCtaSession> wraps the
// article and the three CTAs read its answer. Copy arrives as props, resolved
// on the server from marketing-copy.ts (guideCtas) — this module imports no
// server code.

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { useSignedIn } from "@/app/[locale]/PublicNav";
import type { GuideCtaResolved } from "@/lib/site-crawler/marketing-copy";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { NosyBatIcon } from "@/components/seo-tools/nosy-bat-icon";
import { NosyBatLogo } from "@/components/brand/NosyBatLogo";
import s from "@/app/[locale]/home2.module.css";
import g from "./guide-cta.module.css";

const SignedIn = createContext(false);

export function GuideCtaSession({ children }: { children: ReactNode }) {
  const signedIn = useSignedIn();
  return <SignedIn.Provider value={signedIn}>{children}</SignedIn.Provider>;
}

export interface GuideCtaProps {
  variant: "inline" | "nudge" | "closing";
  copy: GuideCtaResolved;
  /** Locale-prefixed /pricing. */
  pricingHref: string;
  /** Locale-prefixed free crawler, or null when crawl.free is off. */
  freeHref: string | null;
}

export function GuideCta({ variant, copy, pricingHref, freeHref }: GuideCtaProps) {
  const signedIn = useContext(SignedIn);
  const { labels } = copy;

  if (variant === "nudge") {
    return (
      <p className={g.nudge} data-guide-cta="nudge">
        {copy.nudge}{" "}
        <Link href={signedIn ? "/crawler" : pricingHref}>{signedIn ? labels.nudgeOpen : labels.nudgePlans}</Link>
      </p>
    );
  }

  const actions = (
    <span className={g.actions}>
      <Link className={`${s.btn} ${s.btnPrimary}`} href={signedIn ? "/crawler" : pricingHref}>
        {signedIn ? labels.open : labels.plans}
      </Link>
      {!signedIn && freeHref && (
        <a className={g.textLink} href={freeHref}>
          {labels.free}
        </a>
      )}
    </span>
  );

  if (variant === "inline") {
    return (
      <aside className={g.band} data-guide-cta="inline">
        <NosyBatIcon className={g.mark} />
        <p className={g.line}>{copy.inline}</p>
        {actions}
      </aside>
    );
  }

  return (
    <aside className={g.closing} data-guide-cta="closing">
      <div className={g.lockup}>
        <NosyBatLogo height={36} alt={CRAWLER_BRAND.name} tone="dark" themed />
        <span className={g.byline}>{copy.byline}</span>
      </div>
      <h2 className={g.closingH}>{copy.closing.h}</h2>
      <p className={g.closingP}>{copy.closing.p1}</p>
      <p className={g.closingP}>{copy.closing.p2}</p>
      {actions}
    </aside>
  );
}
