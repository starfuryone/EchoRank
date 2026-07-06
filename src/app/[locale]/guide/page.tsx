import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import lp from "../legal/legal.module.css";
import BackButton from "../legal/back-button";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Doc = { title: string; updated: string; intro: string; sections: { h: string; ps: string[] }[] };

const EN: Doc = {
  title: "EchoRank User Guide",
  updated: "Last updated: July 6, 2026",
  intro: "This guide covers every feature of EchoRank in plain language: what it does, where to find it, and how to get value from it on day one. Feature availability by plan is noted where it applies.",
  sections: [
    { h: "1. Create your account", ps: [
      "Go to the register page, enter your name, work email, business name and a password of at least 8 characters. Every new account starts a 14 day free trial with no credit card required. Nothing is charged unless you subscribe.",
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
      "Every review deserves an answer, and drafting them is the part most owners skip. EchoRank drafts a professional reply in your voice: it thanks positive reviewers concretely, acknowledges problems without arguing, and invites unhappy customers to continue offline. You review, edit if needed, and publish. Nothing is ever posted without your approval.",
    ]},
    { h: "9. AI visibility audit (Growth and above)", ps: [
      "The audit checks every factor that decides whether AI assistants can see, trust and cite your business: crawler access, machine readability, structure, and trust signals. You get a 0 to 100 score, a grade, and a fix roadmap ordered by impact.",
      "Run it from the Visibility page. Re-run after making fixes to watch the score respond.",
    ]},
    { h: "10. Scheduled re-audits and visibility alerts (Growth and above)", ps: [
      "Visibility is not a one time check. Scheduled re-audits run automatically and alert you on score drops and on crawler access flips, so a silent disappearance from AI answers never goes unnoticed.",
    ]},
    { h: "11. AI answer tracking (Agency)", ps: [
      "Define the questions your customers actually ask, and the platform runs them against ChatGPT, Perplexity and Google AI every day. You see when you are cited, when you are misrepresented, and when you are absent, with history, so you know the day AI starts recommending you and the moment it stops.",
    ]},
    { h: "12. The Reputation Risk Score (Growth and above)", ps: [
      "One number from 0 to 100 summarizes your reputation risk across public reviews, private feedback, AI visibility and review velocity. It is fully explainable: five weighted components, and every driver behind the score is named, so you always know what to fix first.",
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
      "Add competitors by searching for their business listing. Every morning the platform snapshots their rating and review count, computes momentum, and compares it to your own review pace. When a rival gains ground faster than you, a momentum alert reaches you the same week.",
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
  ],
};

const FR: Doc = {
  title: "Guide d'utilisation EchoRank",
  updated: "Dernière mise à jour : 6 juillet 2026",
  intro: "Ce guide couvre chaque fonction d'EchoRank en langage simple : ce qu'elle fait, où la trouver, et comment en tirer de la valeur dès le premier jour. La disponibilité par forfait est indiquée quand elle s'applique.",
  sections: [
    { h: "1. Créez votre compte", ps: [
      "Rendez-vous sur la page d'inscription, entrez votre nom, votre courriel professionnel, le nom de votre entreprise et un mot de passe d'au moins 8 caractères. Chaque nouveau compte démarre un essai gratuit de 14 jours, sans carte de crédit. Rien n'est facturé sans souscription.",
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
      "Chaque avis mérite une réponse, et c'est l'étape que la plupart des propriétaires sautent. EchoRank rédige une réponse professionnelle dans votre ton : elle remercie concrètement les clients satisfaits, reconnaît les problèmes sans argumenter, et invite les clients mécontents à poursuivre hors ligne. Vous relisez, ajustez au besoin, puis publiez. Rien n'est jamais publié sans votre approbation.",
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
  ],
};

const DE: Doc = {
  title: "EchoRank Benutzerhandbuch",
  updated: "Zuletzt aktualisiert: 6. Juli 2026",
  intro: "Dieses Handbuch erklärt jede Funktion von EchoRank in einfacher Sprache: was sie tut, wo sie zu finden ist und wie sie ab dem ersten Tag Nutzen bringt. Die Verfügbarkeit nach Plan ist angegeben, wo sie gilt.",
  sections: [
    { h: "1. Konto erstellen", ps: [
      "Gehen Sie zur Registrierungsseite, geben Sie Name, geschäftliche E-Mail, Firmenname und ein Passwort mit mindestens 8 Zeichen ein. Jedes neue Konto startet eine 14 Tage Testphase ohne Kreditkarte. Ohne Abo wird nichts berechnet.",
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
      "Jede Bewertung verdient eine Antwort, und genau das überspringen die meisten Inhaber. EchoRank entwirft eine professionelle Antwort in Ihrem Ton: konkreter Dank an zufriedene Kunden, Anerkennung von Problemen ohne Streit, Einladung an Unzufriedene, offline weiterzusprechen. Sie prüfen, passen bei Bedarf an und veröffentlichen. Nichts erscheint ohne Ihre Freigabe.",
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
  return { title: `${d.title} | EchoRank`, description: d.intro };
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
          <Link href={`/${locale}`} aria-label="EchoRank 360, home">
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
