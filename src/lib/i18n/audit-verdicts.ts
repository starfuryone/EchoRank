// src/lib/i18n/audit-verdicts.ts
//
// The free audit's pass/fail verdicts in fr and de-CH. The sidecar
// (av-service/free_audit_checks.py) writes each verdict's English title /
// detail / fix plus a stable `key` (its VERDICT_KEYS) and `params` (the values
// in the text, lists as codes). English renders the sidecar's own strings; fr
// and de-CH render from here by key. A verdict without a key (an older sidecar)
// or with a key this catalog does not know falls back to the English, never to
// a blank.
//
// Cloudflare's menu names (Security → Bots → …) stay in English: they are the
// labels on Cloudflare's own dashboard.
//
// No React and no server imports: the /visibility client component uses it.

import type { DashLocale } from "./dashboard";

export type AuditVerdict = {
  id: string;
  title: string;
  /** null = "check": something the audit cannot see from outside. */
  pass: boolean | null;
  detail: string;
  fix: string;
  key?: string;
  params?: Record<string, unknown>;
};

type Text = { title: string; detail: string; fix: string };
type P = Record<string, unknown>;

interface VerdictCopy {
  crawlers: Record<string, string>;
  cfSignals: Record<string, string>;
  llmsProblems: Record<string, string>;
  napSources: Record<string, string>;
  napWhat: Record<string, string>;
  answerSignals: Record<string, string>;
  /** "a, b and c" in the locale. */
  list: (items: string[]) => string;
  verdicts: Record<string, (p: P, c: VerdictCopy) => Text>;
}

/** Every key the sidecar can emit (mirrors free_audit_checks.VERDICT_KEYS). */
export const AUDIT_VERDICT_KEYS = [
  "robots.blocked", "robots.partial", "robots.allowed", "robots.none",
  "signal.blocks", "signal.ok", "signal.none",
  "cloudflare.detected", "cloudflare.none",
  "llms.missing", "llms.invalid", "llms.valid",
  "js.flagged", "js.ok",
  "nap.none", "nap.single", "nap.match", "nap.differ",
  "answer.ok", "answer.weak",
] as const;

