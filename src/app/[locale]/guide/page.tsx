import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import lp from "../legal/legal.module.css";
import BackButton from "../legal/back-button";
import { buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Doc = { title: string; updated: string; intro: string; sections: { h: string; ps: string[]; bullets?: string[] }[] };

const EN: Doc = {
  title: "Echorank User Guide",
  updated: "Last updated: July 6, 2026",
  intro: "By the end of this guide you will have connected your Google Business Profile, imported your review history, launched your first review campaign, set up alerts, and run your first AI visibility audit. The full setup takes under 30 minutes. This guide covers every feature of Echorank in plain language: what it does, where to find it, and how to get value from it on day one. Feature availability by plan is noted where it applies.",
  sections: [
    { h: "Your first 30 minutes", ps: [
      "The full setup, in order. When every box is ticked, the platform is watching your reputation around the clock.",
    ], bullets: [
      "☐ Create your account (7 day trial, no card)",
      "☐ Connect your Google Business Profile",
      "☐ Connect your website domain",
      "☐ Import historical reviews (extension or CSV)",
      "☐ Add your customer list",
      "☐ Launch your first review campaign",
      "☐ Set alert destination addresses",
      "☐ Run your first AI visibility audit (Growth and above)",
      "☐ Add a competitor (Growth and above)",
      "☐ Check your Reputation Risk Score (Growth and above)",
    ] },

    { h: "Why businesses need Google review management software", ps: [
      "Google review management software is not just a tool for handling reviews. It is a strategic asset, for a single location shop as much as for multinationals and enterprises. Here is what the right platform brings:",
    ], bullets: [
      "Brand image and personalization: every review answered in a consistent voice, at scale.",
      "Multi location and multilingual management: one place for every location and every language your customers write in.",
      "Efficiency: reading, drafting and routing are automated, so minutes replace hours.",
      "Measure customer satisfaction with sentiment analysis: every review and comment is scored, so satisfaction becomes a trend you can watch instead of a guess.",
      "Risk mitigation: recurring complaints and suspicious review activity surface before they become crises.",
      "Drive business decisions: scores, deltas and revenue at risk turn reputation into numbers a leadership team can act on.",
      "Competitive intelligence: daily competitor snapshots show who is gaining ground and when.",
    ]},
    { h: "1. Create your account", ps: [
      "Go to the register page, enter your name, work email, business name and a password of at least 8 characters. Every new account starts a 7 day free trial with no credit card required. Nothing is charged unless you subscribe.",
      "You can invite teammates later from the Team page. The person who creates the account is the owner.",
    ]},
    { h: "2. Connect your sources", ps: [
      "Three connections give the platform everything it needs. First, your Google Business Profile: connecting it imports your reviews and starts scoring immediately. Second, your other review sources from the Monitoring page: each configured source syncs new reviews as they arrive. Third, your website: enter your domain and the first AI visibility audit runs within minutes.",
      "History matters. Use the browser extension or a CSV import to bring in past reviews and customers so your scores start with context instead of a blank slate.",
    ]},
    { h: "3. The dashboard", ps: [
      "The dashboard is your daily view: recent reviews, feedback activity, campaign performance and the state of your reputation intelligence. Deeper views live under Intelligence for risk and competitors, Monitoring for sources and reviews, and Campaigns for outreach.",
    ]},
    { h: "4. Review campaigns", ps: [
      "Campaigns ask your customers for reviews at the right moment, over email and SMS. Create a campaign from the Campaigns page, pick or write a template, choose the audience from your customer list, and launch. Sending respects opt outs, and you are responsible for having consent to contact your recipients under the laws that apply to them.",
      "SMS delivery requires SMS sending to be enabled on your account. Email works out of the box.",
    ]},
    { h: "5. Review links and QR codes", ps: [
      "A review link is a short link that takes a customer straight to your review page. Create and manage them on the Review Links page. Every review link can be downloaded as a QR code image, ready to print on receipts, counters, table tents or vehicles. Customers scan, land on the right page, and leave a review in seconds.",
    ]},
    { h: "6. Private feedback and service recovery", ps: [
      "Unhappy customers need a direct channel before they reach for a public megaphone. Feedback forms give them one. Submissions route to the right person, appear in your feedback inbox, and feed the risk score the same hour.",
      "The Recovery page tracks unhappy cases through to resolution so nothing falls through the cracks.",
    ]},
    { h: "7. Review monitoring and imports", ps: [
      "The Monitoring page lists every review from every connected source in one feed, scored for sentiment on arrival. Add or remove sources at any time.",
      "Two import paths exist. The browser extension imports reviews directly from platforms while you browse them. The CSV importer on the Imports page handles bulk history: upload, map the columns, review the preview, and commit.",
    ]},
    { h: "8. AI response drafting", ps: [
      "Every review deserves an answer, and drafting them is the part most owners skip. Echorank drafts a professional reply in your voice: it thanks positive reviewers concretely, acknowledges problems without arguing, and invites unhappy customers to continue offline. You review, edit if needed, and publish. Nothing is ever posted without your approval.",
    ]},
    { h: "9. AI visibility audit (Growth and above)", ps: [
      "When a customer asks ChatGPT, Google AI or Perplexity which business to hire, those systems do not pick at random. They evaluate signals: crawler access, structured data, review freshness, information consistency. The audit measures exactly those signals and tells you what to fix, in order of impact. The audit checks every factor that decides whether AI assistants can see, trust and cite your business: crawler access, machine readability, structure, and trust signals. You get a 0 to 100 score, a grade, and a fix roadmap ordered by impact.",
      "Run it from the Visibility page. Re-run after making fixes to watch the score respond.",
    ]},
    { h: "10. Scheduled re-audits and visibility alerts (Growth and above)", ps: [
      "Visibility is not a one time check. Scheduled re-audits run automatically and alert you on score drops and on crawler access flips, so a silent disappearance from AI answers never goes unnoticed.",
    ]},
    { h: "11. AI answer tracking (Agency)", ps: [
      "Define the questions your customers actually ask, and the platform runs them against ChatGPT, Perplexity and Google AI every day. You see when you are cited, when you are misrepresented, and when you are absent, with history, so you know the day AI starts recommending you and the moment it stops.",
    ]},
    { h: "12. The Reputation Risk Score (Growth and above)", ps: [
      "Reputation problems rarely announce themselves. They build quietly, a slowing review pace or a cluster of complaints about the same thing, until a public crisis makes them visible. The Risk Score exists to surface that build-up while it is still cheap to fix. One number from 0 to 100 summarizes your reputation risk across public reviews, private feedback, AI visibility and review velocity. It is fully explainable: five weighted components, and every driver behind the score is named, so you always know what to fix first.",
      "The score recomputes every hour, with 7 and 30 day changes and a 90 day history so trends surface early. Find it under Intelligence, Risk.",
    ]},
    { h: "13. Revenue at risk (Growth and above)", ps: [
      "Enter your monthly revenue in the risk configuration panel and the score is translated into an estimated amount of revenue exposed per month. It is an estimate for prioritization, not an accounting figure, and it turns a discussion about scores into a decision about money.",
    ]},
    { h: "14. Alerts", ps: [
      "Alerts fire when the score crosses a threshold, when it spikes over 7 days, or when a critical signal lands. Each alert arrives with the cause attached, and alerts are deduplicated so a crossing fires once instead of every hour you stay above the line.",
      "Set the destination addresses in the risk configuration panel. Digest emails group event bursts so your inbox never floods.",
    ]},
    { h: "15. Competitor monitoring (Growth: 1, Agency: 5)", ps: [
      "Your rating can hold steady while a competitor quietly overtakes you on review volume and momentum. By the time you notice it in your bookings, they will have had months of head start. Daily snapshots close that gap to a week. Add competitors by searching for their business listing. Every morning the platform snapshots their rating and review count, computes momentum, and compares it to your own review pace. When a rival gains ground faster than you, a momentum alert reaches you the same week.",
      "Find it under Intelligence, Competitors.",
    ]},
    { h: "16. Customers and templates", ps: [
      "The Customers page is your contact base for campaigns: add customers manually, or in bulk through the CSV importer. Templates hold your reusable email and SMS content so campaigns launch in seconds.",
    ]},
    { h: "17. Team, multi client and white label (Agency)", ps: [
      "Invite teammates with roles from the Team page. Agencies can run multiple client workspaces and use white label options so clients see the agency brand.",
    ]},
    { h: "18. Billing and plans", ps: [
      "Manage your subscription on the Billing page. Plans renew automatically until cancelled, and cancellation takes effect at the end of the current period. Feature availability: campaigns, feedback, monitoring and response drafting on every plan. Visibility audit, risk score, alerts and revenue at risk from Growth. Answer tracking, five competitors, white label and multi client from Agency.",
    ]},
    { h: "19. Your data", ps: [
      "You can export your data and request deletion. Deletion removes your content subject to a short backup cycle and legal retention duties. The details live in the Privacy Policy, linked in the footer of every page.",
    ]},
    { h: "20. Getting help", ps: [
      "Questions, problems or requests: write to privacy@echorank360.com. This guide is updated as features ship; the date at the top tells you how fresh it is.",
    ]},
    { h: "21. Download your reviews as a CSV", ps: [
      "Most review platforms let business owners export their own reviews. On Google, request an export of your Google Business Profile data through Google Takeout: select the Google Business Profile product, and the archive you receive includes your reviews. Other platforms offer a CSV or spreadsheet export in their business dashboard, often under settings or reports. If a platform offers no export at all, the browser extension in section 23 is usually the faster path.",
      "Whatever the source, aim for one row per review with columns such as author, rating, date and text. The importer maps your columns, so exact column names do not matter.",
    ]},
    { h: "22. Upload a review CSV into Echorank", ps: [
      "Open the Imports page and upload your file. On the mapping screen, match your columns to Echorank fields: the importer suggests matches and you correct anything it got wrong. Check the preview, which shows exactly what will be created and flags problem rows. Then commit.",
      "The import runs in the background; large files are processed in batches and you can keep working while it runs. Imported reviews join your monitored feed, are scored for sentiment, and count toward your risk history like any other signal.",
    ]},
    { h: "23. Use the browser extension, in Chrome and in Brave", ps: [
      "The Echorank extension imports reviews directly from pages you can already see in your browser. It is built for Chromium browsers, so it works in Google Chrome and in Brave the same way. Install it from the link on the Extension page of your dashboard; the Chrome Web Store works natively in Brave, so click Add and confirm.",
      "Connect it once: open the extension, sign in, and it links to your account with a secure token from the Extension page. Then browse to your reviews on a supported source, for example your Google Business listing in Search or Maps, or your public business page on platforms such as Facebook from Meta, and click Import. The extension reads the reviews visible on the page and sends them to your account, where they are deduplicated and scored like any other import.",
      "Import only reviews of your own business or reviews you have the right to process, and respect each platform's terms of use. If a page is not recognized as a supported source, the import stays disabled; the CSV path in sections 21 and 22 is the fallback.",
    ]},
      { h: "Troubleshooting", ps: [
      "Why are my Google reviews not importing? Check, in order: your Google Business Profile is connected and the Monitoring page shows the source as active; you connected the right Google account, since the wrong one is the most common cause; the initial sync is still running, as large profiles take several minutes; the review is very recent, since new reviews arrive on the next sync cycle, not instantly.",
      "Why is my AI visibility score low even though my site looks fine? Looking fine to a visitor and being readable by AI crawlers are different tests. The most common causes are a robots.txt rule blocking GPTBot, ClaudeBot, PerplexityBot or Google-Extended, often inherited from a former agency or a CDN default, missing structured data, and key information locked inside images or PDFs. The audit report names each failing check.",
      "Why has my Risk Score not updated? The score recomputes hourly, from dated signals. If nothing new arrived, no review, no feedback, no audit, the score holds. A score that never moves for weeks is itself a signal: the stagnation component will start to reflect it.",
      "The browser extension says the page is not supported. The extension reads reviews from recognized layouts. If a platform page is not recognized, import is disabled by design; use the CSV path in sections 21 and 22 instead.",
      "My campaign emails are not arriving. Check the recipient is not opted out, verify the address in your customer record, and ask the recipient to check spam on the first send. SMS additionally requires SMS sending to be enabled on your account.",
    ] },
    { h: "Best practices", ps: [
      "The habits that make the platform pay for itself:",
    ], bullets: [
      "Ask for reviews within 24 hours of service; response rates fall fast after the first day.",
      "Respond to every review, positive ones included. Replies are a trust signal both customers and AI systems read.",
      "Import your history before anything else. Scores computed with context beat scores computed from zero.",
      "Review your alerts every morning; they arrive with the cause attached, so triage takes seconds.",
      "Check competitor momentum weekly.",
      "Re-run the AI visibility audit after every website or infrastructure change.",
      "Treat recurring complaint themes as operations problems, not communications problems: fix the cause, and the reviews follow.",
    ] },
    { h: "Frequently asked questions", ps: [
      "Can Echorank respond to reviews automatically? It drafts; you approve. Every reply is generated in your voice, but nothing is published without your explicit approval. That is deliberate: a wrong automated reply costs more than a slow human one.",
      "Can I monitor multiple locations? Yes. Multi location management is a core use case, and agencies on the Agency plan can run separate client workspaces with white label branding.",
      "How often should I run an AI Visibility Audit? On Growth and above, scheduled re-audits run automatically and alert you on score drops and crawler flips. Manually, re-run after any website change. For the full picture of what the audit checks and why, see the AI Visibility Guide.",
      "Do Google reviews affect AI recommendations? Yes, strongly. Review freshness, volume and your replies are among the signals AI assistants weigh. The AI Visibility Guide covers the mechanics in detail.",
      "What happens to my data if I cancel? You can export your data at any time and request deletion. Deletion removes your content subject to a short backup cycle and legal retention duties; details in the Privacy Policy.",
    ] },
    { h: "You are set", ps: [
      "Your reputation is now being watched around the clock: reviews, private feedback, AI visibility, competitors and risk, continuously. You will know about opportunities and problems before they reach your bottom line. Make it a habit: check the dashboard with your morning coffee, act on alerts the day they arrive, and re-run the visibility audit after any website change. Reputation is not a one time project; it is a compounding advantage, and you now have the machinery to compound it.",
    ] },
],
};

const FR: Doc = {
  title: "Guide d'utilisation Echorank",
  updated: "Dernière mise à jour : 6 juillet 2026",
  intro: "Ce guide couvre chaque fonction d'Echorank en langage simple : ce qu'elle fait, où la trouver, et comment en tirer de la valeur dès le premier jour. La disponibilité par forfait est indiquée quand elle s'applique.",
  sections: [
    { h: "Vos 30 premières minutes", ps: [
      "Le parcours complet, dans l'ordre. Quand chaque case est cochée, la plateforme surveille votre réputation en continu.",
    ], bullets: [
      "☐ Créez votre compte (essai de 7 jours, sans carte)",
      "☐ Connectez votre profil d'entreprise Google",
      "☐ Connectez le domaine de votre site web",
      "☐ Importez vos avis historiques (extension ou CSV)",
      "☐ Ajoutez votre liste de clients",
      "☐ Lancez votre première campagne d'avis",
      "☐ Configurez les adresses de destination des alertes",
      "☐ Lancez votre premier audit de visibilité IA (Growth et plus)",
      "☐ Ajoutez un concurrent (Growth et plus)",
      "☐ Consultez votre score de risque de réputation (Growth et plus)",
    ] },

    { h: "Pourquoi les entreprises ont besoin d'un logiciel de gestion des avis Google", ps: [
      "Un logiciel de gestion des avis Google n'est pas qu'un outil pour traiter des avis. C'est un actif stratégique, pour le commerce à emplacement unique comme pour les multinationales et les grandes entreprises. Voici ce qu'apporte la bonne plateforme :",
    ], bullets: [
      "Image de marque et personnalisation : chaque avis reçoit une réponse dans un ton cohérent, à grande échelle.",
      "Gestion multi-établissements et multilingue : un seul endroit pour chaque emplacement et chaque langue dans laquelle vos clients écrivent.",
      "Efficacité : lecture, rédaction et routage sont automatisés, et les minutes remplacent les heures.",
      "Mesure de la satisfaction client par l'analyse de sentiment : chaque avis et commentaire est noté, et la satisfaction devient une tendance observable plutôt qu'une intuition.",
      "Réduction du risque : plaintes récurrentes et activités d'avis suspectes remontent avant de devenir des crises.",
      "Pilotage des décisions d'affaires : scores, variations et revenus à risque transforment la réputation en chiffres sur lesquels une direction peut agir.",
      "Intelligence concurrentielle : les instantanés quotidiens des concurrents montrent qui gagne du terrain, et quand.",
    ]},
    { h: "1. Créez votre compte", ps: [
      "Rendez-vous sur la page d'inscription, entrez votre nom, votre courriel professionnel, le nom de votre entreprise et un mot de passe d'au moins 8 caractères. Chaque nouveau compte démarre un essai gratuit de 7 jours, sans carte de crédit. Rien n'est facturé sans souscription.",
      "Vous pourrez inviter des collègues plus tard depuis la page Équipe. La personne qui crée le compte en est propriétaire.",
    ]},
    { h: "2. Reliez vos sources", ps: [
      "Trois connexions donnent à la plateforme tout ce qu'il lui faut. D'abord votre fiche Google : la relier importe vos avis et lance le scoring immédiatement. Ensuite vos autres sources d'avis, depuis la page Surveillance : chaque source configurée synchronise les nouveaux avis dès leur arrivée. Enfin votre site web : entrez votre domaine et le premier audit de visibilité IA tourne en quelques minutes.",
      "L'historique compte. Utilisez l'extension de navigateur ou un import CSV pour ramener vos avis et clients passés, afin que vos scores démarrent avec du contexte plutôt qu'une page blanche.",
    ]},
    { h: "3. Le tableau de bord", ps: [
      "Le tableau de bord est votre vue quotidienne : avis récents, activité de rétroaction, performance des campagnes et état de votre intelligence de réputation. Les vues détaillées se trouvent sous Intelligence pour le risque et les concurrents, Surveillance pour les sources et les avis, et Campagnes pour les envois.",
    ]},
    { h: "4. Campagnes d'avis", ps: [
      "Les campagnes sollicitent vos clients au bon moment, par courriel et par texto. Créez une campagne depuis la page Campagnes, choisissez ou rédigez un modèle, sélectionnez l'audience dans votre liste de clients, puis lancez. Les envois respectent les désabonnements, et vous êtes responsable d'avoir le consentement de vos destinataires selon les lois qui s'appliquent à eux.",
      "L'envoi de textos exige que l'envoi SMS soit activé sur votre compte. Le courriel fonctionne d'emblée.",
    ]},
    { h: "5. Liens d'avis et codes QR", ps: [
      "Un lien d'avis est un lien court qui amène le client directement sur votre page d'avis. Créez et gérez ces liens sur la page Liens d'avis. Chaque lien peut être téléchargé en image de code QR, prête à imprimer sur reçus, comptoirs, chevalets de table ou véhicules. Le client numérise, arrive au bon endroit et laisse un avis en quelques secondes.",
    ]},
    { h: "6. Rétroaction privée et récupération de service", ps: [
      "Un client insatisfait a besoin d'un canal direct avant de prendre le mégaphone public. Les formulaires de rétroaction le lui donnent. Les soumissions sont routées vers la bonne personne, apparaissent dans votre boîte de rétroaction et alimentent le score de risque dans l'heure.",
      "La page Récupération suit les cas insatisfaits jusqu'à leur résolution, pour que rien ne tombe entre deux chaises.",
    ]},
    { h: "7. Surveillance des avis et imports", ps: [
      "La page Surveillance regroupe chaque avis de chaque source reliée dans un seul fil, noté en sentiment dès réception. Ajoutez ou retirez des sources à tout moment.",
      "Deux voies d'import existent. L'extension de navigateur importe les avis directement depuis les plateformes pendant que vous les consultez. L'importateur CSV, sur la page Imports, gère l'historique en masse : téléversez, associez les colonnes, vérifiez l'aperçu, puis validez.",
    ]},
    { h: "8. Réponses rédigées par IA", ps: [
      "Chaque avis mérite une réponse, et c'est l'étape que la plupart des propriétaires sautent. Echorank rédige une réponse professionnelle dans votre ton : elle remercie concrètement les clients satisfaits, reconnaît les problèmes sans argumenter, et invite les clients mécontents à poursuivre hors ligne. Vous relisez, ajustez au besoin, puis publiez. Rien n'est jamais publié sans votre approbation.",
    ]},
    { h: "9. Audit de visibilité IA (Croissance et plus)", ps: [
      "L'audit vérifie chaque facteur qui détermine si les assistants d'IA peuvent voir votre entreprise, lui faire confiance et la citer : accès des robots, lisibilité machine, structure et signaux de confiance. Vous obtenez un score sur 100, une note et une feuille de route de correctifs classés par impact.",
      "Lancez-le depuis la page Visibilité. Relancez après vos correctifs pour voir le score répondre.",
    ]},
    { h: "10. Ré-audits programmés et alertes de visibilité (Croissance et plus)", ps: [
      "La visibilité n'est pas une vérification ponctuelle. Les ré-audits programmés tournent automatiquement et vous alertent en cas de chute de score ou de bascule d'accès des robots, pour qu'une disparition silencieuse des réponses d'IA ne passe jamais inaperçue.",
    ]},
    { h: "11. Suivi des réponses IA (Agence)", ps: [
      "Définissez les questions que vos clients posent réellement, et la plateforme les teste chaque jour sur ChatGPT, Perplexity et Google AI. Vous voyez quand vous êtes cité, quand vous êtes déformé et quand vous êtes absent, avec historique : vous savez le jour où l'IA commence à vous recommander et l'instant où elle s'arrête.",
    ]},
    { h: "12. Le Score de risque de réputation (Croissance et plus)", ps: [
      "Un seul chiffre de 0 à 100 résume votre risque de réputation à travers les avis publics, la rétroaction privée, la visibilité IA et le rythme des avis. Il est entièrement explicable : cinq composantes pondérées, et chaque facteur derrière le score est nommé, pour toujours savoir quoi corriger en premier.",
      "Le score est recalculé chaque heure, avec les variations à 7 et 30 jours et un historique de 90 jours pour voir les tendances tôt. Retrouvez-le sous Intelligence, Risque.",
    ]},
    { h: "13. Revenus à risque (Croissance et plus)", ps: [
      "Entrez vos revenus mensuels dans le panneau de configuration du risque et le score est traduit en un montant estimé de revenus exposés par mois. C'est une estimation destinée à la priorisation, pas un chiffre comptable, et elle transforme une discussion de scores en décision d'argent.",
    ]},
    { h: "14. Alertes", ps: [
      "Les alertes se déclenchent quand le score franchit un seuil, quand il grimpe en pic sur 7 jours, ou quand un signal critique arrive. Chaque alerte arrive avec la cause, et les alertes sont dédupliquées : un franchissement sonne une fois, pas chaque heure passée au-dessus du seuil.",
      "Définissez les adresses de destination dans le panneau de configuration du risque. Les courriels de synthèse regroupent les rafales d'événements pour ne jamais inonder votre boîte.",
    ]},
    { h: "15. Veille concurrentielle (Croissance : 1, Agence : 5)", ps: [
      "Ajoutez des concurrents en cherchant leur fiche d'entreprise. Chaque matin, la plateforme capture leur note et leur volume d'avis, calcule leur élan et le compare à votre propre rythme. Quand un rival gagne du terrain plus vite que vous, une alerte d'élan vous parvient la semaine même.",
      "Retrouvez cela sous Intelligence, Concurrents.",
    ]},
    { h: "16. Clients et modèles", ps: [
      "La page Clients est votre base de contacts pour les campagnes : ajoutez des clients à la main, ou en masse par l'importateur CSV. Les Modèles conservent vos contenus réutilisables de courriel et de texto pour lancer une campagne en quelques secondes.",
    ]},
    { h: "17. Équipe, multi-clients et marque blanche (Agence)", ps: [
      "Invitez des collègues avec des rôles depuis la page Équipe. Les agences peuvent gérer plusieurs espaces clients et utiliser la marque blanche pour que les clients voient la marque de l'agence.",
    ]},
    { h: "18. Facturation et forfaits", ps: [
      "Gérez votre abonnement sur la page Facturation. Les forfaits se renouvellent automatiquement jusqu'à annulation, effective à la fin de la période en cours. Disponibilité des fonctions : campagnes, rétroaction, surveillance et réponses rédigées sur tous les forfaits. Audit de visibilité, score de risque, alertes et revenus à risque dès Croissance. Suivi des réponses, cinq concurrents, marque blanche et multi-clients dès Agence.",
    ]},
    { h: "19. Vos données", ps: [
      "Vous pouvez exporter vos données et demander leur suppression. La suppression retire vos contenus, sous réserve d'un court cycle de sauvegarde et des obligations légales de conservation. Les détails figurent dans la Politique de confidentialité, liée en pied de chaque page.",
    ]},
    { h: "20. Obtenir de l'aide", ps: [
      "Questions, problèmes ou demandes : écrivez à privacy@echorank360.com. Ce guide est mis à jour au fil des sorties ; la date en haut vous dit à quel point il est frais.",
    ]},
    { h: "21. Téléchargez vos avis en CSV", ps: [
      "La plupart des plateformes d'avis permettent aux propriétaires d'exporter leurs propres avis. Chez Google, demandez un export de vos données de fiche Google via Google Takeout : sélectionnez le produit Google Business Profile, et l'archive reçue inclut vos avis. D'autres plateformes offrent un export CSV ou tableur dans leur tableau de bord entreprise, souvent sous réglages ou rapports. Si une plateforme n'offre aucun export, l'extension de navigateur de la section 23 est généralement la voie la plus rapide.",
      "Quelle que soit la source, visez une ligne par avis avec des colonnes comme auteur, note, date et texte. L'importateur associe vos colonnes, alors les noms exacts importent peu.",
    ]},
    { h: "22. Téléversez un CSV d'avis dans Echorank", ps: [
      "Ouvrez la page Imports et téléversez votre fichier. Sur l'écran d'association, faites correspondre vos colonnes aux champs Echorank : l'importateur propose des correspondances et vous corrigez ce qu'il a mal deviné. Vérifiez l'aperçu, qui montre exactement ce qui sera créé et signale les lignes problématiques. Puis validez.",
      "L'import tourne en arrière-plan; les gros fichiers sont traités par lots et vous pouvez continuer à travailler pendant ce temps. Les avis importés rejoignent votre fil surveillé, sont notés en sentiment et comptent dans votre historique de risque comme tout autre signal.",
    ]},
    { h: "23. Utilisez l'extension de navigateur, dans Chrome et dans Brave", ps: [
      "L'extension Echorank importe les avis directement depuis les pages que vous voyez déjà dans votre navigateur. Elle est conçue pour les navigateurs Chromium, donc elle fonctionne de la même façon dans Google Chrome et dans Brave. Installez-la depuis le lien de la page Extension de votre tableau de bord; le Chrome Web Store fonctionne nativement dans Brave, cliquez Ajouter et confirmez.",
      "Connectez-la une seule fois : ouvrez l'extension, connectez-vous, et elle se lie à votre compte avec un jeton sécurisé depuis la page Extension. Naviguez ensuite vers vos avis sur une source prise en charge, par exemple votre fiche Google dans la recherche ou dans Maps, ou votre page d'entreprise publique sur des plateformes comme Facebook de Meta, puis cliquez Importer. L'extension lit les avis visibles sur la page et les envoie vers votre compte, où ils sont dédupliqués et notés comme tout autre import.",
      "N'importez que les avis de votre propre entreprise ou ceux que vous avez le droit de traiter, et respectez les conditions d'utilisation de chaque plateforme. Si une page n'est pas reconnue comme source prise en charge, l'import reste désactivé; la voie CSV des sections 21 et 22 est la solution de repli.",
    ]},
      { h: "Dépannage", ps: [
      "Pourquoi mes avis Google ne s'importent-ils pas? Vérifiez, dans l'ordre : votre profil d'entreprise Google est connecté et la page Surveillance affiche la source comme active; vous avez connecté le bon compte Google, le mauvais compte étant la cause la plus fréquente; la synchronisation initiale est encore en cours, les grands profils prenant plusieurs minutes; l'avis est très récent, les nouveaux avis arrivant au prochain cycle de synchronisation, pas instantanément.",
      "Pourquoi mon score de visibilité IA est-il bas alors que mon site semble correct? Paraître correct à un visiteur et être lisible par les robots d'IA sont deux tests différents. Les causes les plus fréquentes : une règle robots.txt bloquant GPTBot, ClaudeBot, PerplexityBot ou Google-Extended, souvent héritée d'une ancienne agence ou d'un réglage CDN par défaut, des données structurées manquantes, et des informations clés enfermées dans des images ou des PDF. Le rapport d'audit nomme chaque vérification en échec.",
      "Pourquoi mon score de risque ne s'est-il pas mis à jour? Le score se recalcule chaque heure, à partir de signaux datés. Si rien de nouveau n'est arrivé, aucun avis, aucun retour, aucun audit, le score reste stable. Un score qui ne bouge pas pendant des semaines est lui-même un signal : la composante stagnation commencera à le refléter.",
      "L'extension de navigateur indique que la page n'est pas prise en charge. L'extension lit les avis à partir de mises en page reconnues. Si une page de plateforme n'est pas reconnue, l'import reste désactivé par conception; utilisez plutôt la voie CSV des sections 21 et 22.",
      "Mes courriels de campagne n'arrivent pas. Vérifiez que le destinataire n'est pas désabonné, validez l'adresse dans sa fiche client, et demandez-lui de vérifier ses indésirables au premier envoi. Les SMS exigent en plus que l'envoi SMS soit activé sur votre compte.",
    ] },
    { h: "Bonnes pratiques", ps: [
      "Les habitudes qui rentabilisent la plateforme :",
    ], bullets: [
      "Demandez l'avis dans les 24 heures suivant le service; le taux de réponse chute vite après le premier jour.",
      "Répondez à chaque avis, y compris les positifs. Les réponses sont un signal de confiance que lisent les clients comme les systèmes d'IA.",
      "Importez votre historique avant tout le reste. Un score calculé avec du contexte vaut mieux qu'un score parti de zéro.",
      "Consultez vos alertes chaque matin; elles arrivent avec leur cause, le tri prend quelques secondes.",
      "Vérifiez l'élan de vos concurrents chaque semaine.",
      "Relancez l'audit de visibilité IA après chaque changement de site ou d'infrastructure.",
      "Traitez les thèmes de plaintes récurrents comme des problèmes d'exploitation, pas de communication : corrigez la cause, et les avis suivront.",
    ] },
    { h: "Foire aux questions", ps: [
      "Echorank peut-il répondre automatiquement aux avis? Il rédige; vous approuvez. Chaque réponse est générée dans votre ton, mais rien n'est publié sans votre approbation explicite. C'est voulu : une mauvaise réponse automatique coûte plus cher qu'une réponse humaine lente.",
      "Puis-je surveiller plusieurs établissements? Oui. La gestion multi-établissements est un cas d'usage central, et les agences du forfait Agency peuvent gérer des espaces clients distincts en marque blanche.",
      "À quelle fréquence lancer un audit de visibilité IA? À partir de Growth, les ré-audits planifiés s'exécutent automatiquement et vous alertent en cas de baisse de score ou de bascule d'accès des robots. Manuellement, relancez après tout changement de site. Pour le détail des vérifications, consultez le Guide de visibilité IA.",
      "Les avis Google influencent-ils les recommandations des IA? Oui, fortement. La fraîcheur des avis, leur volume et vos réponses comptent parmi les signaux que pèsent les assistants IA. Le Guide de visibilité IA en couvre les mécanismes en détail.",
      "Qu'advient-il de mes données si j'annule? Vous pouvez exporter vos données en tout temps et demander leur suppression. La suppression retire votre contenu sous réserve d'un court cycle de sauvegarde et des obligations légales de conservation; les détails figurent dans la politique de confidentialité.",
    ] },
    { h: "Vous êtes prêt", ps: [
      "Votre réputation est désormais surveillée en continu : avis, retours privés, visibilité IA, concurrents et risque. Vous saurez ce qui se prépare, opportunités comme problèmes, avant que cela n'atteigne vos résultats. Faites-en une habitude : consultez le tableau de bord avec votre café du matin, agissez sur les alertes le jour même, et relancez l'audit de visibilité après tout changement de site. La réputation n'est pas un projet ponctuel; c'est un avantage qui se compose, et vous avez maintenant la machine pour le composer.",
    ] },
],
};

const DE: Doc = {
  title: "Echorank Benutzerhandbuch",
  updated: "Zuletzt aktualisiert: 6. Juli 2026",
  intro: "Dieses Handbuch erklärt jede Funktion von Echorank in einfacher Sprache: was sie tut, wo sie zu finden ist und wie sie ab dem ersten Tag Nutzen bringt. Die Verfügbarkeit nach Plan ist angegeben, wo sie gilt.",
  sections: [
    { h: "Ihre ersten 30 Minuten", ps: [
      "Der komplette Einstieg, in der richtigen Reihenfolge. Sind alle Punkte abgehakt, überwacht die Plattform Ihre Reputation rund um die Uhr.",
    ], bullets: [
      "☐ Konto erstellen (7 Tage Testphase, ohne Karte)",
      "☐ Google Unternehmensprofil verbinden",
      "☐ Website-Domain verbinden",
      "☐ Bisherige Bewertungen importieren (Erweiterung oder CSV)",
      "☐ Kundenliste hinzufügen",
      "☐ Erste Bewertungskampagne starten",
      "☐ Zieladressen für Alerts festlegen",
      "☐ Ersten KI-Sichtbarkeits-Audit ausführen (ab Growth)",
      "☐ Einen Mitbewerber hinzufügen (ab Growth)",
      "☐ Reputations-Risiko-Score prüfen (ab Growth)",
    ] },

    { h: "Warum Unternehmen eine Software für Google Bewertungsmanagement brauchen", ps: [
      "Software für Google Bewertungsmanagement ist nicht nur ein Werkzeug zum Abarbeiten von Bewertungen. Sie ist ein strategischer Vorteil, für das Geschäft mit einem Standort ebenso wie für Multinationale und Grossunternehmen. Das bringt die richtige Plattform:",
    ], bullets: [
      "Markenbild und Personalisierung: jede Bewertung erhält eine Antwort in einheitlicher Stimme, in grossem Massstab.",
      "Verwaltung mehrerer Standorte und Sprachen: ein Ort für jeden Standort und jede Sprache, in der Ihre Kunden schreiben.",
      "Effizienz: Lesen, Entwerfen und Weiterleiten sind automatisiert, Minuten ersetzen Stunden.",
      "Kundenzufriedenheit messen mit Sentiment Analyse: jede Bewertung und jeder Kommentar wird bewertet, Zufriedenheit wird zum beobachtbaren Trend statt zur Vermutung.",
      "Risikominderung: wiederkehrende Beschwerden und verdächtige Bewertungsaktivitäten tauchen auf, bevor sie zur Krise werden.",
      "Geschäftsentscheidungen steuern: Scores, Deltas und Umsatz im Risiko machen Reputation zu Zahlen, auf die eine Geschäftsleitung reagieren kann.",
      "Wettbewerbsintelligenz: tägliche Konkurrenz Momentaufnahmen zeigen, wer aufholt, und wann.",
    ]},
    { h: "1. Konto erstellen", ps: [
      "Gehen Sie zur Registrierungsseite, geben Sie Name, geschäftliche E-Mail, Firmenname und ein Passwort mit mindestens 8 Zeichen ein. Jedes neue Konto startet eine 7 Tage Testphase ohne Kreditkarte. Ohne Abo wird nichts berechnet.",
      "Teammitglieder laden Sie später über die Team Seite ein. Wer das Konto erstellt, ist Inhaber.",
    ]},
    { h: "2. Quellen verbinden", ps: [
      "Drei Verbindungen genügen. Erstens Ihr Google Unternehmensprofil: die Verbindung importiert Ihre Bewertungen und startet das Scoring sofort. Zweitens Ihre weiteren Bewertungsquellen über die Überwachungsseite: jede Quelle synchronisiert neue Bewertungen bei Eingang. Drittens Ihre Website: Domain eingeben, und der erste KI Sichtbarkeits Audit läuft in Minuten.",
      "Historie zählt. Nutzen Sie die Browser Erweiterung oder einen CSV Import, um frühere Bewertungen und Kunden mitzubringen, damit Ihre Scores mit Kontext starten.",
    ]},
    { h: "3. Das Dashboard", ps: [
      "Das Dashboard ist Ihre Tagesansicht: neue Bewertungen, Feedback Aktivität, Kampagnenleistung und der Stand Ihrer Reputationsintelligenz. Tiefer geht es unter Intelligence für Risiko und Konkurrenz, Überwachung für Quellen und Bewertungen, und Kampagnen für den Versand.",
    ]},
    { h: "4. Bewertungskampagnen", ps: [
      "Kampagnen bitten Ihre Kunden im richtigen Moment um eine Bewertung, per E-Mail und SMS. Erstellen Sie eine Kampagne auf der Kampagnenseite, wählen oder schreiben Sie eine Vorlage, bestimmen Sie die Empfänger aus Ihrer Kundenliste und starten Sie. Abmeldungen werden respektiert; für die Einwilligung Ihrer Empfänger nach geltendem Recht sind Sie verantwortlich.",
      "SMS Versand setzt voraus, dass SMS auf Ihrem Konto aktiviert ist. E-Mail funktioniert sofort.",
    ]},
    { h: "5. Bewertungslinks und QR Codes", ps: [
      "Ein Bewertungslink führt den Kunden direkt auf Ihre Bewertungsseite. Erstellen und verwalten Sie Links auf der Seite Bewertungslinks. Jeder Link lässt sich als QR Code Bild herunterladen, bereit für Quittungen, Theken, Tischaufsteller oder Fahrzeuge. Der Kunde scannt, landet richtig und bewertet in Sekunden.",
    ]},
    { h: "6. Privates Feedback und Service Wiedergutmachung", ps: [
      "Unzufriedene Kunden brauchen einen direkten Kanal, bevor sie zum öffentlichen Megafon greifen. Feedback Formulare geben ihn. Eingaben werden an die richtige Person geleitet, erscheinen im Feedback Eingang und fliessen in derselben Stunde in den Risiko Score.",
      "Die Seite Wiedergutmachung verfolgt unzufriedene Fälle bis zur Lösung, damit nichts liegen bleibt.",
    ]},
    { h: "7. Bewertungsüberwachung und Importe", ps: [
      "Die Überwachungsseite zeigt jede Bewertung aus jeder verbundenen Quelle in einem Feed, bei Eingang nach Stimmung bewertet. Quellen lassen sich jederzeit hinzufügen oder entfernen.",
      "Zwei Importwege: Die Browser Erweiterung importiert Bewertungen direkt von den Plattformen, während Sie sie ansehen. Der CSV Importer auf der Importseite übernimmt Masse und Historie: hochladen, Spalten zuordnen, Vorschau prüfen, bestätigen.",
    ]},
    { h: "8. KI Antwortentwürfe", ps: [
      "Jede Bewertung verdient eine Antwort, und genau das überspringen die meisten Inhaber. Echorank entwirft eine professionelle Antwort in Ihrem Ton: konkreter Dank an zufriedene Kunden, Anerkennung von Problemen ohne Streit, Einladung an Unzufriedene, offline weiterzusprechen. Sie prüfen, passen bei Bedarf an und veröffentlichen. Nichts erscheint ohne Ihre Freigabe.",
    ]},
    { h: "9. KI Sichtbarkeits Audit (ab Wachstum)", ps: [
      "Der Audit prüft jeden Faktor, der entscheidet, ob KI Assistenten Ihr Unternehmen sehen, ihm vertrauen und es zitieren: Crawler Zugriff, Maschinenlesbarkeit, Struktur und Vertrauenssignale. Sie erhalten einen Score von 0 bis 100, eine Note und einen nach Wirkung geordneten Fahrplan.",
      "Starten Sie ihn auf der Sichtbarkeitsseite. Nach Korrekturen erneut laufen lassen und den Score antworten sehen.",
    ]},
    { h: "10. Geplante Re-Audits und Sichtbarkeitsalarme (ab Wachstum)", ps: [
      "Sichtbarkeit ist keine einmalige Prüfung. Geplante Re-Audits laufen automatisch und melden Score Einbrüche und gekippte Crawler Zugriffe, damit ein stilles Verschwinden aus KI Antworten nie unbemerkt bleibt.",
    ]},
    { h: "11. KI Antwort Tracking (Agentur)", ps: [
      "Definieren Sie die Fragen, die Ihre Kunden wirklich stellen; die Plattform testet sie täglich gegen ChatGPT, Perplexity und Google AI. Sie sehen, wann Sie zitiert, verzerrt oder gar nicht genannt werden, mit Verlauf: Sie kennen den Tag, an dem die KI Sie zu empfehlen beginnt, und den Moment, in dem sie aufhört.",
    ]},
    { h: "12. Der Reputations Risiko Score (ab Wachstum)", ps: [
      "Eine Zahl von 0 bis 100 fasst Ihr Reputationsrisiko über öffentliche Bewertungen, privates Feedback, KI Sichtbarkeit und Bewertungstempo zusammen. Vollständig erklärbar: fünf gewichtete Komponenten, jeder Treiber benannt, damit Sie immer wissen, was zuerst zu beheben ist.",
      "Der Score wird stündlich neu berechnet, mit 7 und 30 Tage Veränderungen und 90 Tage Verlauf. Zu finden unter Intelligence, Risiko.",
    ]},
    { h: "13. Umsatz im Risiko (ab Wachstum)", ps: [
      "Tragen Sie Ihren Monatsumsatz im Risiko Konfigurationsfeld ein, und der Score wird in einen geschätzten monatlich gefährdeten Betrag übersetzt. Eine Schätzung zur Priorisierung, keine Buchhaltungszahl, aber sie macht aus einer Score Diskussion eine Geldentscheidung.",
    ]},
    { h: "14. Alarme", ps: [
      "Alarme feuern, wenn der Score eine Schwelle überschreitet, in 7 Tagen sprunghaft steigt oder ein kritisches Signal eintrifft. Jeder Alarm kommt mit der Ursache, und Alarme werden dedupliziert: eine Überschreitung feuert einmal, nicht jede Stunde über der Linie.",
      "Zieladressen legen Sie im Risiko Konfigurationsfeld fest. Digest E-Mails bündeln Ereignisschübe, damit Ihr Postfach nie überläuft.",
    ]},
    { h: "15. Konkurrenz Monitoring (Wachstum: 1, Agentur: 5)", ps: [
      "Fügen Sie Konkurrenten über die Suche nach ihrem Firmeneintrag hinzu. Jeden Morgen hält die Plattform Bewertung und Bewertungszahl fest, berechnet das Momentum und vergleicht es mit Ihrem eigenen Tempo. Überholt Sie ein Rivale, erreicht Sie ein Momentum Alarm noch in derselben Woche.",
      "Zu finden unter Intelligence, Konkurrenten.",
    ]},
    { h: "16. Kunden und Vorlagen", ps: [
      "Die Kundenseite ist Ihre Kontaktbasis für Kampagnen: Kunden einzeln anlegen oder in Masse per CSV Import. Vorlagen halten wiederverwendbare E-Mail und SMS Inhalte bereit, damit Kampagnen in Sekunden starten.",
    ]},
    { h: "17. Team, Mandanten und White Label (Agentur)", ps: [
      "Laden Sie Teammitglieder mit Rollen über die Team Seite ein. Agenturen führen mehrere Kunden Arbeitsbereiche und nutzen White Label, damit Kunden die Marke der Agentur sehen.",
    ]},
    { h: "18. Abrechnung und Pläne", ps: [
      "Ihr Abo verwalten Sie auf der Abrechnungsseite. Pläne verlängern sich automatisch bis zur Kündigung, wirksam zum Ende der laufenden Periode. Verfügbarkeit: Kampagnen, Feedback, Überwachung und Antwortentwürfe in jedem Plan. Sichtbarkeits Audit, Risiko Score, Alarme und Umsatz im Risiko ab Wachstum. Antwort Tracking, fünf Konkurrenten, White Label und Mandanten ab Agentur.",
    ]},
    { h: "19. Ihre Daten", ps: [
      "Sie können Ihre Daten exportieren und die Löschung verlangen. Die Löschung entfernt Ihre Inhalte, vorbehaltlich eines kurzen Backup Zyklus und gesetzlicher Aufbewahrungspflichten. Details stehen in der Datenschutzerklärung, verlinkt im Fussbereich jeder Seite.",
    ]},
    { h: "20. Hilfe erhalten", ps: [
      "Fragen, Probleme oder Anliegen: schreiben Sie an privacy@echorank360.com. Dieses Handbuch wird laufend aktualisiert; das Datum oben zeigt, wie frisch es ist.",
    ]},
    { h: "21. Bewertungen als CSV herunterladen", ps: [
      "Die meisten Bewertungsplattformen erlauben Inhabern den Export der eigenen Bewertungen. Bei Google fordern Sie einen Export Ihrer Unternehmensprofil Daten über Google Takeout an: wählen Sie das Produkt Google Business Profile, und das erhaltene Archiv enthält Ihre Bewertungen. Andere Plattformen bieten einen CSV oder Tabellen Export im Unternehmens Dashboard, oft unter Einstellungen oder Berichte. Bietet eine Plattform gar keinen Export, ist die Browser Erweiterung aus Abschnitt 23 meist der schnellere Weg.",
      "Unabhängig von der Quelle: eine Zeile pro Bewertung mit Spalten wie Autor, Note, Datum und Text. Der Importer ordnet Ihre Spalten zu, exakte Spaltennamen sind unwichtig.",
    ]},
    { h: "22. Ein Bewertungs CSV in Echorank hochladen", ps: [
      "Öffnen Sie die Importseite und laden Sie Ihre Datei hoch. Auf dem Zuordnungsbildschirm verbinden Sie Ihre Spalten mit den Echorank Feldern: der Importer schlägt Zuordnungen vor, Sie korrigieren, was er falsch geraten hat. Prüfen Sie die Vorschau, die genau zeigt, was angelegt wird, und Problemzeilen markiert. Dann bestätigen.",
      "Der Import läuft im Hintergrund; grosse Dateien werden in Stapeln verarbeitet, und Sie können währenddessen weiterarbeiten. Importierte Bewertungen erscheinen im überwachten Feed, werden nach Stimmung bewertet und zählen zum Risikoverlauf wie jedes andere Signal.",
    ]},
    { h: "23. Die Browser Erweiterung nutzen, in Chrome und in Brave", ps: [
      "Die Echorank Erweiterung importiert Bewertungen direkt von Seiten, die Sie bereits im Browser sehen. Sie ist für Chromium Browser gebaut und funktioniert in Google Chrome und in Brave gleich. Installieren Sie sie über den Link auf der Erweiterungsseite Ihres Dashboards; der Chrome Web Store funktioniert in Brave nativ, also Hinzufügen klicken und bestätigen.",
      "Einmal verbinden: Erweiterung öffnen, anmelden, und sie koppelt sich mit einem sicheren Token von der Erweiterungsseite an Ihr Konto. Dann zu Ihren Bewertungen auf einer unterstützten Quelle navigieren, zum Beispiel Ihrem Google Eintrag in der Suche oder in Maps, oder Ihrer öffentlichen Unternehmensseite auf Plattformen wie Facebook von Meta, und Importieren klicken. Die Erweiterung liest die sichtbaren Bewertungen und sendet sie an Ihr Konto, wo sie dedupliziert und wie jeder andere Import bewertet werden.",
      "Importieren Sie nur Bewertungen Ihres eigenen Unternehmens oder solche, die Sie verarbeiten dürfen, und respektieren Sie die Nutzungsbedingungen jeder Plattform. Wird eine Seite nicht als unterstützte Quelle erkannt, bleibt der Import deaktiviert; der CSV Weg aus den Abschnitten 21 und 22 ist die Rückfalloption.",
    ]},
      { h: "Fehlerbehebung", ps: [
      "Warum werden meine Google-Bewertungen nicht importiert? Prüfen Sie der Reihe nach: Ihr Google Unternehmensprofil ist verbunden und die Monitoring-Seite zeigt die Quelle als aktiv; Sie haben das richtige Google-Konto verbunden, das falsche Konto ist die häufigste Ursache; die erste Synchronisierung läuft noch, grosse Profile brauchen mehrere Minuten; die Bewertung ist sehr neu, neue Bewertungen kommen mit dem nächsten Synchronisierungszyklus, nicht sofort.",
      "Warum ist mein KI-Sichtbarkeits-Score tief, obwohl meine Website gut aussieht? Für Besucher gut aussehen und für KI-Crawler lesbar sein sind zwei verschiedene Tests. Die häufigsten Ursachen: eine robots.txt-Regel, die GPTBot, ClaudeBot, PerplexityBot oder Google-Extended blockiert, oft von einer früheren Agentur oder einer CDN-Voreinstellung geerbt, fehlende strukturierte Daten und Schlüsselinformationen in Bildern oder PDFs. Der Audit-Bericht benennt jede fehlgeschlagene Prüfung.",
      "Warum hat sich mein Risiko-Score nicht aktualisiert? Der Score wird stündlich aus datierten Signalen neu berechnet. Kommt nichts Neues, keine Bewertung, kein Feedback, kein Audit, bleibt er stehen. Ein Score, der sich wochenlang nicht bewegt, ist selbst ein Signal: Die Stagnations-Komponente beginnt, das abzubilden.",
      "Die Browser-Erweiterung meldet, die Seite werde nicht unterstützt. Die Erweiterung liest Bewertungen aus bekannten Seitenlayouts. Wird eine Plattformseite nicht erkannt, bleibt der Import bewusst deaktiviert; nutzen Sie stattdessen den CSV-Weg aus den Abschnitten 21 und 22.",
      "Meine Kampagnen-E-Mails kommen nicht an. Prüfen Sie, ob der Empfänger sich abgemeldet hat, kontrollieren Sie die Adresse im Kundendatensatz und bitten Sie den Empfänger, beim ersten Versand den Spam-Ordner zu prüfen. SMS erfordern zusätzlich, dass der SMS-Versand auf Ihrem Konto aktiviert ist.",
    ] },
    { h: "Bewährte Praktiken", ps: [
      "Die Gewohnheiten, mit denen sich die Plattform bezahlt macht:",
    ], bullets: [
      "Bitten Sie innert 24 Stunden nach der Leistung um eine Bewertung; die Antwortrate fällt nach dem ersten Tag schnell.",
      "Antworten Sie auf jede Bewertung, auch auf positive. Antworten sind ein Vertrauenssignal, das Kunden wie KI-Systeme lesen.",
      "Importieren Sie zuerst Ihre Historie. Scores mit Kontext schlagen Scores, die bei null beginnen.",
      "Prüfen Sie Ihre Alerts jeden Morgen; sie kommen mit der Ursache, die Triage dauert Sekunden.",
      "Prüfen Sie das Momentum der Mitbewerber wöchentlich.",
      "Führen Sie den KI-Sichtbarkeits-Audit nach jeder Website- oder Infrastrukturänderung erneut aus.",
      "Behandeln Sie wiederkehrende Beschwerdethemen als Betriebsprobleme, nicht als Kommunikationsprobleme: Beheben Sie die Ursache, die Bewertungen folgen.",
    ] },
    { h: "Häufige Fragen", ps: [
      "Kann Echorank automatisch auf Bewertungen antworten? Es entwirft; Sie geben frei. Jede Antwort wird in Ihrem Ton erstellt, aber nichts wird ohne Ihre ausdrückliche Freigabe veröffentlicht. Das ist Absicht: Eine falsche automatische Antwort kostet mehr als eine langsame menschliche.",
      "Kann ich mehrere Standorte überwachen? Ja. Multi-Standort-Verwaltung ist ein Kernanwendungsfall, und Agenturen im Agency-Plan führen getrennte Kunden-Arbeitsbereiche mit White-Label-Branding.",
      "Wie oft sollte ich einen KI-Sichtbarkeits-Audit ausführen? Ab Growth laufen geplante Re-Audits automatisch und melden Score-Einbrüche und Crawler-Zugriffswechsel. Manuell: nach jeder Website-Änderung. Die vollständige Methodik steht im KI-Sichtbarkeits-Guide.",
      "Beeinflussen Google-Bewertungen KI-Empfehlungen? Ja, stark. Frische, Volumen und Ihre Antworten gehören zu den Signalen, die KI-Assistenten gewichten. Der KI-Sichtbarkeits-Guide erklärt die Mechanik im Detail.",
      "Was passiert mit meinen Daten, wenn ich kündige? Sie können Ihre Daten jederzeit exportieren und die Löschung verlangen. Die Löschung entfernt Ihre Inhalte vorbehaltlich eines kurzen Backup-Zyklus und gesetzlicher Aufbewahrungspflichten; Details in der Datenschutzerklärung.",
    ] },
    { h: "Sie sind startklar", ps: [
      "Ihre Reputation wird jetzt rund um die Uhr überwacht: Bewertungen, privates Feedback, KI-Sichtbarkeit, Mitbewerber und Risiko. Sie erfahren von Chancen und Problemen, bevor sie Ihr Ergebnis erreichen. Machen Sie es zur Gewohnheit: Dashboard zum Morgenkaffee, Alerts am selben Tag bearbeiten, Sichtbarkeits-Audit nach jeder Website-Änderung erneut ausführen. Reputation ist kein einmaliges Projekt; sie ist ein Vorteil, der sich aufzinst, und Sie haben jetzt die Maschine dafür.",
    ] },
],
};

function pick(locale: Locale): Doc {
  if (locale.startsWith("fr")) return FR;
  if (locale === "de-CH") return DE;
  return EN;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const d = pick(locale);
  return buildMetadata({
    locale,
    path: "/guide",
    title: d.title,
    description: d.intro,
    ogType: "article",
  });
}

export default async function GuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const d = pick(locale);
  const nav = CONTENT[locale].nav;
  const foot = CONTENT[locale].footer;
  const backLabel = locale.startsWith("fr") ? "← Retour" : locale === "de-CH" ? "← Zurück" : "← Back";

  return (
    <div className={lp.page}>
      <div className={lp.wrap}>
        <div className={lp.top}>
          <Link href={`/${locale}`} aria-label="Echorank360, home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/echorank-logo-dark.svg" alt="ECHORANK 360" className={lp.logo} />
          </Link>
          <Link href="/register">{nav.cta}</Link>
        </div>
        <div className={lp.backRow}>
          <BackButton locale={locale} label={backLabel} className={lp.backBtnSolid} />
        </div>
        <h1 className={lp.h1}>{d.title}</h1>
        <p className={lp.updated}>{d.updated}</p>
        <p className={lp.p}>{d.intro}</p>
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2 className={lp.h2}>{s.h}</h2>
            {s.ps.map((p, i) => (<p key={i} className={lp.p}>{p}</p>))}
            {s.bullets && (
              <ul className={lp.ul}>
                {s.bullets.map((b, i) => (<li key={i} className={lp.li}>{b}</li>))}
              </ul>
            )}
          </section>
        ))}
        <div className={lp.backRowBottom}>
          <BackButton locale={locale} label={backLabel} className={lp.backBtnSolid} />
        </div>
        <footer className={lp.footer}>
          <span>{foot.copyright}</span>
          <span>
            {foot.links.map((l) => (
              <Link key={l.label} href={`/${locale}${l.href}`}>{l.label}</Link>
            ))}
          </span>
        </footer>
      </div>
    </div>
  );
}
// EOF-guide

// GUIDE_V2_PATCH 2026-07-06

// GUIDE_V2_PATCH2 2026-07-06
