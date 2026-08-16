// /[locale]/ai-assistant — the public Echorank assistant.
//
// ANONYMOUS BY DESIGN. The page needs no proxy entry of its own: the proxy
// treats any path whose first segment is a supported locale as public (see
// src/proxy.ts). Its API does need one, and has it — /api/assistant/chat is an
// exact entry in publicExactPaths, origin-checked like /api/av/audit.
//
// Layout follows the /free-audit + /about pattern: home2.module.css on a
// wrapping .page, which is where the Binance palette (--bg #181A20, --gold
// #FCD535) is defined. The widget's own class names are global — it predates
// nothing, but it is mounted inside this page and styled from these tokens, so
// no literal colour appears below.
//
// FIVE PUBLIC LOCALES, TWO WRITTEN CATALOGUES. en + fr are written; en-CA folds
// to en, fr-CA to fr, de-CH shows English — the same fold PublicFooter and every
// other marketing page uses. This is the marketing locale model, NOT the three
// authenticated dashboard catalogues.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { JsonLd, SITE_URL, buildMetadata, faqPage, normalizeLocale, organization } from "@/lib/seo";
import { assistantEnabled } from "@/lib/assistant/config";
import { AssistantChat, type AssistantChatContent } from "./AssistantChat";
import { PublicNav } from "../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import s from "../home2.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Base = "en" | "fr";
const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

interface Copy {
  metaTitle: string;
  metaDescription: string;
  label: string;
  h1: string;
  heroSub: string;
  howLabel: string;
  howTitle: string;
  howSteps: { h: string; p: string }[];
  whatLabel: string;
  whatTitle: string;
  whatItems: { h: string; p: string }[];
  faqLabel: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
  chat: Omit<AssistantChatContent, "ctaHref">;
}

