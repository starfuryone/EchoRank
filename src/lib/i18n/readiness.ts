// src/lib/i18n/readiness.ts
//
// The AI readiness score's words in en / fr / de-CH: its label, the gates that
// cap it, its five groups and the fix for every check. Keyed by the ids the
// av-visibility sidecar emits (av-service ai_readiness.py: gate ids, check ids,
// group ids), so a gate or fix renders in the reader's language whatever
// English the sidecar wrote. An id this file does not know falls back to the
// sidecar's own English.
//
// Dependency-free: Client Components (AuditWidget, the dashboard) import it.
//
// LABEL HONESTY. The score asks no AI engine anything, so it is the "AI
// readiness score" everywhere. Real engine answers (tracked prompts, the
// snapshot) are "AI presence", shown beside it, never blended into it.

export type ReadinessLocale = "en" | "fr" | "de-CH";

/** Marketing (5 locales) and dashboard (3) both fold to these three. */
export function readinessLocale(locale: string | null | undefined): ReadinessLocale {
  const l = (locale ?? "").toLowerCase();
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de-CH";
  return "en";
}

export type GateId =
  | "placeholder" | "noindex" | "answer-bots-blocked" | "challenge"
  | "js-only" | "thin-homepage" | "few-pages" | "no-entity";
export type GroupId = "access" | "rendering" | "content" | "entity" | "discoverability";

type Params = Record<string, unknown>;

interface ReadinessCopy {
  label: string;
  presence: string;
  presenceNotTested: string;
  versionNote: string;
  lowConfidence: string;
  cappedAt: (cap: number, reason: string) => string;
  gatesTitle: string;
  topFixesTitle: string;
  recover: (points: number) => string;
  noFixes: string;
  allChecks: string;
  notRun: string;
  groups: Record<GroupId, string>;
  placeholderKinds: Record<string, string>;
  gates: Record<GateId, (p: Params) => string>;
  gateFixes: Record<GateId, string>;
  checks: Record<string, { title: string; fix: (p: Params) => string }>;
}

const list = (v: unknown) => (Array.isArray(v) ? v.map(String).join(", ") : "");

