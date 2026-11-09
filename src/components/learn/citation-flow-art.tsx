// "How ChatGPT decides what to cite", the flow diagram in the guide
// /learn/guides/how-to-get-cited-by-chatgpt ({k:"citationFlow"}).
//
// Original inline SVG, no third-party logos. Colours are the page's theme
// tokens (home2 .page: --text, --muted, --line, --surface, --gold), so it
// follows day and night. The SVG carries <title>/<desc>; the same flow is
// repeated as a visually hidden ordered list for screen readers, and the SVG
// itself is aria-hidden so it is not read twice. Labels in en / fr / de-CH.
// Server component.

import b from "@/app/[locale]/learn/_shared/learn.module.css";

type Lang = "en" | "fr" | "de";

interface FlowCopy {
  title: string;
  desc: string;
  ask: string[];
  decide: string[];
  no: string;
  yes: string;
  memory: string[];
  split: string[];
  pull: string[];
  read: string[];
  cite: string[];
  /** The text equivalent, in order. */
  steps: string[];
}

const COPY: Record<Lang, FlowCopy> = {
  en: {
    title: "How ChatGPT decides whether to cite your website",
    desc: "A flow: a customer asks ChatGPT a question; if it doesn't need the web it answers from memory and cites no pages; if it does, it searches, reads pages and cites about half of them.",
    ask: ["A customer asks ChatGPT", "a question"],
    decide: ["Does it need", "the web?"],
    no: "No",
    yes: "Yes",
    memory: ["Answers from memory:", "it can name you, but it", "won't cite your pages"],
    split: ["Splits the question into", "smaller searches"],
    pull: ["Pulls results from search", "providers (Bing among them)", "and OpenAI's own index"],
    read: ["Reads the pages' HTML"],
    cite: ["Cites about half of what", "it read, with links"],
    steps: [
      "A customer asks ChatGPT a question.",
      "ChatGPT decides: does it need the web?",
      "No: it answers from memory. It can name you, but it won't cite your pages.",
      "Yes: it splits the question into smaller searches.",
      "It pulls results from search providers (Bing among them) and OpenAI's own index.",
      "It reads the pages' HTML.",
      "It cites about half of what it read, with links.",
    ],
  },
  fr: {
    title: "Comment ChatGPT décide s'il cite votre site",
    desc: "Un parcours : un client pose une question à ChatGPT ; s'il n'a pas besoin du web, il répond de mémoire sans citer de pages ; sinon il cherche, lit des pages et en cite environ la moitié.",
    ask: ["Un client pose une", "question à ChatGPT"],
    decide: ["A-t-il besoin", "du web ?"],
    no: "Non",
    yes: "Oui",
    memory: ["Répond de mémoire :", "il peut vous nommer, mais", "ne citera pas vos pages"],
    split: ["Découpe la question en", "recherches plus courtes"],
    pull: ["Récupère des résultats de", "moteurs (dont Bing) et de", "l'index d'OpenAI"],
    read: ["Lit le HTML des pages"],
    cite: ["Cite environ la moitié de", "ce qu'il a lu, avec liens"],
    steps: [
      "Un client pose une question à ChatGPT.",
      "ChatGPT décide : a-t-il besoin du web ?",
      "Non : il répond de mémoire. Il peut vous nommer, mais ne citera pas vos pages.",
      "Oui : il découpe la question en recherches plus courtes.",
      "Il récupère des résultats de moteurs de recherche (dont Bing) et de l'index d'OpenAI.",
      "Il lit le HTML des pages.",
      "Il cite environ la moitié de ce qu'il a lu, avec des liens.",
    ],
  },
  de: {
    title: "Wie ChatGPT entscheidet, ob es Ihre Website zitiert",
    desc: "Ein Ablauf: Eine Kundin stellt ChatGPT eine Frage; braucht es das Web nicht, antwortet es aus dem Gedächtnis und zitiert keine Seiten; sonst sucht es, liest Seiten und zitiert etwa die Hälfte davon.",
    ask: ["Ein Kunde stellt ChatGPT", "eine Frage"],
    decide: ["Braucht es", "das Web?"],
    no: "Nein",
    yes: "Ja",
    memory: ["Antwortet aus dem Gedächtnis:", "kann Sie nennen, zitiert", "aber Ihre Seiten nicht"],
    split: ["Zerlegt die Frage in", "kleinere Suchen"],
    pull: ["Holt Ergebnisse von Such-", "anbietern (darunter Bing)", "und dem Index von OpenAI"],
    read: ["Liest das HTML der Seiten"],
    cite: ["Zitiert etwa die Hälfte des", "Gelesenen, mit Links"],
    steps: [
      "Ein Kunde stellt ChatGPT eine Frage.",
      "ChatGPT entscheidet: Braucht es das Web?",
      "Nein: Es antwortet aus dem Gedächtnis. Es kann Sie nennen, zitiert aber Ihre Seiten nicht.",
      "Ja: Es zerlegt die Frage in kleinere Suchen.",
      "Es holt Ergebnisse von Suchanbietern (darunter Bing) und aus dem Index von OpenAI.",
      "Es liest das HTML der Seiten.",
      "Es zitiert etwa die Hälfte des Gelesenen, mit Links.",
    ],
  },
};

