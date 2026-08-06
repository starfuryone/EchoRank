// serp-volatility
//
// Server component: metadata and the shell. The interactive part is the client
// component below, which is the only piece that needs to run in the browser.
//
// Metadata comes from buildMetadata() alone — one title, one canonical.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { FREE_TOOLS_BASE, freeToolById } from "@/lib/free-tools";
import { TOOL_COPY } from "../_shared/copy";
import { FreeToolShell } from "../_shared/FreeToolShell";
import { SerpVolatilityClient } from "./client";

const TOOL = freeToolById("serp_volatility");
const COPY = TOOL_COPY[TOOL.id];

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: `${FREE_TOOLS_BASE}/${TOOL.slug}`,
    title: COPY.metaTitle,
    description: COPY.metaDescription,
    // English body under every locale — canonical to the en URL.
    canonicalLocale: "en",
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();

  return (
    <FreeToolShell locale={locale} tool={TOOL} copy={COPY}>
      <SerpVolatilityClient />
    </FreeToolShell>
  );
}
