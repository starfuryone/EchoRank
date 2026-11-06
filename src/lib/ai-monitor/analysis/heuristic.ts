// src/lib/ai-monitor/analysis/heuristic.ts
//
// The analysis pass without a model call, for most answers.
//
// What the ranking pass (./entities.ts, one Haiku call per answer) produced —
// the entities an answer puts forward in order, the brand's place among them,
// and the tone toward the brand — read from the text instead:
//
//   ENTITIES   list items first: the bolded or linked name that opens an item,
//              or the name-like text before its colon/dash. Then names bolded
//              in prose, then known brand and competitor names in the order
//              they first appear. resolveEntities() (./entities.ts) turns that
//              list into the brand's position and the competitors, exactly as
//              it does for the model's list; classifyEntity() still decides
//              which are rivals.
//   TONE       an en/fr/de lexicon scored over the sentences that name the
//              brand, with negation ("not", "pas", "nicht", "kein") flipping
//              the next word. A brand listed with no evaluative words is
//              POSITIVE (it was put forward), named in prose with none is
//              NEUTRAL. Only a window with both kinds of words and no clear
//              majority is UNSURE — and only then is a model asked, for the
//              tone alone (./analyze-response.ts).
//
// Pure: no I/O, no env. The tests drive it directly.

import { fold, findNameHits, maskCitations } from "./deterministic";
import type { Sentiment } from "./entities";

/** More entities than any real recommendation list (./entities.ts caps the model's too). */
export const MAX_HEURISTIC_ENTITIES = 25;

const LIST_ITEM = /^\s*(?:\d+[.)]|[-*•])\s+(.*)$/;
const LEADING_EMPHASIS = /^(?:\*\*|__)(.+?)(?:\*\*|__)/;
const LEADING_LINK = /^\[([^\]]+)\]\([^)]*\)/;
const PROSE_BOLD = /(?:\*\*|__)([^*_\n]{2,60}?)(?:\*\*|__)/g;

/**
 * Words that open a list item that is advice, not a name ("Check reviews: …").
 * Folded, en/fr/de.
 */
const NOT_A_NAME = new Set(
  [
    "check", "look", "consider", "ask", "use", "choose", "compare", "read", "find", "make", "get",
    "avoid", "keep", "try", "search", "call", "visit", "contact", "verify", "start", "note", "step",
    "the", "a", "an", "how", "what", "why", "when", "where", "which", "who", "if", "for", "with",
    "pricing", "price", "cost", "costs", "features", "reviews", "location", "experience", "pros",
    "cons", "summary", "overview", "conclusion", "tip", "tips", "bottom line", "best for",
    "verifiez", "comparez", "demandez", "lisez", "le", "la", "les", "un", "une", "des", "prix",
    "avis", "pour", "comment", "pourquoi", "prufen", "vergleichen", "fragen", "lesen", "der",
    "die", "das", "ein", "eine", "preis", "preise", "kosten", "bewertungen", "fur", "wie", "warum",
  ].map((w) => fold(w)),
);

/** A candidate looks like a name: short, starts with a letter or digit, not advice. */
function nameLike(candidate: string): boolean {
  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 6 || candidate.length > 60) return false;
  if (!/^[\p{Lu}\p{N}]/u.test(candidate)) return false;
  const folded = fold(candidate);
  if (NOT_A_NAME.has(folded) || NOT_A_NAME.has(fold(words[0]))) return false;
  return true;
}

function clean(candidate: string): string {
  return candidate
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s:;,.–—-]+$/u, "")
    .trim();
}

