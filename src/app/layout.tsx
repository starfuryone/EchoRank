import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BRAND_DESCRIPTION, BRAND_TITLE, SITE_NAME, SITE_URL } from "@/lib/seo";

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
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
