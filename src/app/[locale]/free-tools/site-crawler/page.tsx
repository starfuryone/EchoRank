// /[locale]/free-tools/site-crawler — the free public site crawler: 100 pages,
// raw HTML, anyone (Turnstile). The form starts a crawl and shows its progress;
// the result lives at ./r/<token>. Body localized en/fr (free-copy.ts), so each
// base canonicals to itself. Behind the crawl.free flag (404 when off).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { FREE_TOOLS_BASE, ctaHref, freeToolById, freeToolVisible } from "@/lib/free-tools";
import { FREE_CRAWLER_COPY, freeBase, type FreeCrawlerCopy } from "@/lib/site-crawler/free-copy";
import { paidCrawlCeiling } from "@/lib/site-crawler/free-result";
import type { ToolCopy } from "../_shared/copy";
import { FreeToolShell } from "../_shared/FreeToolShell";
import { FreeCrawlerStart } from "./client";
import f from "../_shared/free-tools.module.css";

const TOOL = freeToolById("site_crawler");

/** The shell's copy, from the localized catalog. */
function shellCopy(c: FreeCrawlerCopy, locale: string): ToolCopy {
  return {
    name: c.name,
    blurb: c.blurb,
    intro: c.intro,
    metaTitle: c.metaTitle,
    metaDescription: c.metaDescription,
    limitNote: c.limitNote,
    cta: c.result.ctaTitle(paidCrawlCeiling(locale)),
    faq: c.faq,
  };
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale) || !freeToolVisible(TOOL)) return {};
  const base = freeBase(locale);
  const c = FREE_CRAWLER_COPY[base];
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
  const c = FREE_CRAWLER_COPY[freeBase(locale)];

  return (
    <FreeToolShell
      locale={locale}
      tool={TOOL}
      copy={shellCopy(c, locale)}
      cta={{
        primary: { href: ctaHref(TOOL), label: `${c.result.ctaButton} →` },
        secondary: { href: `/${locale}${FREE_TOOLS_BASE}`, label: "All free tools" },
      }}
    >
      <FreeCrawlerStart locale={locale} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      <p className={f.note} data-testid="free-crawl-abuse">
        {c.abuse}
      </p>
    </FreeToolShell>
  );
}
