// The free-tools hub: every anonymous tool in one grid.
//
// Cards render from FREE_TOOLS in src/lib/free-tools.ts — the single source of
// truth the brief asked for. A tool is added there and appears here, in the
// sitemap and in the route table without touching this file.
//
// METADATA COMES FROM buildMetadata() AND NOWHERE ELSE, so there is one title
// and one canonical per route (the dual-metadata bug pattern).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/lib/seo/JsonLd";
import { organization, webSite } from "@/lib/seo/jsonld";
import { EXTENSION_CARD_HREF, FREE_TOOLS, FREE_TOOLS_BASE, ctaHref } from "@/lib/free-tools";
import { HUB_COPY, TOOL_COPY } from "./_shared/copy";
import { PublicNav } from "../PublicNav";
import s from "../home2.module.css";
import f from "./_shared/free-tools.module.css";

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
    path: FREE_TOOLS_BASE,
    title: "Free SEO tools — no account needed",
    description: HUB_COPY.intro,
    // English body under every locale — one canonical, not five duplicates.
    canonicalLocale: "en",
  });
}

export default async function FreeToolsHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();

  const foot = CONTENT[locale as Locale].footer;
  const L = (p: string) => `/${locale}${p.startsWith("/") ? p : `/${p}`}`;

  return (
    <div className={s.page}>
      <JsonLd graph={[organization(locale), webSite(locale)]} />
      <PublicNav locale={locale} />

      <div className={`${s.container} ${f.hero}`}>
        <p className={s.label}>
          <b>{HUB_COPY.kicker}</b>
        </p>
        <h1 className={f.heroH1}>{HUB_COPY.h1}</h1>
        <p className={f.heroSub}>{HUB_COPY.intro}</p>
      </div>

      <section className={s.section} style={{ paddingTop: 24 }}>
        <div className={s.container}>
          <div className={f.grid}>
            {FREE_TOOLS.map((tool) => {
              const copy = TOOL_COPY[tool.id];
              return (
                <Link
                  key={tool.id}
                  className={f.card}
                  href={L(`${FREE_TOOLS_BASE}/${tool.slug}`)}
                >
                  {tool.isNew && <span className={f.badge}>{HUB_COPY.newBadge}</span>}
                  <h2 className={f.cardH}>{copy.name}</h2>
                  <p className={f.cardP}>{copy.blurb}</p>
                </Link>
              );
            })}

            {/* Served by Caddy from /opt/echorank/extension-dist, outside this
                app — a plain anchor, not a locale-prefixed route. */}
            <a className={f.card} href={EXTENSION_CARD_HREF}>
              <h2 className={f.cardH}>{HUB_COPY.extensionName}</h2>
              <p className={f.cardP}>{HUB_COPY.extensionBlurb}</p>
            </a>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <div className={f.upsell}>
            <h2 className={f.cardH} style={{ fontSize: 22 }}>
              {HUB_COPY.ctaTitle}
            </h2>
            <p className={f.upsellP} style={{ maxWidth: 560, margin: "10px auto 16px" }}>
              {HUB_COPY.ctaBody}
            </p>
            <Link
              className={`${s.btn} ${s.btnPrimary}`}
              href={ctaHref(FREE_TOOLS[0]!)}
            >
              {HUB_COPY.ctaButton}
            </Link>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <div className={s.footin}>
            <span>{foot.copyright}</span>
            <span>
              {foot.links.map((l) => (
                <Link key={l.label} href={L(l.href)} style={{ marginLeft: 14 }}>
                  {l.label}
                </Link>
              ))}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
