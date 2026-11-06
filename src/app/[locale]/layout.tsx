import Script from "next/script";
import { CookieConsent } from "@/components/marketing/cookie-consent";
import { GA_MEASUREMENT_ID, ga4ConsentInitScript } from "@/lib/consent/cookie-consent";

// Public marketing layout. It exists solely to scope Google Analytics to the
// pages we actually want measured.
//
// Everything under src/app/[locale] is marketing: proxy.ts rewrites "/" to
// "/{locale}" and 308s bare or bogus-locale marketing paths ("/about",
// "/xx/about") onto "/{locale}/...", so all public traffic renders through
// here. The authed app lives in the (dashboard) and (auth) route groups, which
// are siblings of this segment and never render this layout.
//
// Putting the tag in the root layout instead would have counted every
// signed-in dashboard route as marketing traffic and sent customer URLs —
// tenant ids, prompt text in query strings — to Google. That is the whole
// reason this file is a separate layout rather than four lines in app/layout.tsx.
//
// A GA4 measurement id is public by design: Google embeds it in the page for
// every visitor. It is not a secret and does not belong in .env.
//
// CONSENT MODE, DEFAULT DENIED (UK GDPR / PECR): the init script sets every
// consent type to denied before gtag.js does anything, re-applies a stored
// Accept, and configures GA4 with Google signals and ads personalisation off.
// The banner (<CookieConsent>) asks once; "Cookie settings" in the footer
// reopens it. src/lib/consent/cookie-consent.ts holds all of it.

export default function PublicLocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <CookieConsent />

      {/* The consent defaults go first (the init script queues them into
          dataLayer before gtag.js reads it), then the tag. afterInteractive:
          never blocks hydration. */}
      <Script id="ga4-init" strategy="afterInteractive">
        {ga4ConsentInitScript(GA_MEASUREMENT_ID)}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
