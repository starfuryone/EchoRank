import Script from "next/script";

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
const GA_MEASUREMENT_ID = "G-WLEC4CZ86S";

export default function PublicLocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}

      {/* afterInteractive: the tag loads early but never blocks hydration.
          beforeInteractive would be wrong here — it is reserved for scripts the
          page cannot render without, and it must live in the root layout. */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}