/** The name an item opens with, or null when it does not open with one. */
function itemName(item: string): string | null {
  const body = item.trim().replace(/^#+\s*/, "");
  const emphasis = LEADING_EMPHASIS.exec(body);
  if (emphasis) {
    const name = clean(emphasis[1].replace(LEADING_LINK, "$1"));
    return nameLike(name) ? name : null;
  }
  const link = LEADING_LINK.exec(body);
  if (link) {
    const name = clean(link[1]);
    return nameLike(name) ? name : null;
  }
  const head = body.split(/:|\s[–—-]\s|\(|,/)[0] ?? "";
  const name = clean(head);
  return nameLike(name) ? name : null;
}

/** Items of the first list with at least two items, in order. */
function firstList(answer: string): string[] {
  let current: string[] = [];
  for (const line of answer.split(/\r?\n/)) {
    const m = LIST_ITEM.exec(line);
    if (m) {
      current.push(m[1]);
    } else if (line.trim() !== "" && current.length > 0) {
      if (current.length >= 2) return current;
      current = [];
    }
  }
  return current.length >= 2 ? current : [];
}

/**
 * The entities the answer puts forward, in the order it presents them.
 * `knownNames` are the brand's own spellings and its known competitors.
 */
export function extractEntitiesHeuristic(answer: string, knownNames: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const key = fold(name);
    if (!key || seen.has(key) || out.length >= MAX_HEURISTIC_ENTITIES) return;
    seen.add(key);
    out.push(name);
  };

  for (const item of firstList(answer)) {
    const name = itemName(item);
    if (name) add(name);
  }

  for (const match of answer.matchAll(PROSE_BOLD)) {
    const name = clean(match[1]);
    if (nameLike(name)) add(name);
  }

  // Known names in the order they first appear in the prose (citations masked).
  const searchable = maskCitations(fold(answer));
  const known = knownNames
    .map((name) => name.trim())
    .filter((name) => name.length >= 2)
    .map((name) => ({ name, at: findNameHits(searchable, [name])[0]?.start ?? -1 }))
    .filter((k) => k.at >= 0)
    .sort((a, b) => a.at - b.at);
  for (const k of known) {
    // Skip a known name the list already carries under a longer form
    // ("Acme" when the list said "Acme Plumbing").
    if (out.some((name) => findNameHits(fold(name), [k.name]).length > 0)) continue;
    add(k.name);
  }
  return out;
}

// ─── Tone ───────────────────────────────────────────────────────────────────

const POSITIVE = new Set(
  [
    // en
    "best", "great", "excellent", "top", "recommended", "recommend", "reliable", "trusted",
    "popular", "leading", "strong", "outstanding", "affordable", "fast", "friendly", "professional",
    "reputable", "favorite", "favourite", "ideal", "standout", "solid", "highly", "praised",
    "well-reviewed", "well-known", "excels", "good", "quality", "responsive", "helpful",
    // fr
    "meilleur", "meilleure", "meilleurs", "excellent", "excellente", "recommande", "recommandee",
    "fiable", "reconnu", "reconnue", "populaire", "abordable", "rapide", "professionnel",
    "professionnelle", "apprecie", "appreciee", "solide", "bon", "bonne", "qualite", "reputee",
    // de
    "beste", "besten", "bester", "hervorragend", "empfohlen", "empfehlenswert", "zuverlassig",
    "beliebt", "fuhrend", "gunstig", "schnell", "freundlich", "professionell", "gut", "gute",
    "guter", "solide", "renommiert", "qualitat", "top",
  ].map((w) => fold(w)),
);

const NEGATIVE = new Set(
  [
    // en
    "bad", "poor", "worst", "avoid", "expensive", "overpriced", "slow", "unreliable", "complaints",
    "complaint", "scam", "issues", "problems", "problem", "lawsuit", "rude", "outdated", "limited",
    "lacks", "lacking", "negative", "criticized", "criticised", "disappointing", "mixed", "drawbacks",
    "downside", "concerns", "warning", "fraud", "closed",
    // fr
    "mauvais", "mauvaise", "pire", "eviter", "cher", "chere", "lent", "lente", "plaintes", "plainte",
    "arnaque", "problemes", "probleme", "decevant", "decevante", "critique", "critiques", "inconvenient",
    "inconvenients", "ferme", "fermee",
    // de
    "schlecht", "schlechte", "schlechteste", "vermeiden", "teuer", "uberteuert", "langsam",
    "unzuverlassig", "beschwerden", "beschwerde", "betrug", "probleme", "problem", "enttauschend",
    "kritik", "nachteile", "nachteil", "geschlossen", "veraltet",
  ].map((w) => fold(w)),
);

const NEGATORS = new Set(
  ["not", "no", "never", "isn't", "isnt", "doesn't", "doesnt", "without", "pas", "jamais", "sans", "aucun", "aucune", "nicht", "kein", "keine", "keinen", "ohne", "nie"].map(
    (w) => fold(w),
  ),
);

export interface LexiconTone {
  /** Null when the lexicon is unsure and a model should decide. */
  sentiment: Sentiment | null;
  positive: number;
  negative: number;
}

/** Sentences of the answer that name the brand. */
function brandSentences(answer: string, names: readonly string[]): string[] {
  return answer
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((s) => s.trim())
    .filter((s) => s && findNameHits(maskCitations(fold(s)), names).length > 0);
}

/**
 * The tone toward the brand, from the words around it.
 *
 * `listed` is true when the brand sits in the answer's list: being put forward
 * with nothing said against it is a recommendation, which is how the ranking
 * pass labelled such answers.
 */
export function lexiconTone(
  answer: string,
  names: readonly string[],
  listed: boolean,
): LexiconTone {
  const sentences = brandSentences(answer, names);
  if (sentences.length === 0) return { sentiment: "NOT_MENTIONED", positive: 0, negative: 0 };

  let positive = 0;
  let negative = 0;
  for (const sentence of sentences) {
    const tokens = fold(sentence).split(/[^\p{L}\p{N}'-]+/u).filter(Boolean);
    tokens.forEach((token, i) => {
      const negated = tokens.slice(Math.max(0, i - 3), i).some((t) => NEGATORS.has(t));
      const isPos = POSITIVE.has(token);
      const isNeg = NEGATIVE.has(token);
      if (!isPos && !isNeg) return;
      if (isPos !== negated) positive += 1;
      else negative += 1;
    });
  }

  if (positive === 0 && negative === 0) {
    return { sentiment: listed ? "POSITIVE" : "NEUTRAL", positive, negative };
  }
  if (negative === 0) return { sentiment: "POSITIVE", positive, negative };
  if (positive === 0) return { sentiment: "NEGATIVE", positive, negative };
  if (positive - negative >= 2) return { sentiment: "POSITIVE", positive, negative };
  if (negative - positive >= 2) return { sentiment: "NEGATIVE", positive, negative };
  return { sentiment: null, positive, negative };
}
