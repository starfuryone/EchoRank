// /[locale]/free-tools/reddit-threads — the free Reddit Threads Finder, back
// on its old slug (2026-11-08) without Reddit's API: Google's site:reddit.com
// results by country (src/lib/reddit-threads/). The form and result are
// client-side (./client.tsx); the FAQ below them, whose FAQPage JSON-LD the
// shell builds from the same array. Body localized en / fr / de-CH, so each
// canonicals to its own base. Primary CTA "Track these keywords" → ctaHref():
// /<locale>/pricing?src=free-tools-reddit-threads.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { FREE_TOOLS_BASE, ctaHref, freeToolById, freeToolVisible } from "@/lib/free-tools";
import { REDDIT_COPY, redditLocale, type RedditCopy } from "@/lib/reddit-threads/copy";
import type { ToolCopy } from "../_shared/copy";
import { FreeToolShell } from "../_shared/FreeToolShell";
import { RedditThreadsFinder } from "./client";

const TOOL = freeToolById("reddit_threads");

function shellCopy(c: RedditCopy): ToolCopy {
  return {
    name: c.name,
    blurb: c.blurb,
    intro: c.intro,
    metaTitle: c.metaTitle,
    metaDescription: c.metaDescription,
    limitNote: c.limitNote,
    cta: c.upsell,
    faq: c.faq,
  };
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale) || !freeToolVisible(TOOL)) return {};
  const base = redditLocale(locale);
  const c = REDDIT_COPY[base];
  return buildMetadata({
    locale,
    path: `${FREE_TOOLS_BASE}/${TOOL.slug}`,
    title: c.metaTitle,
    description: c.metaDescription,
    canonicalLocale: base,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale) || !freeToolVisible(TOOL)) notFound();
  const c = REDDIT_COPY[redditLocale(locale)];

  return (
    <FreeToolShell
      locale={locale}
      tool={TOOL}
      copy={shellCopy(c)}
      cta={{
        primary: { href: ctaHref(TOOL, locale), label: `${c.ctaButton} →` },
        secondary: { href: `/${locale}${FREE_TOOLS_BASE}`, label: c.allTools },
      }}
    >
      <RedditThreadsFinder locale={locale} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
    </FreeToolShell>
  );
}