const COPY: Record<Base, Copy> = {
  en: {
    metaTitle: "Ask Echorank AI — free AI visibility assistant | Echorank360",
    metaDescription:
      "Ask the Echorank assistant anything about AI visibility, then scan your own site. It checks what ChatGPT, Claude, Gemini and Perplexity can actually read, and tells you what to fix. No account, no card.",
    label: "FREE, NO ACCOUNT",
    h1: "Ask Echorank AI",
    heroSub:
      "Paste your domain and get the real reasons AI assistants are not recommending you — crawler access, structured data, content signals — with the fix for each. Or just ask a question; the assistant answers in plain language.",
    howLabel: "HOW IT WORKS",
    howTitle: "How it works",
    howSteps: [
      {
        h: "Ask, or enter your domain",
        p: "No signup form and no email gate. Type a question, or drop in a website address.",
      },
      {
        h: "Echorank runs the checks",
        p: "Your public pages are read the way answer-engine crawlers read them. Every finding below the answer is measured, not guessed.",
      },
      {
        h: "You get the fix, not a lecture",
        p: "Each finding comes with the concrete change to make. Ask follow-up questions until it makes sense.",
      },
    ],
    whatLabel: "WHAT IT CHECKS",
    whatTitle: "What it checks",
    whatItems: [
      {
        h: "Crawler access",
        p: "Whether robots.txt lets GPTBot, ClaudeBot, PerplexityBot and Google-Extended read your site at all — the single most common reason a business is invisible to AI answers.",
      },
      {
        h: "Machine-readable identity",
        p: "Organization schema, llms.txt, sitemap, titles and headings: the signals an assistant uses to work out who you are and what you sell.",
      },
      {
        h: "What a crawler actually sees",
        p: "Whether your pages need JavaScript to show their content. Most answer-engine crawlers do not run it, so what they see can be an empty page.",
      },
    ],
    faqLabel: "QUESTIONS",
    faqTitle: "Common questions",
    faq: [
      {
        q: "Do I need an account?",
        a: "No. The assistant and one site scan a day are free and anonymous. An account raises the limits and keeps a history of your scans.",
      },
      {
        q: "Is my conversation stored?",
        a: "No. Anonymous conversations live in your browser tab only — nothing is written to our database. Site scan results are cached for a day, keyed by domain, because they describe public pages anyone can read.",
      },
      {
        q: "Can it scan any website?",
        a: "Any public one. It reads the same pages a search engine or an AI crawler reads, and it will not touch private addresses or internal hosts.",
      },
      {
        q: "How accurate are the findings?",
        a: "The findings are measured, not written by the model — the same checks the paid Echorank audit runs. The assistant explains them; it does not invent them.",
      },
      {
        q: "Can it help with billing or refunds?",
        a: "No. Refunds, VAT, invoicing and enterprise pricing go to support@echorank360.com, where a human will answer.",
      },
    ],
    chat: {
      scanLabel: "Scan a website",
      scanPlaceholder: "yourdomain.com",
      scanIdle: "Scan it",
      scanBusy: "Scanning…",
      askLabel: "Ask a question",
      askPlaceholder: "Why don't AI assistants mention my business?",
      askIdle: "Ask",
      askBusy: "Thinking…",
      intro:
        "Ask anything about AI visibility, or scan your site above and I'll walk you through what I find.",
      suggestions: [
        "What is AI visibility?",
        "Why would ChatGPT not know my business?",
        "What is llms.txt and do I need one?",
      ],
      you: "You",
      assistant: "Echorank",
      scoreLabel: "visibility score",
      gradeLabel: "Grade",
      criticalLabel: "critical",
      warningLabel: "to improve",
      okLabel: "passing",
      fixLabel: "Fix:",
      remainingTemplate: "{n} free messages left today.",
      errGeneric: "That did not go through. Try again in a moment.",
      errNetwork: "We could not reach the assistant. Check your connection and try again.",
      disabled: "The Echorank assistant is offline for maintenance. Try again shortly.",
      ctaTitle: "Want this watched for you?",
      ctaBody:
        "Echorank re-runs these checks on a schedule, tracks what assistants say about you across four engines, and tells you the week you stop being recommended.",
      ctaButton: "See plans",
      fine: "Free and anonymous. One site scan a day per visitor.",
    },
  },

  fr: {
    metaTitle: "Demandez à Echorank AI — assistant de visibilité IA gratuit | Echorank360",
    metaDescription:
      "Posez vos questions sur la visibilité IA, puis analysez votre site. L'assistant vérifie ce que ChatGPT, Claude, Gemini et Perplexity peuvent réellement lire, et indique quoi corriger. Sans compte, sans carte.",
    label: "GRATUIT, SANS COMPTE",
    h1: "Demandez à Echorank AI",
    heroSub:
      "Indiquez votre domaine et découvrez les vraies raisons pour lesquelles les assistants IA ne vous recommandent pas — accès des robots, données structurées, signaux de contenu — avec la correction pour chacune. Ou posez simplement une question : l'assistant répond en langage clair.",
    howLabel: "COMMENT ÇA MARCHE",
    howTitle: "Comment ça marche",
    howSteps: [
      {
        h: "Posez une question, ou entrez votre domaine",
        p: "Aucun formulaire d'inscription, aucune adresse e-mail exigée. Tapez une question ou saisissez une adresse de site.",
      },
      {
        h: "Echorank effectue les contrôles",
        p: "Vos pages publiques sont lues comme les robots des moteurs de réponse les lisent. Chaque constat affiché est mesuré, pas deviné.",
      },
      {
        h: "Vous obtenez la correction, pas un cours",
        p: "Chaque constat s'accompagne du changement concret à effectuer. Posez vos questions jusqu'à ce que ce soit clair.",
      },
    ],
    whatLabel: "CE QUI EST VÉRIFIÉ",
    whatTitle: "Ce qui est vérifié",
    whatItems: [
      {
        h: "L'accès des robots",
        p: "Votre robots.txt autorise-t-il GPTBot, ClaudeBot, PerplexityBot et Google-Extended à lire votre site — la raison la plus fréquente d'une invisibilité totale dans les réponses IA.",
      },
      {
        h: "Une identité lisible par les machines",
        p: "Schéma Organization, llms.txt, sitemap, titres et intertitres : les signaux qu'un assistant utilise pour comprendre qui vous êtes et ce que vous vendez.",
      },
      {
        h: "Ce qu'un robot voit vraiment",
        p: "Vos pages ont-elles besoin de JavaScript pour afficher leur contenu ? La plupart des robots des moteurs de réponse ne l'exécutent pas : ils peuvent ne voir qu'une page vide.",
      },
    ],
    faqLabel: "QUESTIONS",
    faqTitle: "Questions fréquentes",
    faq: [
      {
        q: "Faut-il un compte ?",
        a: "Non. L'assistant et une analyse de site par jour sont gratuits et anonymes. Un compte augmente les limites et conserve l'historique de vos analyses.",
      },
      {
        q: "Ma conversation est-elle enregistrée ?",
        a: "Non. Les conversations anonymes restent dans votre onglet — rien n'est écrit dans notre base de données. Les résultats d'analyse sont mis en cache une journée, par domaine, car ils décrivent des pages publiques que tout le monde peut lire.",
      },
      {
        q: "Peut-il analyser n'importe quel site ?",
        a: "Tout site public. Il lit les mêmes pages qu'un moteur de recherche ou un robot IA, et ne touche jamais aux adresses privées ni aux hôtes internes.",
      },
      {
        q: "Les constats sont-ils fiables ?",
        a: "Ils sont mesurés, pas rédigés par le modèle — ce sont les contrôles de l'audit Echorank payant. L'assistant les explique, il ne les invente pas.",
      },
      {
        q: "Peut-il traiter la facturation ou un remboursement ?",
        a: "Non. Remboursements, TVA, facturation et tarifs entreprise passent par support@echorank360.com, où une personne vous répondra.",
      },
    ],
    chat: {
      scanLabel: "Analyser un site",
      scanPlaceholder: "votredomaine.com",
      scanIdle: "Analyser",
      scanBusy: "Analyse en cours…",
      askLabel: "Poser une question",
      askPlaceholder: "Pourquoi les assistants IA ne citent-ils pas mon entreprise ?",
      askIdle: "Envoyer",
      askBusy: "Réflexion…",
      intro:
        "Posez n'importe quelle question sur la visibilité IA, ou analysez votre site ci-dessus et je vous expliquerai ce que je trouve.",
      suggestions: [
        "Qu'est-ce que la visibilité IA ?",
        "Pourquoi ChatGPT ne connaît-il pas mon entreprise ?",
        "Qu'est-ce que llms.txt et m'en faut-il un ?",
      ],
      you: "Vous",
      assistant: "Echorank",
      scoreLabel: "score de visibilité",
      gradeLabel: "Note",
      criticalLabel: "critiques",
      warningLabel: "à améliorer",
      okLabel: "validés",
      fixLabel: "Correction :",
      remainingTemplate: "{n} messages gratuits restants aujourd'hui.",
      errGeneric: "Cela n'a pas fonctionné. Réessayez dans un instant.",
      errNetwork: "Impossible de joindre l'assistant. Vérifiez votre connexion et réessayez.",
      disabled: "L'assistant Echorank est hors ligne pour maintenance. Réessayez bientôt.",
      ctaTitle: "Vous voulez que ce soit surveillé pour vous ?",
      ctaBody:
        "Echorank relance ces contrôles régulièrement, suit ce que les assistants disent de vous sur quatre moteurs et vous prévient la semaine où vous cessez d'être recommandé.",
      ctaButton: "Voir les forfaits",
      fine: "Gratuit et anonyme. Une analyse de site par jour et par visiteur.",
    },
  },
};

