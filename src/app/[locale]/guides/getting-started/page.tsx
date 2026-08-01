import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { GuideArticle, baseOf, type GuideDoc } from "../_shared/GuideArticle";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

const EN: GuideDoc = {
  title: "Getting started with Echorank",
  intro:
    "This is the shortest path from an empty account to a dashboard that reflects your real reputation. Work through it in order — each step feeds the next, and the whole thing takes about fifteen minutes.",
  needs: [
    "A website you control",
    "Access to your Google Business Profile",
    "About 15 minutes",
  ],
  steps: [
    {
      h: "Create your account",
      paras: [
        "Sign up with your name, work email, business name and a password. New accounts start on a 7-day free trial and no card is required, so you can complete this entire guide before deciding anything.",
        "Use the email you actually read. Alerts, review notifications and the reports you set up later all land there by default, and changing it afterwards means re-checking every destination.",
      ],
    },
    {
      h: "Name your business correctly",
      paras: [
        "The business name you enter becomes the tenant name — the label on reports, alert emails and anything you export or share with a client. Enter the name customers would recognise, matching how it appears on your Google listing.",
        "Getting this right now saves rework later: the name shows up in places you will not think to check until someone else sees them.",
      ],
      callout: {
        kind: "tip",
        body: "Running Echorank for clients? Confirm which tenant is active before you import anything. Reviews imported into the wrong tenant have to be cleaned out by hand, and the import will happily succeed.",
      },
    },
    {
      h: "Connect your Google Business Profile",
      paras: [
        "This is the step that turns an empty dashboard into a useful one. Connecting your Google Business Profile pulls in your existing reviews and keeps syncing as new ones arrive, so you stop finding out about a one-star two weeks late.",
        "You will be asked to authorise access through Google and then pick a listing. If your account manages several locations, take the extra few seconds to confirm you are choosing the right one.",
      ],
      shot: "The Google Business Profile connection screen, with the listing picker open.",
      callout: {
        kind: "warning",
        body: "Verify the listing before you confirm. If you manage multiple locations with similar names, connecting the wrong one imports the wrong review history — and the fix is disconnecting and starting over.",
      },
    },
    {
      h: "Run the free audit and keep the result",
      paras: [
        "Run the audit and save the result. This is your day-zero benchmark, and it is worth more than it looks: in six weeks it is the only honest answer to the question of whether any of this worked.",
        "The audit covers what crawlers and AI assistants can actually see on your site — technical basics, structured data, and the signals that decide whether an assistant can quote you at all. Read the itemised checks rather than just the score.",
      ],
      shot: "The audit result, showing the overall score with the itemised checks beneath it.",
    },
    {
      h: "Install the browser extension and import your history",
      paras: [
        "Google and Facebook do not offer an export button for your reviews. The browser extension reads them off the page and sends them to your dashboard, which is how you get years of history in rather than starting from today.",
        "Download and install it from the extension page, then use it on the review pages you want to bring in. Facebook and Trustpilot history come in the same way.",
      ],
    },
    {
      h: "Confirm the reviews arrived",
      paras: [
        "Open Monitoring and check your reviews are there. Each one is scored for sentiment and risk automatically, so the list should look like your actual review history rather than an empty page.",
        "If something is missing, it is almost always the import rather than the sync: re-run the extension on the page that is short, and check you were on the right listing when you did it.",
      ],
      callout: {
        kind: "note",
        body: "Nothing here is destructive. Re-running an import does not duplicate reviews that are already in, so if you are unsure whether a page imported, just run it again.",
      },
    },
  ],
  next: [
    { href: "/guides/audit-your-website", label: "Audit your website" },
    { href: "/guides/keyword-research", label: "Keyword research" },
    { href: "/extension/download.html", label: "Download the extension", external: true },
  ],
};