const en: ReadinessCopy = {
  label: "AI readiness score",
  presence: "AI presence",
  presenceNotTested: "not tested: this check asks no AI engine anything",
  versionNote: "Scoring updated Nov 2026: stricter on content and entity signals",
  lowConfidence: "Low confidence: too many checks could not run, so the score is capped at 70.",
  cappedAt: (cap, reason) => `Capped at ${cap}: ${reason}`,
  gatesTitle: "What caps your score",
  topFixesTitle: "Top 3 fixes",
  recover: (n) => `up to +${n} points`,
  noFixes: "Nothing left that would raise the score.",
  allChecks: "All checks",
  notRun: "not run",
  groups: {
    access: "Access",
    rendering: "Rendering",
    content: "Content substance",
    entity: "Entity & trust",
    discoverability: "Discoverability",
  },
  placeholderKinds: {
    parked: "the homepage is a parked or for-sale domain page",
    soon: "the homepage is a “coming soon” page",
    theme: "the site still shows the template’s placeholder text",
    lorem: "the pages are filled with lorem ipsum placeholder text",
  },
  gates: {
    placeholder: (p) => en.placeholderKinds[String(p.kind)] ?? en.placeholderKinds.parked,
    noindex: () => "the homepage tells search engines not to index it (noindex)",
    "answer-bots-blocked": () => "robots.txt blocks every major AI answer bot",
    challenge: () => "our crawler got a bot challenge page instead of your site",
    "js-only": () => "your content only appears after JavaScript runs",
    "thin-homepage": () => "homepage has under 150 words",
    "few-pages": (p) => `fewer than 5 indexable pages were found (${p.pages ?? 0})`,
    "no-entity": () => "no Organization or LocalBusiness schema and no About page",
  },
  gateFixes: {
    placeholder: "Replace the placeholder with your real site: who you are, what you offer, where, and how to reach you.",
    noindex: "Remove the noindex robots tag (or X-Robots-Tag header) from the homepage.",
    "answer-bots-blocked": "Allow OAI-SearchBot, ChatGPT-User, Claude-SearchBot and PerplexityBot in robots.txt.",
    challenge: "Let non-browser clients through your firewall’s bot challenge on public pages (in Cloudflare: Security > Bots).",
    "js-only": "Server-render or pre-render the homepage so its text is in the HTML the server sends.",
    "thin-homepage": "Write at least 150 words of specific copy on the homepage: services, area, prices, proof.",
    "few-pages": "Publish separate pages for your services, About and Contact, and list them in a sitemap.",
    "no-entity": "Add an About page and Organization or LocalBusiness JSON-LD that says who you are.",
  },
  checks: {
    "robots-answer-bots": { title: "Answer bots allowed in robots.txt", fix: () => "Allow the answer bots (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, PerplexityBot) in robots.txt; training crawlers such as GPTBot can stay blocked." },
    "home-reachable": { title: "Homepage answers with content", fix: () => "Serve your homepage’s text in the HTML, and let non-browser clients through any bot challenge." },
    "pages-reachable": { title: "Inner pages answer with content", fix: () => "Link your About, Services and Contact pages from the homepage, and make sure they return real text." },
    "explicit-welcome": { title: "AI answer bots explicitly welcomed", fix: () => "Add OAI-SearchBot, Claude-SearchBot and PerplexityBot groups with “Allow: /” to robots.txt." },
    "raw-content": { title: "Main content in the raw HTML", fix: () => "Serve at least 150 words of real, specific copy in the homepage HTML (server-side)." },
    "render-gap": { title: "Little hidden behind JavaScript", fix: () => "Server-render or pre-render what your visitors see (SSR/SSG)." },
    "main-words": { title: "Substantial main content", fix: () => "Write more specific copy on your homepage, About and Services pages: what you do, for whom, where, and for how much." },
    headings: { title: "Clear heading structure", fix: () => "Use one H1 that says what you do, and an H2 for each section." },
    answerable: { title: "Answer-ready formats (FAQ, lists, tables)", fix: () => "Answer the questions customers ask under question headings (with FAQPage markup), and use lists or a table for services and prices." },
    specifics: { title: "Specific facts", fix: () => "State the facts an answer can quote: prices, your address, opening hours, years in business, numbers." },
    "low-boilerplate": { title: "Low boilerplate", fix: () => "Trim repeated menus, banners and footers so the page’s own copy dominates." },
    dates: { title: "Visible dates", fix: () => "Show when key pages were last updated, and mark it up with dateModified." },
    "org-schema": { title: "Organization / LocalBusiness schema", fix: (p) => (p.found ? `Complete your JSON-LD: add ${list(p.missing)}.` : "Add Organization (or LocalBusiness) JSON-LD with name, url, logo, sameAs links to your profiles and, for a local business, the address.") },
    "about-page": { title: "About page", fix: () => "Publish an About page of 150+ words: who runs the business, since when, credentials, where you work." },
    "contact-page": { title: "Contact page", fix: () => "Publish a Contact page with your phone, email and street address written as text." },
    nap: { title: "Name, address and phone consistent", fix: () => "Use one name, address and phone, written the same way, in your JSON-LD, footer and Contact page." },
    identity: { title: "Owner or author identity", fix: () => "Name the owner or authors on the site and mark them up as a Person (founder or author)." },
    https: { title: "HTTPS", fix: () => "Serve the site over HTTPS and redirect HTTP to it." },
    sitemap: { title: "Valid XML sitemap", fix: () => "Publish an XML sitemap listing every page and reference it in robots.txt." },
    canonical: { title: "Canonical URL", fix: () => "Add a rel=canonical link pointing at each page’s own URL." },
    indexable: { title: "Homepage indexable", fix: () => "Remove the noindex robots tag from the homepage." },
    "titles-meta": { title: "Titles and meta descriptions", fix: () => "Give every page its own title and meta description." },
    "internal-links": { title: "Homepage links to key pages", fix: () => "Link About, Services and Contact from the homepage navigation." },
    "llms-txt": { title: "llms.txt", fix: () => "Publish /llms.txt: a “# Site name” line, a one-line summary, then sections listing your key pages as links." },
  },
};