/**
 * The widget's class names are global, so its styling has to be too. Every
 * colour reads a token defined on .page in home2.module.css — no literal gold,
 * so the panel follows the palette rather than pinning a second copy of it.
 */
const CSS = `
.ai-panel { margin: 28px 0 0; max-width: 46rem; }
.ai-label { display:block; font-weight:650; font-size:15px; margin:18px 0 10px; color:var(--text); }
.ai-row { display:flex; gap:10px; flex-wrap:wrap; }
.ai-row input {
  flex:1; min-width:230px; padding:0 16px; height:52px; border-radius:10px;
  border:1px solid var(--line); background:var(--surface); color:var(--text);
  font:inherit; font-size:15px;
}
.ai-row input::placeholder { color:var(--faint); }
.ai-row input:focus-visible { outline:2px solid var(--gold); outline-offset:2px; }
.ai-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  height:52px; padding:0 26px; border-radius:10px; border:1px solid transparent;
  font:inherit; font-size:15.5px; font-weight:700; letter-spacing:.2px;
  transition:transform .15s, box-shadow .15s;
}
.ai-btn:hover:not(:disabled) { transform:translateY(-1px); }
.ai-btn:disabled { opacity:.55; cursor:not-allowed; transform:none; }
/* Dark text on yellow — white on #FCD535 is ~1.6:1 and unreadable. */
.ai-btn-gold { background:var(--goldGrad); color:var(--bg); box-shadow:0 8px 30px -10px rgba(240,185,11,.45); }
.ai-btn-block { display:flex; width:100%; margin-top:12px; }
.ai-log {
  margin-top:18px; max-height:520px; overflow-y:auto;
  background:var(--surface); border:1px solid var(--line);
  border-radius:var(--radius); padding:20px;
}
.ai-intro { color:var(--muted); font-size:14.5px; line-height:1.6; margin:0; }
.ai-msg { padding:14px 0; border-top:1px solid var(--lineSoft); }
.ai-msg:first-child { border-top:none; padding-top:0; }
.ai-who {
  display:block; font-family:var(--mono); font-size:11px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--faint); margin-bottom:6px;
}
.ai-msg-user .ai-who { color:var(--gold); }
.ai-text { margin:0 0 8px; font-size:15px; line-height:1.65; color:var(--text); }
.ai-msg-user .ai-text { color:var(--muted); }
.ai-chips { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
.ai-chip {
  border:1px solid var(--line); background:rgba(255,255,255,.02); color:var(--muted);
  border-radius:99px; padding:8px 14px; font:inherit; font-size:13.5px;
}
.ai-chip:hover:not(:disabled) { color:var(--gold); border-color:rgba(252,213,53,.4); }
.ai-chip:disabled { opacity:.5; cursor:not-allowed; }
.ai-err { color:var(--red); font-size:14px; margin-top:10px; }
.ai-fine { color:var(--faint); font-size:12.5px; margin-top:10px; }
.ai-disabled { color:var(--muted); font-size:15px; line-height:1.6; margin:0;
  background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:20px; }
.ai-scan {
  margin-top:12px; background:rgba(255,255,255,.02);
  border:1px solid var(--line); border-radius:12px; padding:16px;
}
.ai-scan-head { display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; }
.ai-scan-domain { font-weight:700; font-size:15px; color:var(--text); }
.ai-scan-score b { font-size:26px; color:var(--gold); }
.ai-scan-score span { color:var(--faint); font-size:12.5px; margin-left:4px; }
.ai-scan-grade {
  font-family:var(--mono); font-size:12px; letter-spacing:.1em;
  border:1px solid rgba(252,213,53,.4); color:var(--gold);
  border-radius:99px; padding:3px 10px;
}
.ai-scan-counts { color:var(--muted); font-size:13px; margin:10px 0 0; }
.ai-findings { list-style:none; padding:0; margin:12px 0 0; display:grid; gap:10px; }
.ai-findings li {
  border-left:2px solid var(--line); padding:2px 0 2px 12px; display:grid; gap:3px;
}
.ai-sev-critical { border-left-color:var(--red) !important; }
.ai-sev-warning { border-left-color:var(--gold) !important; }
.ai-sev-ok { border-left-color:var(--green) !important; }
.ai-finding-title { font-weight:650; font-size:14.5px; color:var(--text); }
.ai-finding-body { color:var(--muted); font-size:13.5px; line-height:1.55; }
.ai-finding-fix { color:var(--faint); font-size:13px; line-height:1.55; }
.ai-cta {
  margin-top:18px; background:var(--surface); border:1px solid var(--line);
  border-radius:var(--radius); padding:20px; display:grid; gap:6px;
}
.ai-cta-title { font-weight:700; font-size:16px; color:var(--text); }
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
    path: "/ai-assistant",
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
  const pageUrl = `${SITE_URL}/${l}/ai-assistant`;

  // Read at render, not at module load: the page may be edge-cached, so the API
  // is the authoritative gate. This only spares a visitor from typing into a box
  // that is going to refuse them.
  const enabled = assistantEnabled();

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

      <PublicNav locale={locale} current="ai-assistant" />

      <section className={s.hero}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 01</b> — {c.label}
          </p>
          <h1 className={s.h1}>{c.h1}</h1>
          <p className={s.sub}>{c.heroSub}</p>

          <AssistantChat
            c={{ ...c.chat, ctaHref: L("/pricing") }}
            locale={locale}
            enabled={enabled}
          />
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 02</b> — {c.howLabel}
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
          <p className={s.label}>
            <b>/ 03</b> — {c.whatLabel}
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
          <div className={s.ctarow} style={{ marginTop: 28 }}>
            {/* House rule: the primary marketing CTA goes to pricing, never
                straight to /register. */}
            <Link className={`${s.btn} ${s.btnPrimary}`} href={L("/pricing")}>
              {c.chat.ctaButton}
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