const FR: GuideDoc = {
  title: "Premiers pas avec Echorank",
  intro:
    "Voici le chemin le plus court entre un compte vide et un tableau de bord qui reflète votre réputation réelle. Suivez les étapes dans l'ordre — chacune alimente la suivante — et comptez une quinzaine de minutes.",
  needs: [
    "Un site web que vous contrôlez",
    "L'accès à votre fiche d'établissement Google",
    "Environ 15 minutes",
  ],
  steps: [
    {
      h: "Créez votre compte",
      paras: [
        "Inscrivez-vous avec votre nom, votre courriel professionnel, le nom de votre entreprise et un mot de passe. Les nouveaux comptes démarrent un essai gratuit de 7 jours, sans carte : vous pouvez donc suivre ce guide en entier avant de décider quoi que ce soit.",
        "Utilisez le courriel que vous consultez vraiment. Les alertes, les notifications d'avis et les rapports que vous configurerez ensuite y arrivent par défaut, et le changer plus tard oblige à vérifier chaque destination.",
      ],
    },
    {
      h: "Nommez correctement votre entreprise",
      paras: [
        "Le nom saisi devient le nom du compte : c'est l'étiquette qui apparaît sur les rapports, les courriels d'alerte et tout ce que vous exportez ou partagez avec un client. Entrez le nom que vos clients reconnaissent, tel qu'il figure sur votre fiche Google.",
        "Le corriger maintenant évite du retravail : ce nom apparaît à des endroits que vous ne penserez pas à vérifier avant que quelqu'un d'autre les voie.",
      ],
      callout: {
        kind: "tip",
        body: "Vous utilisez Echorank pour des clients ? Confirmez quel compte est actif avant d'importer quoi que ce soit. Des avis importés dans le mauvais compte doivent être nettoyés à la main, et l'import réussira sans broncher.",
      },
    },
    {
      h: "Connectez votre fiche d'établissement Google",
      paras: [
        "C'est l'étape qui transforme un tableau de bord vide en outil utile. La connexion importe vos avis existants et poursuit la synchronisation à mesure que de nouveaux arrivent : vous cessez d'apprendre une note d'une étoile deux semaines trop tard.",
        "Google vous demandera d'autoriser l'accès, puis de choisir une fiche. Si votre compte gère plusieurs établissements, prenez les quelques secondes nécessaires pour confirmer le bon.",
      ],
      shot: "L'écran de connexion à la fiche Google, avec le sélecteur d'établissement ouvert.",
      callout: {
        kind: "warning",
        body: "Vérifiez la fiche avant de confirmer. Si vous gérez plusieurs établissements aux noms proches, connecter le mauvais importe le mauvais historique — et il faut alors déconnecter et tout recommencer.",
      },
    },
    {
      h: "Lancez l'audit gratuit et conservez le résultat",
      paras: [
        "Lancez l'audit et enregistrez le résultat. C'est votre point de référence du jour zéro, et il vaut plus qu'il n'y paraît : dans six semaines, ce sera la seule réponse honnête à la question de savoir si tout cela a fonctionné.",
        "L'audit couvre ce que les robots et les assistants IA voient réellement de votre site : les bases techniques, les données structurées et les signaux qui déterminent si un assistant peut vous citer. Lisez les vérifications détaillées, pas seulement le score.",
      ],
      shot: "Le résultat de l'audit : le score global et, en dessous, les vérifications détaillées.",
    },
    {
      h: "Installez l'extension et importez votre historique",
      paras: [
        "Google et Facebook n'offrent pas de bouton d'export pour vos avis. L'extension de navigateur les lit directement sur la page et les envoie à votre tableau de bord : c'est ainsi que vous récupérez des années d'historique au lieu de repartir d'aujourd'hui.",
        "Téléchargez-la et installez-la depuis la page de l'extension, puis utilisez-la sur les pages d'avis à importer. L'historique Facebook et Trustpilot s'importe de la même façon.",
      ],
    },
    {
      h: "Vérifiez que les avis sont bien arrivés",
      paras: [
        "Ouvrez la surveillance et vérifiez que vos avis y sont. Chacun est évalué automatiquement pour le sentiment et le risque : la liste devrait ressembler à votre historique réel plutôt qu'à une page vide.",
        "S'il manque quelque chose, c'est presque toujours l'import et non la synchronisation : relancez l'extension sur la page incomplète et vérifiez que vous étiez bien sur la bonne fiche.",
      ],
      callout: {
        kind: "note",
        body: "Rien ici n'est destructif. Relancer un import ne duplique pas les avis déjà présents : dans le doute, relancez-le.",
      },
    },
  ],
  next: [
    { href: "/guides/audit-your-website", label: "Auditer votre site web" },
    { href: "/guides/keyword-research", label: "Recherche de mots-clés" },
    { href: "/extension/download.html", label: "Télécharger l'extension", external: true },
  ],
};

const DOCS = { en: EN, fr: FR };

const META = {
  en: {
    title: "Getting started with Echorank — setup guide",
    description:
      "From an empty account to a working dashboard in about 15 minutes: create your account, connect Google Business Profile, run your first audit and import your review history.",
  },
  fr: {
    title: "Premiers pas avec Echorank — guide de configuration",
    description:
      "D'un compte vide à un tableau de bord opérationnel en 15 minutes : créez votre compte, connectez votre fiche Google, lancez un premier audit et importez votre historique d'avis.",
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
    path: "/guides/getting-started",
    title: m.title,
    description: m.description,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  return <GuideArticle locale={locale} doc={DOCS[baseOf(locale)]} />;
}