const fr: ReadinessCopy = {
  label: "Score de préparation IA",
  presence: "Présence IA",
  presenceNotTested: "non testée : cette analyse n’interroge aucun moteur d’IA",
  versionNote: "Notation mise à jour en novembre 2026 : plus exigeante sur le contenu et l’identité de l’entreprise",
  lowConfidence: "Fiabilité faible : trop de vérifications n’ont pas pu s’exécuter, le score est donc plafonné à 70.",
  cappedAt: (cap, reason) => `Plafonné à ${cap} : ${reason}`,
  gatesTitle: "Ce qui plafonne votre score",
  topFixesTitle: "Les 3 corrections prioritaires",
  recover: (n) => `jusqu’à +${n} points`,
  noFixes: "Plus rien à corriger qui ferait monter le score.",
  allChecks: "Toutes les vérifications",
  notRun: "non exécutée",
  groups: {
    access: "Accès",
    rendering: "Rendu",
    content: "Substance du contenu",
    entity: "Identité et confiance",
    discoverability: "Découvrabilité",
  },
  placeholderKinds: {
    parked: "la page d’accueil est une page de domaine parqué ou à vendre",
    soon: "la page d’accueil est une page « bientôt en ligne »",
    theme: "le site affiche encore le texte d’exemple du modèle",
    lorem: "les pages sont remplies de faux texte lorem ipsum",
  },
  gates: {
    placeholder: (p) => fr.placeholderKinds[String(p.kind)] ?? fr.placeholderKinds.parked,
    noindex: () => "la page d’accueil demande aux moteurs de ne pas l’indexer (noindex)",
    "answer-bots-blocked": () => "le robots.txt bloque tous les principaux robots de réponse IA",
    challenge: () => "notre robot a reçu une page de vérification anti-bot au lieu de votre site",
    "js-only": () => "votre contenu n’apparaît qu’après l’exécution de JavaScript",
    "thin-homepage": () => "la page d’accueil compte moins de 150 mots",
    "few-pages": (p) => `moins de 5 pages indexables trouvées (${p.pages ?? 0})`,
    "no-entity": () => "ni schéma Organization ou LocalBusiness, ni page À propos",
  },
  gateFixes: {
    placeholder: "Remplacez la page provisoire par votre vrai site : qui vous êtes, ce que vous proposez, où, et comment vous joindre.",
    noindex: "Retirez la balise robots noindex (ou l’en-tête X-Robots-Tag) de la page d’accueil.",
    "answer-bots-blocked": "Autorisez OAI-SearchBot, ChatGPT-User, Claude-SearchBot et PerplexityBot dans le robots.txt.",
    challenge: "Laissez passer les clients autres que des navigateurs sur vos pages publiques (dans Cloudflare : Security > Bots).",
    "js-only": "Faites le rendu de la page d’accueil côté serveur (ou pré-rendu) pour que son texte figure dans le HTML envoyé.",
    "thin-homepage": "Rédigez au moins 150 mots précis sur la page d’accueil : services, secteur, prix, preuves.",
    "few-pages": "Publiez des pages distinctes pour vos services, la page À propos et la page Contact, et listez-les dans un sitemap.",
    "no-entity": "Ajoutez une page À propos et un JSON-LD Organization ou LocalBusiness qui dit qui vous êtes.",
  },
  checks: {
    "robots-answer-bots": { title: "Robots de réponse autorisés dans le robots.txt", fix: () => "Autorisez les robots de réponse (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, PerplexityBot) dans le robots.txt ; les robots d’entraînement comme GPTBot peuvent rester bloqués." },
    "home-reachable": { title: "La page d’accueil répond avec du contenu", fix: () => "Servez le texte de la page d’accueil dans le HTML et laissez passer les clients non navigateurs." },
    "pages-reachable": { title: "Les pages internes répondent avec du contenu", fix: () => "Liez vos pages À propos, Services et Contact depuis l’accueil et vérifiez qu’elles renvoient du vrai texte." },
    "explicit-welcome": { title: "Robots de réponse IA explicitement accueillis", fix: () => "Ajoutez au robots.txt des groupes OAI-SearchBot, Claude-SearchBot et PerplexityBot avec « Allow: / »." },
    "raw-content": { title: "Contenu principal dans le HTML brut", fix: () => "Servez au moins 150 mots de texte réel et précis dans le HTML de la page d’accueil (côté serveur)." },
    "render-gap": { title: "Peu de contenu caché derrière JavaScript", fix: () => "Faites le rendu côté serveur (SSR/SSG) de ce que voient vos visiteurs." },
    "main-words": { title: "Contenu principal substantiel", fix: () => "Étoffez l’accueil, la page À propos et les services : ce que vous faites, pour qui, où, à quel prix." },
    headings: { title: "Structure de titres claire", fix: () => "Un seul H1 qui dit ce que vous faites, et un H2 par section." },
    answerable: { title: "Formats prêts pour les réponses (FAQ, listes, tableaux)", fix: () => "Répondez aux questions de vos clients sous des titres en forme de question (avec le balisage FAQPage), et présentez services et prix en listes ou en tableau." },
    specifics: { title: "Faits précis", fix: () => "Donnez les faits qu’une réponse peut citer : prix, adresse, horaires, années d’activité, chiffres." },
    "low-boilerplate": { title: "Peu de contenu répétitif", fix: () => "Allégez menus, bannières et pieds de page répétés pour que le texte propre à la page domine." },
    dates: { title: "Dates visibles", fix: () => "Indiquez la date de dernière mise à jour des pages clés, balisée avec dateModified." },
    "org-schema": { title: "Schéma Organization / LocalBusiness", fix: (p) => (p.found ? `Complétez votre JSON-LD : ajoutez ${list(p.missing)}.` : "Ajoutez un JSON-LD Organization (ou LocalBusiness) avec name, url, logo, des liens sameAs vers vos profils et, pour un commerce local, l’adresse.") },
    "about-page": { title: "Page À propos", fix: () => "Publiez une page À propos de 150 mots ou plus : qui dirige l’entreprise, depuis quand, qualifications, zone d’activité." },
    "contact-page": { title: "Page Contact", fix: () => "Publiez une page Contact avec téléphone, courriel et adresse postale écrits en texte." },
    nap: { title: "Nom, adresse et téléphone cohérents", fix: () => "Utilisez un seul nom, une seule adresse et un seul téléphone, écrits de la même façon dans le JSON-LD, le pied de page et la page Contact." },
    identity: { title: "Identité du propriétaire ou de l’auteur", fix: () => "Nommez le propriétaire ou les auteurs sur le site et balisez-les comme Person (founder ou author)." },
    https: { title: "HTTPS", fix: () => "Servez le site en HTTPS et redirigez le HTTP vers celui-ci." },
    sitemap: { title: "Sitemap XML valide", fix: () => "Publiez un sitemap XML listant chaque page et déclarez-le dans le robots.txt." },
    canonical: { title: "URL canonique", fix: () => "Ajoutez un lien rel=canonical vers l’URL propre de chaque page." },
    indexable: { title: "Page d’accueil indexable", fix: () => "Retirez la balise robots noindex de la page d’accueil." },
    "titles-meta": { title: "Titres et méta-descriptions", fix: () => "Donnez à chaque page son propre titre et sa propre méta-description." },
    "internal-links": { title: "Liens de l’accueil vers les pages clés", fix: () => "Liez À propos, Services et Contact depuis la navigation de la page d’accueil." },
    "llms-txt": { title: "llms.txt", fix: () => "Publiez /llms.txt : une ligne « # Nom du site », un résumé d’une ligne, puis des sections qui listent vos pages clés en liens." },
  },
};

