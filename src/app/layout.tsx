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
const SITE_DESC =
  "Collect customer feedback, generate more authentic reviews, and identify service issues with AI-powered reputation management.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "EchoRank — Reputation Management & Customer Feedback Automation",
    template: "%s | EchoRank 360",
  },
  description: SITE_DESC,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "EchoRank — Reputation Management & Customer Feedback Automation",
    description: SITE_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: "EchoRank — Reputation Management & Customer Feedback Automation",
    description: SITE_DESC,
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
                  url: SITE_URL,
                  description: SITE_DESC,
                },
                {
                  "@type": "WebSite",
                  "@id": SITE_URL + "/#website",
                  url: SITE_URL,
                  name: SITE_NAME,
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
