// /[locale]/free-audit — the standalone home of the anonymous audit funnel.
//
// Every "run the free audit" CTA on the site points here. The widget itself is
// the SAME component the /ai-visibility landing page mounts at #audit
// (src/components/AuditWidget.tsx) — it posts to /api/av/audit, which is in
// the proxy's publicExactPaths, so an anonymous visitor completes the whole
// flow without an account. Do not fork it: two copies of the funnel means two
// places to fix when the API contract moves.
//
// Layout follows the /about + /solutions pattern — home2.module.css on a
// wrapping .page, which is where the Binance palette (--bg #181A20,
// --gold #FCD535) is defined. The av-* rules below are the widget's own global
// class names, restyled onto those tokens; the /ai-visibility copy of them is
// on that page's older palette and is not shared.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { JsonLd, SITE_URL, buildMetadata, faqPage, normalizeLocale, organization } from "@/lib/seo";
import { AuditWidget, type AuditWidgetContent } from "@/components/AuditWidget";
import { PublicNav } from "../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import s from "../home2.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

/** en + fr are written; every other locale folds to en, same as PublicFooter. */
type Base = "en" | "fr";
const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

interface Copy {
  metaTitle: string;
  metaDescription: string;
  label: string;
  h1: string;
  heroSub: string;
  engines: string;
  whatLabel: string;
  whatTitle: string;
  whatItems: { h: string; p: string }[];
  howLabel: string;
  howTitle: string;
  howSteps: { h: string; p: string }[];
  ctaTitle: string;
  ctaP: string;
  ctaButton: string;
  faqLabel: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
  // ctaHref is locale-dependent, so it is injected at render rather than
  // written into each static copy block.
  widget: Omit<AuditWidgetContent, "ctaHref">;
}