const de: ReadinessCopy = {
  label: "KI-Bereitschafts-Score",
  presence: "KI-Präsenz",
  presenceNotTested: "nicht getestet: diese Prüfung fragt keine KI-Suchmaschine",
  versionNote: "Bewertung im November 2026 aktualisiert: strenger bei Inhalt und Angaben zum Unternehmen",
  lowConfidence: "Geringe Aussagekraft: zu viele Prüfungen konnten nicht laufen, darum ist der Score auf 70 begrenzt.",
  cappedAt: (cap, reason) => `Auf ${cap} begrenzt: ${reason}`,
  gatesTitle: "Was Ihren Score begrenzt",
  topFixesTitle: "Die 3 wichtigsten Korrekturen",
  recover: (n) => `bis zu +${n} Punkte`,
  noFixes: "Nichts mehr, was den Score anheben würde.",
  allChecks: "Alle Prüfungen",
  notRun: "nicht gelaufen",
  groups: {
    access: "Zugang",
    rendering: "Darstellung",
    content: "Inhaltliche Substanz",
    entity: "Identität und Vertrauen",
    discoverability: "Auffindbarkeit",
  },
  placeholderKinds: {
    parked: "die Startseite ist eine geparkte oder zum Verkauf stehende Domain",
    soon: "die Startseite ist eine «Bald online»-Seite",
    theme: "die Website zeigt noch den Platzhaltertext der Vorlage",
    lorem: "die Seiten sind mit Lorem-ipsum-Platzhaltertext gefüllt",
  },
  gates: {
    placeholder: (p) => de.placeholderKinds[String(p.kind)] ?? de.placeholderKinds.parked,
    noindex: () => "die Startseite verbietet Suchmaschinen die Indexierung (noindex)",
    "answer-bots-blocked": () => "robots.txt sperrt alle wichtigen KI-Antwort-Bots",
    challenge: () => "unser Crawler erhielt statt Ihrer Website eine Bot-Prüfseite",
    "js-only": () => "Ihr Inhalt erscheint erst, wenn JavaScript läuft",
    "thin-homepage": () => "die Startseite hat weniger als 150 Wörter",
    "few-pages": (p) => `weniger als 5 indexierbare Seiten gefunden (${p.pages ?? 0})`,
    "no-entity": () => "weder Organization- noch LocalBusiness-Schema und keine Über-uns-Seite",
  },
  gateFixes: {
    placeholder: "Ersetzen Sie die Platzhalterseite durch Ihre echte Website: wer Sie sind, was Sie anbieten, wo und wie man Sie erreicht.",
    noindex: "Entfernen Sie das robots-Tag noindex (oder den X-Robots-Tag-Header) von der Startseite.",
    "answer-bots-blocked": "Erlauben Sie OAI-SearchBot, ChatGPT-User, Claude-SearchBot und PerplexityBot in der robots.txt.",
    challenge: "Lassen Sie Clients ohne Browser auf öffentlichen Seiten durch die Bot-Prüfung (in Cloudflare: Security > Bots).",
    "js-only": "Rendern Sie die Startseite serverseitig oder vorab, damit ihr Text im ausgelieferten HTML steht.",
    "thin-homepage": "Schreiben Sie mindestens 150 Wörter konkreten Text auf die Startseite: Leistungen, Region, Preise, Belege.",
    "few-pages": "Veröffentlichen Sie eigene Seiten für Leistungen, Über uns und Kontakt, und führen Sie sie in einer Sitemap auf.",
    "no-entity": "Ergänzen Sie eine Über-uns-Seite und Organization- oder LocalBusiness-JSON-LD, das sagt, wer Sie sind.",
  },
  checks: {
    "robots-answer-bots": { title: "Antwort-Bots in der robots.txt erlaubt", fix: () => "Erlauben Sie die Antwort-Bots (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, PerplexityBot) in der robots.txt; Trainings-Crawler wie GPTBot dürfen gesperrt bleiben." },
    "home-reachable": { title: "Startseite antwortet mit Inhalt", fix: () => "Liefern Sie den Text der Startseite im HTML aus und lassen Sie Clients ohne Browser durch." },
    "pages-reachable": { title: "Unterseiten antworten mit Inhalt", fix: () => "Verlinken Sie Über uns, Leistungen und Kontakt von der Startseite und sorgen Sie dafür, dass sie echten Text liefern." },
    "explicit-welcome": { title: "KI-Antwort-Bots ausdrücklich willkommen", fix: () => "Ergänzen Sie in der robots.txt Gruppen für OAI-SearchBot, Claude-SearchBot und PerplexityBot mit «Allow: /»." },
    "raw-content": { title: "Hauptinhalt im rohen HTML", fix: () => "Liefern Sie mindestens 150 Wörter echten, konkreten Text im HTML der Startseite aus (serverseitig)." },
    "render-gap": { title: "Wenig hinter JavaScript versteckt", fix: () => "Rendern Sie serverseitig oder vorab, was Ihre Besucher sehen (SSR/SSG)." },
    "main-words": { title: "Substanzieller Hauptinhalt", fix: () => "Schreiben Sie mehr konkreten Text auf Startseite, Über-uns- und Leistungsseiten: was Sie tun, für wen, wo und zu welchem Preis." },
    headings: { title: "Klare Überschriftenstruktur", fix: () => "Eine H1, die sagt, was Sie tun, und eine H2 für jeden Abschnitt." },
    answerable: { title: "Antwortfähige Formate (FAQ, Listen, Tabellen)", fix: () => "Beantworten Sie die Fragen Ihrer Kunden unter Fragen-Überschriften (mit FAQPage-Auszeichnung) und zeigen Sie Leistungen und Preise als Liste oder Tabelle." },
    specifics: { title: "Konkrete Fakten", fix: () => "Nennen Sie die Fakten, die eine Antwort zitieren kann: Preise, Adresse, Öffnungszeiten, Jahre im Geschäft, Zahlen." },
    "low-boilerplate": { title: "Wenig Wiederholungstext", fix: () => "Kürzen Sie wiederholte Menüs, Banner und Fusszeilen, damit der eigene Text der Seite überwiegt." },
    dates: { title: "Sichtbare Daten", fix: () => "Zeigen Sie, wann wichtige Seiten zuletzt aktualisiert wurden, ausgezeichnet mit dateModified." },
    "org-schema": { title: "Organization- / LocalBusiness-Schema", fix: (p) => (p.found ? `Vervollständigen Sie Ihr JSON-LD: ergänzen Sie ${list(p.missing)}.` : "Ergänzen Sie Organization- (oder LocalBusiness-) JSON-LD mit name, url, logo, sameAs-Links zu Ihren Profilen und, für ein lokales Geschäft, der Adresse.") },
    "about-page": { title: "Über-uns-Seite", fix: () => "Veröffentlichen Sie eine Über-uns-Seite mit 150 Wörtern oder mehr: wer das Geschäft führt, seit wann, Qualifikationen, Einzugsgebiet." },
    "contact-page": { title: "Kontaktseite", fix: () => "Veröffentlichen Sie eine Kontaktseite mit Telefon, E-Mail und Postadresse als Text." },
    nap: { title: "Name, Adresse und Telefon einheitlich", fix: () => "Verwenden Sie einen Namen, eine Adresse und eine Telefonnummer, gleich geschrieben im JSON-LD, in der Fusszeile und auf der Kontaktseite." },
    identity: { title: "Identität von Inhaber oder Autor", fix: () => "Nennen Sie Inhaber oder Autoren auf der Website und zeichnen Sie sie als Person aus (founder oder author)." },
    https: { title: "HTTPS", fix: () => "Liefern Sie die Website über HTTPS aus und leiten Sie HTTP darauf um." },
    sitemap: { title: "Gültige XML-Sitemap", fix: () => "Veröffentlichen Sie eine XML-Sitemap mit allen Seiten und verweisen Sie in der robots.txt darauf." },
    canonical: { title: "Kanonische URL", fix: () => "Ergänzen Sie einen rel=canonical-Link auf die eigene URL jeder Seite." },
    indexable: { title: "Startseite indexierbar", fix: () => "Entfernen Sie das robots-Tag noindex von der Startseite." },
    "titles-meta": { title: "Titel und Meta-Beschreibungen", fix: () => "Geben Sie jeder Seite einen eigenen Titel und eine eigene Meta-Beschreibung." },
    "internal-links": { title: "Startseite verlinkt die wichtigsten Seiten", fix: () => "Verlinken Sie Über uns, Leistungen und Kontakt in der Navigation der Startseite." },
    "llms-txt": { title: "llms.txt", fix: () => "Veröffentlichen Sie /llms.txt: eine Zeile «# Name der Website», eine einzeilige Zusammenfassung, dann Abschnitte mit Links zu Ihren wichtigsten Seiten." },
  },
};

