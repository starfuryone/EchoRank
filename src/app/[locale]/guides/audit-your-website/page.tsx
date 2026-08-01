import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { GuideArticle, baseOf, type GuideDoc } from "../_shared/GuideArticle";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

const EN: GuideDoc = {
  title: "Audit your website",
  intro:
    "An audit tells you what a crawler — and an AI assistant — can actually see on your site. This guide covers running one, reading the result without drowning in it, and fixing things in the order that actually moves the score.",
  needs: ["Your website URL", "About 20 minutes", "Access to change your site, or someone who has it"],
  steps: [
    {
      h: "Run the free audit",
      paras: [
        "Start from the audit widget on the homepage. It runs without an account and is limited to one run per address per day, which is enough to establish a baseline and re-check after a round of fixes.",
        "Enter the page you actually want people to land on. Auditing your homepage when your money page is a service page tells you about the wrong page.",
      ],
      shot: "The homepage audit widget with a URL entered, before running.",
    },
    {
      h: "Read the score, then ignore it",
      paras: [
        "The overall score is a summary, not a diagnosis. What matters is the itemised checks underneath: technical basics, structured data, whether crawlers are allowed in at all, and the AI-visibility signals.",
        "Read the failures in full before you touch anything. A single robots rule blocking a directory can produce a dozen downstream failures that all disappear when you fix the one line.",
      ],
      shot: "The itemised check list, with passes and failures grouped by category.",
    },
    {
      h: "Fix in the right order",
      paras: [
        "Crawlability first. If a crawler cannot reach a page, nothing else about that page matters — not the structured data, not the content. That means HTTPS working properly, no accidental blocks, and pages that respond on mobile.",
        "Structured data second. LocalBusiness and FAQPage markup are what let an assistant quote you as a fact rather than guess from prose. This is usually the highest-value work per hour on the whole list.",
        "Content gaps last. They matter, but they are slow, and doing them before the first two means writing pages that nothing can read.",
      ],
      callout: {
        kind: "tip",
        body: "Fix one category, re-run, and look at the diff. Changing ten things at once and re-running tells you the score moved but not which change did it — which is the information you actually wanted.",
      },
    },
    {
      h: "Use Audit Site and Lighthouse for ongoing checks",
      paras: [
        "The free widget is a spot check. Inside the tools hub, Audit Site covers your site on an ongoing basis and Lighthouse covers speed and Core Web Vitals, which is where most technical fixes are verified.",
        "Speed is not a vanity metric here. A page that takes too long is a page that gets crawled less thoroughly, which feeds directly back into the audit results you are trying to improve.",
      ],
    },
    {
      h: "Re-run and compare",
      paras: [
        "After a round of fixes, run the audit again and compare it to the result you saved. This is the loop: measure, fix one category, measure again.",
        "Expect structured data and crawlability fixes to show up immediately. Content changes take longer, because something has to come back and read them before anything reflects the change.",
      ],
      callout: {
        kind: "note",
        body: "An audit measures what crawlers see, not what a person sees. A page can look perfect in your browser and be nearly empty to a crawler that does not run JavaScript — AI Lens is the tool that shows you that gap directly.",
      },
    },
  ],
  next: [
    { href: "/guides/ai-visibility", label: "AI visibility" },
    { href: "/guides/keyword-research", label: "Keyword research" },
    { href: "/guides/getting-started", label: "Getting started" },
  ],
};

