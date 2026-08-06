// One shell for every free-tool page: nav, hero, the tool itself, its FAQ, the
// signup CTA, and the footer.
//
// JSON-LD IS BUILT FROM THE CONFIG AND THE COPY OBJECT — never hand-written per
// page. The FAQPage markup is generated from the same `faq` array the page
// renders below it, so the structured data cannot describe questions that are
// not on screen. That is the rule the Jul 31 pricing drift taught: a second
// copy of anything is a copy that will disagree.
//
// LOCALE MODEL: en/fr chrome bases like the rest of the marketing site; the
// tool BODY is English in every locale this pass.

import Link from "next/link";
import { PublicNav } from "../../PublicNav";
import { CONTENT } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/config";
import { JsonLd } from "@/lib/seo/JsonLd";
import { organization, webSite, faqPage } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import { FREE_TOOLS_BASE, signupHref, type FreeTool } from "@/lib/free-tools";
import type { ToolCopy } from "./copy";
import s from "../../home2.module.css";
import f from "./free-tools.module.css";

/** SoftwareApplication for an interactive tool, from the config + copy. */
function softwareNode(tool: FreeTool, copy: ToolCopy, pageUrl: string) {
  return {
    "@type": "SoftwareApplication",
    "@id": `${pageUrl}#tool`,
    name: copy.name,
    description: copy.metaDescription,
    url: pageUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    // It really is free and really needs no account; both are load-bearing
    // claims in the copy, so the markup says the same thing.
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export function FreeToolShell({
  locale,
  tool,
  copy,
  children,
}: {
  locale: string;
  tool: FreeTool;
  copy: ToolCopy;
  children: React.ReactNode;
}) {
  const foot = CONTENT[locale as Locale].footer;
  const L = (p: string) => `/${locale}${p.startsWith("/") ? p : `/${p}`}`;
  // Canonical is the en URL: the body is English in every locale this pass.
  const pageUrl = `${SITE_URL}/en${FREE_TOOLS_BASE}/${tool.slug}`;

  const graph = [
    organization(locale),
    webSite(locale),
    tool.jsonLd === "faq"
      ? faqPage(copy.faq, pageUrl)
      : softwareNode(tool, copy, pageUrl),
  ];

  return (
    <div className={s.page}>
      <JsonLd graph={graph} />
      <PublicNav locale={locale} />

      <div className={`${s.container} ${f.hero}`}>
        <p className={s.label}>
          <b>/ FREE TOOL</b>
        </p>
        <h1 className={f.heroH1}>{copy.name}</h1>
        <p className={f.heroSub}>{copy.intro}</p>
      </div>

      <section className={s.section} style={{ paddingTop: 24 }}>
        <div className={s.container}>
          <div className={f.tool}>
            {children}

            <p className={f.note}>{copy.limitNote}</p>

            <div className={f.upsell}>
              <p className={f.upsellP}>{copy.cta}</p>
              <Link className={`${s.btn} ${s.btnPrimary}`} href={signupHref(tool)}>
                {copy.cta} →
              </Link>
            </div>

            {copy.faq.length > 0 && (
              <div className={f.faq}>
                {copy.faq.map((entry) => (
                  <div className={f.faqItem} key={entry.q}>
                    <h2 className={f.faqQ}>{entry.q}</h2>
                    <p className={f.faqA}>{entry.a}</p>
                  </div>
                ))}
              </div>
            )}

            <p className={f.note} style={{ marginTop: 28 }}>
              <Link href={L(FREE_TOOLS_BASE)} style={{ color: "var(--gold, #e8c565)" }}>
                ← All free tools
              </Link>
            </p>
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
