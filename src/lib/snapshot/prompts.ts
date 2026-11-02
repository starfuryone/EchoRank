// src/lib/snapshot/prompts.ts
//
// The 10 questions a check asks, built from category + location by template.
// No model call: the set must be the same fixed mix every time, it must never
// leak the brand into the eight category questions, and a generator that can
// be talked out of either by a creative category string is not one we can test.
//
// The fixed mix is 4 best/top, 2 vs alternatives, 2 problem/how-to and
// 2 direct. Only the two direct prompts name the brand. The set is stored on
// the run (VisibilitySnapshot.prompts), so a paid plan can adopt it as tracked
// prompts unchanged.

import type { PromptKind, SnapshotPrompt } from "./types";

export const PROMPT_MIX: Readonly<Record<PromptKind, number>> = { best: 4, alternatives: 2, howto: 2, direct: 2 };
export const PROMPT_COUNT = 10;

export type PromptLang = "en" | "fr";
export const promptLangOf = (locale: string): PromptLang => (locale.startsWith("fr") ? "fr" : "en");

interface Vars {
  category: string;
  /** " in Leeds" / " à Lyon", or "" when there is no location. */
  loc: string;
  brand: string;
  domain: string;
}

const TEMPLATES: Record<PromptLang, Record<PromptKind, ((v: Vars) => string)[]>> = {
  en: {
    best: [
      (v) => `What is the best ${v.category}${v.loc}?`,
      (v) => `Can you recommend a good ${v.category}${v.loc}?`,
      (v) => `Which ${v.category}${v.loc} has the best reviews?`,
      (v) => `Top-rated ${v.category}${v.loc}: who would you shortlist?`,
    ],
    alternatives: [
      (v) => `How do the main ${v.category} options${v.loc} compare?`,
      (v) => `What are the alternatives to the best-known ${v.category}${v.loc}?`,
    ],
    howto: [
      (v) => `How do I choose a ${v.category}${v.loc}?`,
      (v) => `What should I check before hiring a ${v.category}${v.loc}?`,
    ],
    direct: [
      (v) => `Is ${v.brand} a good ${v.category}${v.loc}?`,
      (v) => `What do customers say about ${v.brand} (${v.domain})?`,
    ],
  },
  // Every French template avoids agreeing with the category: "le meilleur
  // agence" is what a category-blind "le meilleur ${cat}" produces.
  fr: {
    best: [
      (v) => `Qui recommandez-vous comme ${v.category}${v.loc} ?`,
      (v) => `Qui sont les meilleurs dans la catégorie « ${v.category} »${v.loc} ?`,
      (v) => `Dans la catégorie « ${v.category} »${v.loc}, qui a les meilleurs avis ?`,
      (v) => `Quels noms mettriez-vous sur une liste restreinte pour « ${v.category} »${v.loc} ?`,
    ],
    alternatives: [
      (v) => `Comment se comparent les principales options de la catégorie « ${v.category} »${v.loc} ?`,
      (v) => `Quelles alternatives existe-t-il aux acteurs les plus connus de la catégorie « ${v.category} »${v.loc} ?`,
    ],
    howto: [
      (v) => `Comment bien choisir dans la catégorie « ${v.category} »${v.loc} ?`,
      (v) => `Que faut-il vérifier avant de choisir un prestataire de la catégorie « ${v.category} »${v.loc} ?`,
    ],
    direct: [
      (v) => `${v.brand} est-il un bon choix dans la catégorie « ${v.category} »${v.loc} ?`,
      (v) => `Que disent les clients de ${v.brand} (${v.domain}) ?`,
    ],
  },
};

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * The category with the brand cut out of it. "Acme plumbing" for brand "Acme"
 * would otherwise put the brand into all eight category prompts.
 */
export function scrubBrand(text: string, brand: string): string {
  const b = fold(brand).trim();
  if (!b) return text.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const bWords = b.split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < words.length; ) {
    const window = words.slice(i, i + bWords.length).map((w) => fold(w).replace(/[^\p{L}\p{N}]/gu, ""));
    if (window.join(" ") === bWords.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).join(" ")) {
      i += bWords.length;
    } else {
      out.push(words[i]);
      i += 1;
    }
  }
  return out.join(" ").replace(/^[\s,:;–—-]+|[\s,:;–—-]+$/g, "").trim();
}

export interface PromptInput {
  brand: string;
  domain: string;
  category: string;
  location?: string | null;
  locale?: string;
}

export function buildPrompts(input: PromptInput): SnapshotPrompt[] {
  const lang = promptLangOf(input.locale ?? "en");
  const category = scrubBrand(input.category, input.brand) || (lang === "fr" ? "prestataire" : "provider");
  const location = input.location ? scrubBrand(input.location, input.brand) : "";
  const loc = location ? (lang === "fr" ? ` à ${location}` : ` in ${location}`) : "";
  const v: Vars = { category, loc, brand: input.brand.trim(), domain: input.domain };
  const out: SnapshotPrompt[] = [];
  for (const kind of ["best", "alternatives", "howto", "direct"] as const) {
    for (const t of TEMPLATES[lang][kind].slice(0, PROMPT_MIX[kind])) out.push({ kind, text: t(v) });
  }
  return out;
}
