"use client";

// The page's call to action, session-aware the way the top nav's is: signed
// out it goes to /pricing like every marketing CTA; signed in it opens the
// crawler. Same probe as PublicNav (useSignedIn), so it starts signed-out and
// corrects itself rather than flashing an app link at anonymous visitors.

import Link from "next/link";
import { useSignedIn } from "../PublicNav";
import s from "../home2.module.css";

export function CrawlerCta({
  pricingHref,
  plansLabel,
  openLabel,
}: {
  pricingHref: string;
  plansLabel: string;
  openLabel: string;
}) {
  const signedIn = useSignedIn();
  return signedIn ? (
    <Link className={`${s.btn} ${s.btnPrimary}`} href="/crawler">
      {openLabel}
    </Link>
  ) : (
    <Link className={`${s.btn} ${s.btnPrimary}`} href={pricingHref}>
      {plansLabel}
    </Link>
  );
}
