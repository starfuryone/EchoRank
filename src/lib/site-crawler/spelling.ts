// src/lib/site-crawler/spelling.ts
//
// Spell check of a page's visible text (Phase 3c): nspell with the hunspell
// dictionaries for English, French and German. The five marketing locales fold
// onto those three; Swiss German is checked against the German dictionary
// with "ss" accepted where the dictionary spells "ß". Spelling only: grammar
// (LanguageTool needs Java and ~2 GB of RAM) is deliberately out of scope on
// this box.
//
// MEMORY. Dictionaries load lazily, the first time a page in that language is
// checked: English ~70 ms / 30 MB, German ~0.5 s / 80 MB, French ~2 s /
// 600 MB (its affix rules expand to a very large word set). A crawl of an
// English site never pays for French. They live in the workers process, next
// to the crawl itself, so:
//   - a crawl holds them through acquireSpelling(), and they are dropped when
//     the last crawl running in this process releases (two run at once, see
//     CRAWL_JOB_CONCURRENCY, and share one copy);
//   - a dictionary is not loaded while free memory (os.freemem(), which is
//     MemAvailable on Linux) is under SPELL_MIN_FREE_BYTES. Pages in that
//     language get no spelling verdict, and the skip is logged once per
//     language until the dictionaries are next dropped.
// The dictionary packages' own aff/dic bytes (~1.5 MB for French) stay in
// the module cache; the expanded word set is what is freed.
//
// What is not looked up: words with digits, all-caps acronyms and inner
// capitals (product names), URLs and e-mail addresses, one-letter tokens, and
// the tenant's accepted words. A capitalised word passes if either its own or
// its lower-case form is in the dictionary, so sentence-initial words do not
// fail. Proper names that are in no dictionary still show up: that is what the
// accepted-words list is for.
//
// Imported by the crawl runner only (the workers process). The dictionary
// packages read their files with top-level await at import, so they stay
// dynamic imports and out of every Next bundle.

import "server-only";
import { freemem } from "node:os";
import nspell from "nspell";
import { SPELLING_SAMPLE_MAX, type SpellingFacts } from "@/lib/crawl-rules";
import { logger } from "@/infrastructure/observability/logger";

export const SPELL_LANGS = ["en", "fr", "de"] as const;
export type SpellLang = (typeof SPELL_LANGS)[number];

/** Words looked up per page at most. Enough to judge a page; bounded CPU on a 20,000-word one. */
export const MAX_WORDS_PER_PAGE = 3_000;

/** No dictionary is loaded with less free memory than this. */
export const SPELL_MIN_FREE_BYTES = 1024 ** 3;

type Checker = ReturnType<typeof nspell>;

const LOADERS: Record<SpellLang, () => Promise<{ default: { aff: Uint8Array; dic: Uint8Array } }>> = {
  en: () => import("dictionary-en"),
  fr: () => import("dictionary-fr"),
  de: () => import("dictionary-de"),
};

const checkers = new Map<SpellLang, Promise<Checker>>();
const skipLogged = new Set<SpellLang>();
let holders = 0;

/**
 * Hold the dictionaries for one crawl. Call the returned function when the
 * crawl ends (it is idempotent); the last release in the process drops them.
 */
export function acquireSpelling(): () => void {
  holders++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--holders > 0) return;
    holders = 0;
    if (checkers.size) logger.info({ langs: [...checkers.keys()] }, "site-crawl spelling: dictionaries released");
    checkers.clear();
    skipLogged.clear();
  };
}

/** Languages whose dictionary is loaded or loading. */
export function loadedSpellLangs(): SpellLang[] {
  return [...checkers.keys()];
}

/** Null when the dictionary is not loaded and free memory is too low to load it. */
function checker(lang: SpellLang, freeBytes: () => number): Promise<Checker> | null {
  let c = checkers.get(lang);
  if (!c) {
    const free = freeBytes();
    if (free < SPELL_MIN_FREE_BYTES) {
      if (!skipLogged.has(lang)) {
        skipLogged.add(lang);
        logger.warn(
          { lang, freeMb: Math.round(free / 1024 ** 2), minFreeMb: SPELL_MIN_FREE_BYTES / 1024 ** 2 },
          "site-crawl spelling: low free memory, dictionary not loaded, pages in this language are not spell-checked",
        );
      }
      return null;
    }
    c = LOADERS[lang]().then((m) => nspell(Buffer.from(m.default.aff), Buffer.from(m.default.dic)));
    // A failed load is retried on the next page rather than cached forever.
    const loading = c;
    c.catch(() => {
      if (checkers.get(lang) === loading) checkers.delete(lang);
    });
    checkers.set(lang, c);
  }
  return c;
}