const COPY: Record<Base, Copy> = {
  en: {
    metaTitle: "Free AI visibility audit — see what AI says about your business | Echorank360",
    metaDescription:
      "Run a free audit in 60 seconds. See whether ChatGPT, Claude, Gemini and Perplexity know your business — score, itemized checks, and a PDF report. No account, no card.",
    label: "FREE TOOL",
    h1: "Is your business the answer AI gives?",
    heroSub:
      "When customers ask ChatGPT, Claude, Gemini or Perplexity who to hire, someone gets named. Run a free audit and find out if it's you — no account, no card, results in about a minute.",
    engines: "Tracks answers from ChatGPT · Claude · Gemini · Perplexity",
    whatLabel: "WHAT YOU GET",
    whatTitle: "What you get",
    whatItems: [
      {
        h: "A visibility score",
        p: "One number, 0–100, showing how findable your business is to AI assistants and search engines today.",
      },
      {
        h: "Itemized checks",
        p: "Every check we run, pass or fail, in plain language — crawlability, structured data, content signals, and the gaps holding you back.",
      },
      {
        h: "A PDF worth keeping",
        p: "Download the full report and keep it as your day-zero baseline. Re-run later and measure the difference.",
      },
    ],
    howLabel: "HOW IT WORKS",
    howTitle: "How it works",
    howSteps: [
      { h: "Enter your domain", p: "Brand name or website — no signup form, no email gate." },
      {
        h: "We run the checks",
        p: "Your public pages are analyzed the way AI crawlers and search engines see them.",
      },
      { h: "Read your report", p: "Score, checks, and fixes — with the PDF one click away." },
    ],
    ctaTitle: "Want the full picture, every day?",
    ctaP: "The free audit is a snapshot. Echorank plans add daily answer tracking, scheduled monitoring, the complete SEO toolkit, and a prioritized roadmap to become the business AI recommends.",
    ctaButton: "See plans & pricing →",
    faqLabel: "FAQ",
    faqTitle: "Common questions",
    faq: [
      {
        q: "Is it really free?",
        a: "Yes. One audit per day, no account and no card. The audit is a genuinely useful standalone report — plans exist for businesses that want continuous tracking.",
      },
      {
        q: "What do you do with my domain?",
        a: "We analyze publicly available pages only. Nothing is published, and you won't be added to a mailing list.",
      },
      {
        q: "Which AI assistants are covered?",
        a: "The audit measures the signals ChatGPT, Claude, Gemini and Perplexity rely on when deciding which businesses to name.",
      },
    ],
    widget: {
      label: "Run a free basic audit",
      placeholder: "Your brand or domain, e.g. acme.com",
      runIdle: "Run free audit",
      runBusy: "Auditing…",
      noteTemplate: "Asking the AIs about “{brand}” — takes ~20 seconds.",
      errLimit: "Free audit limit reached for today. Sign up to run unlimited audits.",
      errGeneric: "The audit could not run. Try again in a minute.",
      fine: "No account needed. One audit per day.",
      resultAppearedIn: "appeared in",
      resultOfPrompts: "of test prompts",
      trustScore: "Trust Score",
      upsell:
        "This was 3 generic prompts, one engine pass. The full plan tracks 25 prompts of your choosing, weekly, with alerts when you drop out.",
      ctaTemplate: "Track {brand} with Echorank",
      again: "Run another audit",
      pdfIdle: "Download PDF report",
      pdfBusy: "Generating…",
      pdfErr: "The report could not be generated.",
      pdfRetry: "Try again",
    },
  },
  fr: {
    metaTitle:
      "Audit gratuit de visibilité IA — ce que l’IA dit de votre entreprise | Echorank360",
    metaDescription:
      "Lancez un audit gratuit en 60 secondes. Découvrez si ChatGPT, Claude, Gemini et Perplexity connaissent votre entreprise — score, vérifications détaillées et rapport PDF. Sans compte, sans carte.",
    label: "OUTIL GRATUIT",
    h1: "Votre entreprise est-elle la réponse que donne l’IA ?",
    heroSub:
      "Quand un client demande à ChatGPT, Claude, Gemini ou Perplexity à qui faire appel, un nom sort. Lancez un audit gratuit et voyez si c’est le vôtre — sans compte, sans carte, résultats en une minute environ.",
    engines: "Suit les réponses de ChatGPT · Claude · Gemini · Perplexity",
    whatLabel: "CE QUE VOUS OBTENEZ",
    whatTitle: "Ce que vous obtenez",
    whatItems: [
      {
        h: "Un score de visibilité",
        p: "Un seul chiffre, de 0 à 100, qui montre à quel point votre entreprise est repérable aujourd’hui par les assistants IA et les moteurs de recherche.",
      },
      {
        h: "Des vérifications détaillées",
        p: "Chaque contrôle effectué, réussi ou non, en langage clair — indexabilité, données structurées, signaux de contenu et les lacunes qui vous freinent.",
      },
      {
        h: "Un PDF à conserver",
        p: "Téléchargez le rapport complet et gardez-le comme point de départ. Relancez l’audit plus tard et mesurez le chemin parcouru.",
      },
    ],
    howLabel: "COMMENT ÇA MARCHE",
    howTitle: "Comment ça marche",
    howSteps: [
      {
        h: "Saisissez votre domaine",
        p: "Nom de marque ou site web — aucun formulaire d’inscription, aucune adresse e-mail exigée.",
      },
      {
        h: "Nous lançons les contrôles",
        p: "Vos pages publiques sont analysées telles que les robots d’IA et les moteurs de recherche les voient.",
      },
      {
        h: "Lisez votre rapport",
        p: "Score, contrôles et correctifs — le PDF est à un clic.",
      },
    ],
    ctaTitle: "Envie de la vue complète, chaque jour ?",
    ctaP: "L’audit gratuit est un instantané. Les forfaits Echorank ajoutent le suivi quotidien des réponses, la surveillance programmée, la boîte à outils SEO complète et une feuille de route priorisée pour devenir l’entreprise que l’IA recommande.",
    ctaButton: "Voir les forfaits et tarifs →",
    faqLabel: "FAQ",
    faqTitle: "Questions fréquentes",
    faq: [
      {
        q: "Est-ce vraiment gratuit ?",
        a: "Oui. Un audit par jour, sans compte ni carte bancaire. L’audit est un rapport autonome réellement utile — les forfaits existent pour les entreprises qui veulent un suivi continu.",
      },
      {
        q: "Que faites-vous de mon domaine ?",
        a: "Nous analysons uniquement des pages accessibles publiquement. Rien n’est publié et vous n’êtes ajouté à aucune liste de diffusion.",
      },
      {
        q: "Quels assistants IA sont couverts ?",
        a: "L’audit mesure les signaux sur lesquels ChatGPT, Claude, Gemini et Perplexity s’appuient pour décider quelles entreprises citer.",
      },
    ],
    widget: {
      label: "Lancez un audit de base gratuit",
      placeholder: "Votre marque ou domaine, p. ex. acme.com",
      runIdle: "Lancer l’audit gratuit",
      runBusy: "Audit en cours…",
      noteTemplate: "Interrogation des IA sur « {brand} » — environ 20 secondes.",
      errLimit:
        "Limite d’audit gratuit atteinte pour aujourd’hui. Inscrivez-vous pour des audits illimités.",
      errGeneric: "L’audit n’a pas pu s’exécuter. Réessayez dans une minute.",
      fine: "Aucun compte requis. Un audit par jour.",
      resultAppearedIn: "est apparu dans",
      resultOfPrompts: "des requêtes testées",
      trustScore: "Trust Score",
      upsell:
        "Il s’agissait de 3 requêtes génériques, un seul passage moteur. Le forfait complet suit 25 requêtes de votre choix, chaque semaine, avec des alertes quand vous décrochez.",
      ctaTemplate: "Suivre {brand} avec Echorank",
      again: "Lancer un autre audit",
      pdfIdle: "Télécharger le rapport PDF",
      pdfBusy: "Génération…",
      pdfErr: "Le rapport n’a pas pu être généré.",
      pdfRetry: "Réessayer",
    },
  },
};