const LINE = 18;

function Lines({ lines, cx, cy, weight }: { lines: string[]; cx: number; cy: number; weight?: number }) {
  const y0 = cy - ((lines.length - 1) * LINE) / 2 + 5;
  return (
    <text x={cx} y={y0} textAnchor="middle" fontSize={14} fontWeight={weight} fill="var(--text)">
      {lines.map((l, i) => (
        <tspan key={i} x={cx} y={y0 + i * LINE}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function Box({ x, y, w, h, lines, accent }: { x: number; y: number; w: number; h: number; lines: string[]; accent?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill="var(--surface)" stroke={accent ? "var(--gold)" : "var(--line)"} strokeWidth={accent ? 2 : 1.5} />
      <Lines lines={lines} cx={x + w / 2} cy={y + h / 2} />
    </g>
  );
}

export function CitationFlowArt({ locale }: { locale: string }) {
  const lang: Lang = locale.startsWith("fr") ? "fr" : locale.startsWith("de") ? "de" : "en";
  const c = COPY[lang];
  const arrow = { stroke: "var(--muted)", strokeWidth: 1.5, fill: "none", markerEnd: "url(#cf-arrow)" } as const;
  const yes = { stroke: "var(--gold)", strokeWidth: 2, fill: "none", markerEnd: "url(#cf-arrow-yes)" } as const;
  return (
    <figure className={b.figure} data-testid="citation-flow">
      <svg viewBox="0 0 640 572" width="100%" role="img" aria-labelledby="cf-title cf-desc" style={{ maxWidth: 640, height: "auto", display: "block" }}>
        <title id="cf-title">{c.title}</title>
        <desc id="cf-desc">{c.desc}</desc>
        <defs>
          <marker id="cf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
          </marker>
          <marker id="cf-arrow-yes" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--gold)" />
          </marker>
        </defs>

        <Box x={180} y={8} w={280} h={56} lines={c.ask} />
        <path d="M320,64 L320,96" {...arrow} />

        <polygon points="320,98 440,150 320,202 200,150" fill="var(--surface)" stroke="var(--line)" strokeWidth={1.5} />
        <Lines lines={c.decide} cx={320} cy={150} weight={600} />

        <path d="M200,150 L130,150 L130,234" {...arrow} />
        <text x={168} y={140} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--muted)">
          {c.no}
        </text>
        <Box x={10} y={236} w={240} h={84} lines={c.memory} />

        <path d="M440,150 L495,150 L495,234" {...yes} />
        <text x={466} y={140} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--goldText)">
          {c.yes}
        </text>
        <Box x={360} y={236} w={270} h={64} lines={c.split} accent />
        <path d="M495,300 L495,320" {...yes} />
        <Box x={360} y={322} w={270} h={84} lines={c.pull} accent />
        <path d="M495,406 L495,426" {...yes} />
        <Box x={360} y={428} w={270} h={48} lines={c.read} accent />
        <path d="M495,476 L495,496" {...yes} />
        <Box x={360} y={498} w={270} h={64} lines={c.cite} accent />
      </svg>
      <ol className={b.srOnly}>
        {c.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </figure>
  );
}
