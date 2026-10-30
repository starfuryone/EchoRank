import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BRAND_DESCRIPTION, BRAND_TITLE, SITE_NAME, SITE_URL } from "@/lib/seo";
import { themeInitScript } from "@/lib/theme-schedule";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The root layout carries only what genuinely applies app-wide: metadataBase,
// the title template + default, and a fallback description. Per-page metadata
// (canonical, hreflang, og:locale, images) is built by buildMetadata() in
// src/lib/seo — pages must not duplicate it here.
//
// JSON-LD is NOT emitted here. It used to be, which meant every authenticated
// dashboard route shipped marketing Organization/WebSite markup. Structured
// data now belongs to the pages that actually warrant it, via <JsonLd/>.
//
// No google-site-verification meta: verification is file-based at
// public/google53f8cfb2ee070790.html.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: BRAND_TITLE.en,
    // Marketing pages emit title.absolute and bypass this template. It remains
    // for app routes that set a bare string title.
    template: `%s | ${SITE_NAME}`,
  },
  description: BRAND_DESCRIPTION.en,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The theme script sets data-theme on this element BEFORE React
      // hydrates, so the server HTML and the live DOM legitimately differ.
      // Without this, every Day visitor gets a hydration warning on every page.
      suppressHydrationWarning
    >
      <head>
        {/* FOUC GUARD. Must be inline, in <head>, and synchronous: anything
            deferred paints night first and then flips, which on a dark-to-light
            change is a full-screen flash on every navigation.

            It only sets an attribute. The dashboard does not read the marketing
            tokens, so this is inert there — but it runs on every page rather
            than only on marketing ones, because the alternative is a second
            layout and a second place to keep this correct. */}
        {/* Also applies the New York day/night default on marketing paths
            when nothing is stored (src/lib/theme-schedule.ts). Built from a
            plain module: a constant imported from a "use client" file is a
            client reference here, not a string. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