const s = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const arr = (v: unknown) => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);
const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const join = (last: string) => (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${last} ${items[items.length - 1]}`;
/** The crawler's name, and its short form for the fix ("OpenAI GPTBot (training)" → "OpenAI GPTBot"). */
const crawler = (p: P, c: VerdictCopy) => {
  const token = s(p.token);
  const name = c.crawlers[token] ?? token;
  return { token, name, short: name.split(" (")[0] };
};
const mapped = (codes: string[], map: Record<string, string>) => codes.map((k) => map[k] ?? k);

const FR: VerdictCopy = {
  crawlers: {
    GPTBot: "OpenAI GPTBot (entraînement)",
    "OAI-SearchBot": "Recherche OpenAI (ChatGPT search)",
    "ChatGPT-User": "ChatGPT pour le compte d'un utilisateur",
    ClaudeBot: "Anthropic ClaudeBot",
    "Claude-User": "Claude pour le compte d'un utilisateur",
    "anthropic-ai": "Anthropic (ancien jeton)",
    PerplexityBot: "Perplexity",
    "Perplexity-User": "Perplexity pour le compte d'un utilisateur",
    "Google-Extended": "Google Gemini / entraînement IA",
    "Applebot-Extended": "Apple Intelligence",
    CCBot: "Common Crawl",
    "meta-externalagent": "Meta AI",
    Bytespider: "ByteDance",
  },
  cfSignals: {
    "cf-ray": "un en-tête cf-ray",
    server: "Server: cloudflare",
    "managed-robots": "un robots.txt géré par Cloudflare",
  },
  llmsProblems: {
    html: "c'est une page HTML, pas un fichier texte",
    title: "il ne commence pas par une ligne de titre « # »",
    links: "il ne contient aucun lien markdown",
    size: "il dépasse 1 Mo",
  },
  napSources: { schema: "les données structurées", footer: "le pied de page", contact: "la page de contact" },
  napWhat: { phones: "numéros de téléphone", postcodes: "codes postaux" },
  answerSignals: {
    questions: "des titres en forme de question",
    faq: "un balisage FAQ",
    lists: "des listes",
    intro: "une réponse courte en ouverture",
    date: "une date visible",
  },
  list: join("et"),
  verdicts: {
    "robots.blocked": (p, c) => {
      const { token, name, short } = crawler(p, c);
      return {
        title: `${name} peut lire votre site`,
        detail: `Le robots.txt interdit tout le site à ${token} (Disallow: /).`,
        fix: `Supprimez la règle « Disallow: / » pour ${token} (ou pour « * ») dans le robots.txt si vous voulez que ${short} lise et cite vos pages.`,
      };
    },
    "robots.partial": (p, c) => {
      const { token, name } = crawler(p, c);
      return { title: `${name} peut lire votre site`, detail: `${token} est autorisé, sauf pour : ${s(p.paths)}.`, fix: "" };
    },
    "robots.allowed": (p, c) => {
      const { token, name } = crawler(p, c);
      return { title: `${name} peut lire votre site`, detail: `${token} est autorisé.`, fix: "" };
    },
    "robots.none": (p, c) => ({
      title: `${crawler(p, c).name} peut lire votre site`,
      detail: "Pas de robots.txt : tous les robots sont autorisés.",
      fix: "",
    }),
    "signal.blocks": (p) => ({
      title: "Les signaux de contenu permettent aux réponses IA d'utiliser vos pages",
      detail: `Le robots.txt déclare Content-Signal : ${s(p.signals)}${p.managed ? " (robots.txt géré par Cloudflare)." : "."}`,
      fix: "Indiquez « ai-input=yes » et « search=yes » dans la ligne Content-Signal (dans Cloudflare : Security > Bots > Manage your robots.txt) pour que les réponses IA puissent utiliser votre contenu ; « ai-train » peut rester à « no ».",
    }),
    "signal.ok": (p) => ({
      title: "Les signaux de contenu permettent aux réponses IA d'utiliser vos pages",
      detail: `Le robots.txt déclare Content-Signal : ${s(p.signals)}${p.managed ? " (robots.txt géré par Cloudflare)." : "."}`,
      fix: "",
    }),
    "signal.none": () => ({
      title: "Les signaux de contenu permettent aux réponses IA d'utiliser vos pages",
      detail: "Aucune ligne Content-Signal dans le robots.txt : aucune préférence d'usage n'est déclarée.",
      fix: "",
    }),
    "cloudflare.detected": (p, c) => ({
      title: "Blocage des robots IA par Cloudflare",
      detail: `Cloudflare détecté (${mapped(arr(p.found), c.cfSignals).join(", ")}).`,
      fix: "Si vous utilisez Cloudflare, vérifiez Security → Bots → Block AI bots ; nous ne pouvons pas voir ce réglage de l'extérieur.",
    }),
    "cloudflare.none": () => ({
      title: "Blocage des robots IA par Cloudflare",
      detail: "Cloudflare non détecté sur votre page d'accueil.",
      fix: "",
    }),
    "llms.missing": () => ({
      title: "Le fichier llms.txt est présent et valide",
      detail: "Pas de fichier /llms.txt.",
      fix: "Publiez /llms.txt : une ligne « # Nom du site », un résumé d'une ligne « > résumé », puis des sections « ## » qui listent vos pages clés sous forme de liens markdown.",
    }),
    "llms.invalid": (p, c) => ({
      title: "Le fichier llms.txt est présent et valide",
      detail: `/llms.txt existe, mais ${mapped(arr(p.problems), c.llmsProblems).join(" ; ")}.`,
      fix: "Réécrivez /llms.txt en markdown simple : « # Nom du site », un « > résumé », puis des sections « ## » de liens « - [Page](https://…) : ce qu'elle couvre ».",
    }),
    "llms.valid": (p) => ({
      title: "Le fichier llms.txt est présent et valide",
      detail: `/llms.txt est valide (${n(p.links)} ${n(p.links) > 1 ? "liens" : "lien"}).`,
      fix: "",
    }),
    "js.flagged": (p) => ({
      title: "Votre contenu est lisible sans JavaScript",
      detail: `Le code source de la page ne contient que ${n(p.textLen)} caractères de texte${s(p.framework) ? ` (coquille d'application ${s(p.framework)})` : ""} : la plupart des robots IA n'exécutent pas JavaScript et verraient une page presque vide.`,
      fix: "Rendez le contenu principal côté serveur ou pré-rendez-le (SSR/SSG), puis vérifiez avec la comparaison rendue d'AI Lens.",
    }),
    "js.ok": () => ({
      title: "Votre contenu est lisible sans JavaScript",
      detail: "Le code source de la page contient déjà son texte ; aucun rendu n'est nécessaire.",
      fix: "",
    }),
    "nap.none": () => ({
      title: "Nom, adresse et téléphone concordent partout",
      detail: "Aucun numéro de téléphone trouvé dans vos données structurées, votre pied de page ou votre page de contact.",
      fix: "Publiez le même nom d'entreprise, la même adresse et le même téléphone dans un bloc JSON-LD LocalBusiness/Organization, dans le pied de page du site et sur la page de contact.",
    }),
    "nap.single": (p, c) => ({
      title: "Nom, adresse et téléphone concordent partout",
      detail: `Votre téléphone n'apparaît que dans ${c.napSources[s(p.only)] ?? s(p.only)} : les moteurs IA ne peuvent pas le recouper.`,
      fix: "Reprenez exactement le même nom, la même adresse et le même téléphone dans le JSON-LD, le pied de page et la page de contact.",
    }),
    "nap.match": (p, c) => ({
      title: "Nom, adresse et téléphone concordent partout",
      detail: `Le même téléphone apparaît dans ${c.list(mapped(arr(p.sources), c.napSources))}${s(p.name) ? ` pour ${s(p.name)}` : ""}.`,
      fix: "",
    }),
    "nap.differ": (p, c) => ({
      title: "Nom, adresse et téléphone concordent partout",
      detail: `Les ${c.napWhat[s(p.what)] ?? s(p.what)} diffèrent entre ${c.list(mapped(arr(p.sources), c.napSources))}.`,
      fix: "Utilisez un seul nom, une seule adresse et un seul téléphone, écrits de la même façon, dans le JSON-LD, le pied de page et la page de contact : les moteurs IA et les annuaires font confiance aux informations qui concordent.",
    }),
    "answer.ok": (p, c) => answerFr(p, c, ""),
    "answer.weak": (p, c) =>
      answerFr(
        p,
        c,
        `Ajoutez ${c.list(mapped(arr(p.missing), c.answerSignals))} : formulez les titres clés comme les questions de vos clients, répondez dès la première phrase, utilisez des listes et balisez vos FAQ.`,
      ),
  },
};