/** "fr-CA" → "fr"; null when absent. */
export function primaryLang(lang: string | null | undefined): string | null {
  const p = (lang ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return p && /^[a-z]{2,3}$/.test(p) ? p : null;
}

const WORD = /[\p{L}][\p{L}\p{M}'’-]*[\p{L}\p{M}]|[\p{L}]/gu;
const URLISH = /\b(?:https?:\/\/|www\.)\S+|\S+@\S+\.\S+/gi;

/** The words worth looking up, in document order. */
export function spellTokens(text: string, lang: SpellLang, accepted: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const m of text.replace(URLISH, " ").matchAll(WORD)) {
    if (out.length >= MAX_WORDS_PER_PAGE) break;
    let w = m[0].replace(/’/g, "'");
    // French elision: l'exploration, d'un, qu'il — check the word after the apostrophe.
    if (lang === "fr") w = w.replace(/^(?:[ldjmnstc]|qu|jusqu|lorsqu|puisqu)'/i, "");
    for (const part of w.split("-")) {
      if (part.length < 2) continue;
      if (/\d/.test(part)) continue;
      if (/\p{Lu}/u.test(part.slice(1))) continue; // ACRONYM, iPhone, McDonald
      if (accepted.has(part.toLowerCase())) continue;
      out.push(part);
    }
  }
  return out;
}

function correct(c: Checker, word: string, lang: SpellLang): boolean {
  if (c.correct(word) || c.correct(word.toLowerCase())) return true;
  if (word.endsWith("'s") && c.correct(word.slice(0, -2))) return true;
  // Swiss German writes ss for ß; the dictionary is German German.
  return lang === "de" && word.includes("ss") && c.correct(word.replace(/ss/g, "ß"));
}

/**
 * Check one page. `lang` is the page's <html lang>, falling back to the crawl
 * root's. Null when there is no language to go on (guessing English for an
 * unlabelled French page would report every word), or when the dictionary
 * could not be loaded for lack of memory.
 */
export async function checkSpelling(
  text: string,
  lang: string | null,
  accepted: ReadonlySet<string>,
  freeBytes: () => number = freemem,
): Promise<SpellingFacts | null> {
  const primary = primaryLang(lang);
  if (!primary) return null;
  if (!(SPELL_LANGS as readonly string[]).includes(primary)) {
    return { lang: primary, supported: false, checked: 0, misspelled: 0, sample: [] };
  }
  const l = primary as SpellLang;
  const loading = checker(l, freeBytes);
  if (!loading) return null;
  const c = await loading;
  const words = spellTokens(text, l, accepted);
  const wrong = new Set<string>();
  const sample: string[] = [];
  for (const w of words) {
    const key = w.toLowerCase();
    if (wrong.has(key) || correct(c, w, l)) continue;
    wrong.add(key);
    if (sample.length < SPELLING_SAMPLE_MAX) sample.push(w);
  }
  return { lang: l, supported: true, checked: words.length, misspelled: wrong.size, sample };
}

/**
 * The accepted words for a crawl: the workspace's list, plus the workspace
 * name and the crawled host's labels (a site's own name is never a typo).
 */
export function acceptedWords(saved: readonly string[], tenantName: string, rootUrl: string): Set<string> {
  const out = new Set<string>();
  const add = (w: string) => {
    for (const part of w.toLowerCase().split(/[\s.,;:/()-]+/)) if (part.length >= 2) out.add(part);
  };
  for (const w of saved) add(w);
  add(tenantName);
  try {
    add(new URL(rootUrl).hostname.replace(/^www\./, ""));
  } catch {
    // an unparsable root adds nothing
  }
  return out;
}