export const READINESS_COPY: Record<ReadinessLocale, ReadinessCopy> = { en, fr, "de-CH": de };

// ─── The sidecar's shapes (av-service ai_readiness.py) ───────────────────────
export interface ReadinessGate {
  id: string;
  cap: number;
  reason?: string;
  params?: Params;
}
export interface ReadinessFix {
  id: string;
  kind: "gate" | "check";
  title?: string;
  fix?: string;
  recover?: number;
  params?: Params;
}
export interface ReadinessGroup {
  id: string;
  title?: string;
  points: number;
  max: number;
}

const isGate = (id: string): id is GateId => id in en.gates;

/** "Capped at 45: homepage has under 150 words", in the reader's language. */
export function gateLine(g: ReadinessGate, locale: ReadinessLocale): string {
  const c = READINESS_COPY[locale];
  const reason = isGate(g.id) ? c.gates[g.id](g.params ?? {}) : (g.reason ?? g.id);
  return c.cappedAt(g.cap, reason);
}

/** The top fixes as {title, fix, recover}, localized by id (sidecar English as the fallback). */
export function fixLines(
  fixes: ReadinessFix[] | null | undefined,
  locale: ReadinessLocale,
): { id: string; title: string; fix: string; recover: number }[] {
  const c = READINESS_COPY[locale];
  return (fixes ?? []).map((f) => {
    const recover = Math.max(0, Math.round(Number(f.recover) || 0));
    if (f.kind === "gate" && isGate(f.id)) {
      return { id: f.id, title: c.gates[f.id](f.params ?? {}), fix: c.gateFixes[f.id], recover };
    }
    const known = c.checks[f.id];
    return {
      id: f.id,
      title: known?.title ?? f.title ?? f.id,
      fix: known ? known.fix(f.params ?? {}) : (f.fix ?? ""),
      recover,
    };
  });
}

export function groupTitle(g: ReadinessGroup, locale: ReadinessLocale): string {
  return (READINESS_COPY[locale].groups as Record<string, string>)[g.id] ?? g.title ?? g.id;
}