const FR: GuideDoc = {
  title: "Auditer votre site web",
  intro:
    "Un audit vous dit ce qu'un robot — et un assistant IA — voit réellement de votre site. Ce guide couvre son lancement, la lecture du résultat sans s'y noyer, et l'ordre des correctifs qui fait réellement bouger le score.",
  needs: [
    "L'adresse de votre site",
    "Environ 20 minutes",
    "L'accès pour modifier le site, ou la personne qui l'a",
  ],
  steps: [
    {
      h: "Lancez l'audit gratuit",
      paras: [
        "Partez du widget d'audit sur la page d'accueil. Il fonctionne sans compte et se limite à un lancement par adresse et par jour, ce qui suffit pour établir une référence et re-vérifier après une série de correctifs.",
        "Saisissez la page sur laquelle vous voulez vraiment que les gens arrivent. Auditer votre accueil alors que votre page décisive est une page de service vous renseigne sur la mauvaise page.",
      ],
      shot: "Le widget d'audit de la page d'accueil, une URL saisie, avant lancement.",
    },
    {
      h: "Lisez le score, puis oubliez-le",
      paras: [
        "Le score global est un résumé, pas un diagnostic. Ce qui compte, ce sont les vérifications détaillées en dessous : bases techniques, données structurées, accès des robots, et les signaux de visibilité IA.",
        "Lisez les échecs en entier avant de toucher à quoi que ce soit. Une seule règle robots bloquant un répertoire peut produire une douzaine d'échecs en cascade qui disparaissent tous en corrigeant la ligne d'origine.",
      ],
      shot: "La liste détaillée des vérifications, réussites et échecs groupés par catégorie.",
    },
    {
      h: "Corrigez dans le bon ordre",
      paras: [
        "L'accessibilité d'abord. Si un robot ne peut pas atteindre une page, rien d'autre ne compte pour cette page — ni les données structurées, ni le contenu. Cela suppose un HTTPS correct, aucun blocage accidentel, et des pages qui répondent sur mobile.",
        "Les données structurées ensuite. Le balisage LocalBusiness et FAQPage est ce qui permet à un assistant de vous citer comme un fait plutôt que de deviner à partir d'un texte. C'est généralement le meilleur rapport valeur/heure de toute la liste.",
        "Les lacunes de contenu en dernier. Elles comptent, mais elles sont lentes, et les traiter avant les deux premières revient à écrire des pages que rien ne peut lire.",
      ],
      callout: {
        kind: "tip",
        body: "Corrigez une catégorie, relancez, et regardez l'écart. Changer dix choses d'un coup puis relancer vous dit que le score a bougé, mais pas grâce à quoi — soit exactement l'information que vous cherchiez.",
      },
    },
    {
      h: "Utilisez Audit Site et Lighthouse en continu",
      paras: [
        "Le widget gratuit est un contrôle ponctuel. Dans le hub d'outils, Audit Site couvre votre site en continu et Lighthouse couvre la vitesse et les Core Web Vitals, là où se vérifient la plupart des correctifs techniques.",
        "La vitesse n'est pas une métrique de vanité ici. Une page trop lente est une page moins bien explorée, ce qui se répercute directement sur les résultats d'audit que vous cherchez à améliorer.",
      ],
    },
    {
      h: "Relancez et comparez",
      paras: [
        "Après une série de correctifs, relancez l'audit et comparez au résultat conservé. C'est la boucle : mesurer, corriger une catégorie, mesurer à nouveau.",
        "Attendez-vous à ce que les correctifs de données structurées et d'accessibilité apparaissent immédiatement. Les changements de contenu prennent plus de temps : il faut que quelque chose revienne les lire.",
      ],
      callout: {
        kind: "note",
        body: "Un audit mesure ce que voient les robots, pas ce que voit une personne. Une page peut être parfaite dans votre navigateur et quasi vide pour un robot qui n'exécute pas JavaScript — AI Lens est l'outil qui montre cet écart directement.",
      },
    },
  ],
  next: [
    { href: "/guides/ai-visibility", label: "Visibilité IA" },
    { href: "/guides/keyword-research", label: "Recherche de mots-clés" },
    { href: "/guides/getting-started", label: "Premiers pas" },
  ],
};

const DOCS = { en: EN, fr: FR };
const META = {
  en: {
    title: "Audit your website — what crawlers and AI actually see",
    description:
      "Run the free audit, read the itemised checks, and fix in the order that moves the score: crawlability first, structured data second, content last.",
  },
  fr: {
    title: "Auditer votre site web — ce que voient les robots et l'IA",
    description:
      "Lancez l'audit gratuit, lisez les vérifications détaillées et corrigez dans le bon ordre : accessibilité d'abord, données structurées ensuite, contenu en dernier.",
  },
};

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const m = META[baseOf(locale)];
  return buildMetadata({
    locale: locale as Locale,
    path: "/guides/audit-your-website",
    title: m.title,
    description: m.description,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  return <GuideArticle locale={locale} doc={DOCS[baseOf(locale)]} />;
}
