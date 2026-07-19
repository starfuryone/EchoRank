import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://echorank360.com";
const SITE_NAME = "EchoRank 360";
// Positioning matches the homepage meta description: AI visibility, not the
// older "collect reviews" reputation framing.
const SITE_DESC =
  "EchoRank 360 is an AI Visibility Management platform. Measure how ChatGPT, Google AI, Perplexity, Claude, Gemini and Copilot see your business, track recommendations daily, and get a prioritized roadmap to become the business AI recommends.";
const SITE_TITLE = "EchoRank 360 — AI Visibility Management Platform";
const OG_IMAGE = `${SITE_URL}/og-home.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | EchoRank 360",
  },
  description: SITE_DESC,
  alternates: { canonical: "/" },
  // GSC verification lives on the homepage (root domain) only — see
  // [locale]/page.tsx. A site-wide placeholder here leaked on every page.
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESC,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESC,
    images: [OG_IMAGE],
  },
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
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": SITE_URL + "/#organization",
                  name: SITE_NAME,
                  legalName: "ChatLogic Insights Ltd",
                  url: SITE_URL,
                  description: SITE_DESC,
                  logo: SITE_URL + "/echorank-logo.svg",
                  // No sameAs: the codebase carries no verified social profile
                  // URLs. Adding unverified ones would be fabricated data.
                },
                {
                  "@type": "WebSite",
                  "@id": SITE_URL + "/#website",
                  url: SITE_URL,
                  name: SITE_NAME,
                  description: SITE_DESC,
                  publisher: { "@id": SITE_URL + "/#organization" },
                },
              ],
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
