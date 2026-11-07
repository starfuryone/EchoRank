// /[locale]/free-tools/authority-checker — the free Website Authority Checker.
// The form and result are client-side (./client.tsx); below them, the
// explainer (what authority is, how ours is calculated, what a good score is,
// how to improve it) and the FAQ, whose FAQPage JSON-LD the shell builds from
// the same array. Body localized en / fr / de-CH, so each canonicals to its
// own base. Primary CTA: "Track it monthly" → /pricing?src=authority-checker.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { FREE_TOOLS_BASE, freeToolById, freeToolVisible } from "@/lib/free-tools";
import { AUTHORITY_COPY, authorityLocale, type AuthorityCopy } from "@/lib/authority-checker/copy";
import { AUTHORITY_SRC } from "@/lib/authority-checker/config";
import type { ToolCopy } from "../_shared/copy";
import { FreeToolShell } from "../_shared/FreeToolShell";
import { AuthorityChecker } from "./client";
import a from "./authority.module.css";

const TOOL = freeToolById("authority_checker");

function shellCopy(c: AuthorityCopy): ToolCopy {
  return {
    name: c.name,
    blurb: c.blurb,
    intro: c.intro,
    metaTitle: c.metaTitle,
    metaDescription: c.metaDescription,
    limitNote: c.limitNote,
    cta: c.ctaTitle,
    faq: c.faq,
  };
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale) || !freeToolVisible(TOOL)) return {};
  const base = authorityLocale(locale);
  const c = AUTHORITY_COPY[base];
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
  const c = AUTHORITY_COPY[authorityLocale(locale)];

  return (
    <FreeToolShell
      locale={locale}
      tool={TOOL}
      copy={shellCopy(c)}
      cta={{
        primary: { href: `/${locale}/pricing?src=${AUTHORITY_SRC}`, label: `${c.ctaButton} →` },
        secondary: { href: `/${locale}${FREE_TOOLS_BASE}`, label: c.allTools },
      }}
      explainer={
        <div className={a.explain} data-testid="authority-explainer">
          {c.sections.map((section) => (
            <section key={section.h}>
              <h2>{section.h}</h2>
              {section.ps.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </section>
          ))}
        </div>
      }
    >
      <AuthorityChecker locale={locale} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
    </FreeToolShell>
  );
}