/**
 * The widget's own class names are global (it predates the CSS-module pages),
 * so its styling has to be global too. Every colour reads a token defined on
 * .page in home2.module.css — no literal gold, so the page follows the palette
 * rather than pinning a second copy of it.
 */
const CSS = `
.av-audit { margin: 28px 0 0; max-width: 34rem; }
.av-audit-label { display:block; font-weight:650; font-size:15px; margin-bottom:10px; color:var(--text); }
.av-audit-row { display:flex; gap:10px; flex-wrap:wrap; }
.av-audit-row input {
  flex:1; min-width:230px; padding:0 16px; height:52px; border-radius:10px;
  border:1px solid var(--line); background:var(--surface); color:var(--text); font:inherit; font-size:15px;
}
.av-audit-row input::placeholder { color:var(--faint); }
.av-audit-row input:focus-visible { outline:2px solid var(--gold); outline-offset:2px; }
.av-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  height:52px; padding:0 26px; border-radius:10px; border:1px solid transparent;
  font:inherit; font-size:15.5px; font-weight:700; letter-spacing:.2px;
  transition:transform .15s, box-shadow .15s;
}
.av-btn:hover:not(:disabled) { transform:translateY(-1px); }
.av-btn:disabled { opacity:.55; cursor:not-allowed; transform:none; }
/* Dark text on yellow — white on #FCD535 is ~1.6:1 and unreadable. */
.av-btn-gold { background:var(--goldGrad); color:var(--bg); box-shadow:0 8px 30px -10px rgba(240,185,11,.45); }
.av-btn-ghost { border-color:var(--line); color:var(--text); background:rgba(255,255,255,.02); font-weight:600; }
.av-btn-block { display:flex; width:100%; margin-top:10px; }
.av-audit-note { color:var(--muted); font-size:13.5px; margin-top:10px; }
.av-audit-err { color:var(--red); font-size:14px; margin-top:10px; }
.av-audit-fine { color:var(--faint); font-size:12.5px; margin-top:10px; }
.av-audit-result {
  background:var(--surface); border:1px solid var(--line);
  border-radius:var(--radius); padding:24px;
}
.av-audit-headline { font-size:16.5px; line-height:1.5; margin:0 0 14px; }
.av-gold { color:var(--gold); font-weight:700; }
.av-audit-engines { list-style:none; padding:0; margin:0 0 14px; display:flex; gap:8px; flex-wrap:wrap; }
.av-audit-engines li {
  font-size:12.5px; padding:4px 10px; border-radius:99px;
  border:1px solid var(--line); color:var(--muted);
}
.av-audit-engines .av-hit { color:var(--gold); border-color:rgba(252,213,53,.4); }
.av-audit-engines .av-miss { color:var(--faint); }
.av-audit-sample {
  margin:0 0 14px; padding:12px 16px; border-left:2px solid var(--gold);
  background:rgba(255,255,255,.02); color:var(--muted); font-size:14px; line-height:1.6;
}
.av-audit-upsell { color:var(--muted); font-size:14px; line-height:1.6; }
.av-audit-again { display:block; margin-top:14px; text-align:center; color:var(--faint); font-size:13px; text-decoration:underline; }
.av-audit-again:hover { color:var(--gold); }
`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const c = COPY[baseOf(locale)];
  return buildMetadata({
    locale,
    path: "/free-audit",
    title: c.metaTitle,
    description: c.metaDescription,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const c = COPY[baseOf(locale)];
  const L = (p: string) => `/${locale}${p}`;
  const l = normalizeLocale(locale);
  const pageUrl = `${SITE_URL}/${l}/free-audit`;

  return (
    <div className={s.page}>
      <style>{CSS}</style>
      <JsonLd
        graph={[
          organization(l),
          {
            "@type": "WebPage",
            "@id": `${pageUrl}#webpage`,
            url: pageUrl,
            name: c.metaTitle,
            description: c.metaDescription,
            inLanguage: l,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
          faqPage(c.faq, pageUrl),
        ]}
      />

      <PublicNav locale={locale} />

      <section className={s.hero}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 01</b> — {c.label}
          </p>
          <h1 className={s.h1}>{c.h1}</h1>
          <p className={s.sub}>{c.heroSub}</p>

          <AuditWidget c={{ ...c.widget, ctaHref: L("/pricing") }} />

          <p className={s.label} style={{ marginTop: 18 }}>
            {c.engines}
          </p>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 02</b> — {c.whatLabel}
          </p>
          <h2 className={s.h2}>{c.whatTitle}</h2>
          <div className={s.ucGrid} style={{ marginTop: 28 }}>
            {c.whatItems.map((it) => (
              <div key={it.h} className={s.ucCard}>
                <span className={s.ucTitle}>{it.h}</span>
                <span className={s.ucBody}>{it.p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 03</b> — {c.howLabel}
          </p>
          <h2 className={s.h2}>{c.howTitle}</h2>
          <div className={s.ucGrid} style={{ marginTop: 28 }}>
            {c.howSteps.map((step, i) => (
              <div key={step.h} className={s.ucCard}>
                <span className={s.label}>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                </span>
                <span className={s.ucTitle}>{step.h}</span>
                <span className={s.ucBody}>{step.p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <h2 className={s.h2}>{c.ctaTitle}</h2>
          <p className={s.sub}>{c.ctaP}</p>
          <div className={s.ctarow} style={{ marginTop: 22 }}>
            {/* House rule: the primary marketing CTA goes to pricing, never
                straight to /register. */}
            <Link className={`${s.btn} ${s.btnPrimary}`} href={L("/pricing")}>
              {c.ctaButton}
            </Link>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 04</b> — {c.faqLabel}
          </p>
          <h2 className={s.h2}>{c.faqTitle}</h2>
          <div className={s.faq}>
            {c.faq.map((it) => (
              <div className={s.faqItem} key={it.q}>
                <p className={s.faqQ}>{it.q}</p>
                <p className={s.faqA}>{it.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter locale={locale} />
    </div>
  );
}
