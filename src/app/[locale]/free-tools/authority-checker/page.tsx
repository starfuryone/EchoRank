// /[locale]/free-tools/authority-checker — the Link Authority Checker's public
// LANDING PAGE (2026-11-09). The checker itself is a paid tool on every paid
// plan (/visibility/tools/link-authority); this URL kept its place in the
// sitemap and now shows what the tool does: the report's contents, a static
// result labelled "Sample" (./client.tsx), the explainer and the FAQ, whose
// FAQPage JSON-LD the shell builds from the same array. No form and no API
// call: nothing here spends money or needs a limit.
//
// Primary CTA: "Included in every plan from $<price>" → ctaHref() (pricing, with
// src=link-authority). The price is the lowest plan that includes the tool,
// read from plan-config, never typed. Body localized en / fr / de-CH, so each
// canonicals to its own base.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { FREE_TOOLS_BASE, ctaHref, freeToolById, freeToolVisible } from "@/lib/free-tools";
import { AUTHORITY_COPY, authorityLocale, type AuthorityCopy } from "@/lib/authority-checker/copy";
import { linkAuthorityFromPrice } from "@/lib/authority-checker/pricing";
import { pricingBase, usd } from "@/lib/pricing-page/format";
import type { ToolCopy } from "../_shared/copy";
import { FreeToolShell } from "../_shared/FreeToolShell";
import { AuthoritySample } from "./client";
import a from "./authority.module.css";

const TOOL = freeToolById("authority_checker");

function shellCopy(c: AuthorityCopy): ToolCopy {
  return {
    name: c.name,
    blurb: c.blurb,
    intro: c.intro,
    metaTitle: c.metaTitle,
    metaDescription: c.metaDescription,
    limitNote: "",
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
      kicker={c.kicker}
      cta={{
        primary: { href: ctaHref(TOOL, locale), label: `${c.ctaButton(usd(linkAuthorityFromPrice(), pricingBase(locale)))} →` },
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
      <AuthoritySample locale={locale} />
    </FreeToolShell>
  );
}