function answerFr(p: P, c: VerdictCopy, fix: string): Text {
  const have = mapped(arr(p.have), c.answerSignals);
  return {
    title: "Vos pages sont rédigées pour que les réponses IA puissent les citer",
    detail: `Signaux de réponse trouvés : ${have.length} sur 5${have.length ? ` (${c.list(have)})` : ""}.`,
    fix,
  };
}

const DE: VerdictCopy = {
  crawlers: {
    GPTBot: "OpenAI GPTBot (Training)",
    "OAI-SearchBot": "OpenAI-Suche (ChatGPT search)",
    "ChatGPT-User": "ChatGPT im Auftrag einer Person",
    ClaudeBot: "Anthropic ClaudeBot",
    "Claude-User": "Claude im Auftrag einer Person",
    "anthropic-ai": "Anthropic (altes Token)",
    PerplexityBot: "Perplexity",
    "Perplexity-User": "Perplexity im Auftrag einer Person",
    "Google-Extended": "Google Gemini / KI-Training",
    "Applebot-Extended": "Apple Intelligence",
    CCBot: "Common Crawl",
    "meta-externalagent": "Meta AI",
    Bytespider: "ByteDance",
  },
  cfSignals: {
    "cf-ray": "ein cf-ray-Header",
    server: "Server: cloudflare",
    "managed-robots": "eine von Cloudflare verwaltete robots.txt",
  },
  llmsProblems: {
    html: "es ist eine HTML-Seite, keine Textdatei",
    title: "es beginnt nicht mit einer Titelzeile «# »",
    links: "es enthält keine Markdown-Links",
    size: "es ist grösser als 1 MB",
  },
  // Dative: "nur in der Fusszeile", "zwischen den strukturierten Daten und der Kontaktseite".
  napSources: { schema: "den strukturierten Daten", footer: "der Fusszeile", contact: "der Kontaktseite" },
  napWhat: { phones: "Telefonnummern", postcodes: "Postleitzahlen" },
  answerSignals: {
    questions: "Fragen als Überschriften",
    faq: "FAQ-Auszeichnung",
    lists: "Listen",
    intro: "eine kurze Antwort zu Beginn",
    date: "ein sichtbares Datum",
  },
  list: join("und"),
  verdicts: {
    "robots.blocked": (p, c) => {
      const { token, name, short } = crawler(p, c);
      return {
        title: `${name} kann Ihre Website lesen`,
        detail: `robots.txt sperrt ${token} für die ganze Website (Disallow: /).`,
        fix: `Entfernen Sie die Regel «Disallow: /» für ${token} (oder für «*») in robots.txt, wenn ${short} Ihre Seiten lesen und zitieren soll.`,
      };
    },
    "robots.partial": (p, c) => {
      const { token, name } = crawler(p, c);
      return { title: `${name} kann Ihre Website lesen`, detail: `${token} ist zugelassen, ausser für: ${s(p.paths)}.`, fix: "" };
    },
    "robots.allowed": (p, c) => {
      const { token, name } = crawler(p, c);
      return { title: `${name} kann Ihre Website lesen`, detail: `${token} ist zugelassen.`, fix: "" };
    },
    "robots.none": (p, c) => ({
      title: `${crawler(p, c).name} kann Ihre Website lesen`,
      detail: "Keine robots.txt: Alle Crawler sind zugelassen.",
      fix: "",
    }),
    "signal.blocks": (p) => ({
      title: "Content-Signale erlauben KI-Antworten, Ihre Seiten zu nutzen",
      detail: `robots.txt deklariert Content-Signal: ${s(p.signals)}${p.managed ? " (von Cloudflare verwaltete robots.txt)." : "."}`,
      fix: "Setzen Sie «ai-input=yes» und «search=yes» in der Content-Signal-Zeile (in Cloudflare: Security > Bots > Manage your robots.txt), damit KI-Antworten Ihre Inhalte nutzen dürfen; «ai-train» kann auf «no» bleiben.",
    }),
    "signal.ok": (p) => ({
      title: "Content-Signale erlauben KI-Antworten, Ihre Seiten zu nutzen",
      detail: `robots.txt deklariert Content-Signal: ${s(p.signals)}${p.managed ? " (von Cloudflare verwaltete robots.txt)." : "."}`,
      fix: "",
    }),
    "signal.none": () => ({
      title: "Content-Signale erlauben KI-Antworten, Ihre Seiten zu nutzen",
      detail: "Keine Content-Signal-Zeile in robots.txt: Es ist keine Nutzungspräferenz deklariert.",
      fix: "",
    }),
    "cloudflare.detected": (p, c) => ({
      title: "KI-Bot-Sperre von Cloudflare",
      detail: `Cloudflare erkannt (${mapped(arr(p.found), c.cfSignals).join(", ")}).`,
      fix: "Wenn Sie Cloudflare nutzen, prüfen Sie Security → Bots → Block AI bots; diese Einstellung können wir von aussen nicht sehen.",
    }),
    "cloudflare.none": () => ({
      title: "KI-Bot-Sperre von Cloudflare",
      detail: "Auf Ihrer Startseite wurde kein Cloudflare erkannt.",
      fix: "",
    }),
    "llms.missing": () => ({
      title: "llms.txt ist vorhanden und gültig",
      detail: "Keine /llms.txt-Datei.",
      fix: "Veröffentlichen Sie /llms.txt: eine Zeile «# Name der Website», eine einzeilige «> Zusammenfassung», dann «## »-Abschnitte, die Ihre wichtigsten Seiten als Markdown-Links auflisten.",
    }),
    "llms.invalid": (p, c) => ({
      title: "llms.txt ist vorhanden und gültig",
      detail: `/llms.txt ist vorhanden, aber ${mapped(arr(p.problems), c.llmsProblems).join("; ")}.`,
      fix: "Schreiben Sie /llms.txt als einfaches Markdown neu: «# Name der Website», eine «> Zusammenfassung», dann «## »-Abschnitte mit Links der Form «- [Seite](https://…): worum es geht».",
    }),
    "llms.valid": (p) => ({
      title: "llms.txt ist vorhanden und gültig",
      detail: `/llms.txt ist gültig (${n(p.links)} ${n(p.links) === 1 ? "Link" : "Links"}).`,
      fix: "",
    }),
    "js.flagged": (p) => ({
      title: "Ihr Inhalt ist ohne JavaScript lesbar",
      detail: `Der Quelltext der Seite enthält nur ${n(p.textLen)} Zeichen Text${s(p.framework) ? ` (${s(p.framework)}-App-Gerüst)` : ""}: Die meisten KI-Crawler führen kein JavaScript aus und sähen eine fast leere Seite.`,
      fix: "Rendern Sie den Hauptinhalt serverseitig oder vorab (SSR/SSG) und prüfen Sie das Ergebnis dann mit dem Rendering-Vergleich von AI Lens.",
    }),
    "js.ok": () => ({
      title: "Ihr Inhalt ist ohne JavaScript lesbar",
      detail: "Der Quelltext der Seite enthält seinen Text bereits; es ist kein Rendering nötig.",
      fix: "",
    }),
    "nap.none": () => ({
      title: "Name, Adresse und Telefon stimmen überall überein",
      detail: "Keine Telefonnummer in Ihren strukturierten Daten, Ihrer Fusszeile oder Ihrer Kontaktseite gefunden.",
      fix: "Veröffentlichen Sie denselben Firmennamen, dieselbe Adresse und dieselbe Telefonnummer in einem JSON-LD-Block LocalBusiness/Organization, in der Fusszeile der Website und auf der Kontaktseite.",
    }),
    "nap.single": (p, c) => ({
      title: "Name, Adresse und Telefon stimmen überall überein",
      detail: `Ihre Telefonnummer steht nur in ${c.napSources[s(p.only)] ?? s(p.only)}, deshalb können KI-Systeme sie nicht abgleichen.`,
      fix: "Wiederholen Sie genau denselben Namen, dieselbe Adresse und dieselbe Telefonnummer im JSON-LD, in der Fusszeile und auf der Kontaktseite.",
    }),
    "nap.match": (p, c) => ({
      title: "Name, Adresse und Telefon stimmen überall überein",
      detail: `Dieselbe Telefonnummer steht in ${c.list(mapped(arr(p.sources), c.napSources))}${s(p.name) ? ` für ${s(p.name)}` : ""}.`,
      fix: "",
    }),
    "nap.differ": (p, c) => ({
      title: "Name, Adresse und Telefon stimmen überall überein",
      detail: `Die ${c.napWhat[s(p.what)] ?? s(p.what)} unterscheiden sich zwischen ${c.list(mapped(arr(p.sources), c.napSources))}.`,
      fix: "Verwenden Sie einen Namen, eine Adresse und eine Telefonnummer, überall gleich geschrieben, im JSON-LD, in der Fusszeile und auf der Kontaktseite; KI-Systeme und Verzeichnisse vertrauen Angaben, die übereinstimmen.",
    }),
    "answer.ok": (p, c) => answerDe(p, c, ""),
    "answer.weak": (p, c) =>
      answerDe(
        p,
        c,
        `Ergänzen Sie ${c.list(mapped(arr(p.missing), c.answerSignals))}: Formulieren Sie wichtige Überschriften als die Fragen Ihrer Kundschaft, beantworten Sie jede im ersten Satz, nutzen Sie Listen und zeichnen Sie FAQs aus.`,
      ),
  },
};

function answerDe(p: P, c: VerdictCopy, fix: string): Text {
  const have = mapped(arr(p.have), c.answerSignals);
  return {
    title: "Ihre Seiten sind so geschrieben, dass KI-Antworten sie zitieren können",
    detail: `Gefundene Antwort-Signale: ${have.length} von 5${have.length ? ` (${c.list(have)})` : ""}.`,
    fix,
  };
}

export const AUDIT_VERDICT_COPY: Record<Exclude<DashLocale, "en">, VerdictCopy> = { fr: FR, "de-CH": DE };

/**
 * The verdict's title / detail / fix in `locale`. English, a verdict without a
 * key, or a key the catalog does not know: the sidecar's English as sent. A
 * passing verdict keeps fix "" (the catalog's fix is for failures and checks).
 */
export function localizeAuditVerdict<V extends AuditVerdict>(v: V, locale: DashLocale): V {
  if (locale === "en" || !v.key) return v;
  const c = AUDIT_VERDICT_COPY[locale];
  const render = c.verdicts[v.key];
  if (!render) return v;
  const t = render(v.params ?? {}, c);
  return { ...v, title: t.title, detail: t.detail, fix: v.pass === true ? "" : t.fix };
}
