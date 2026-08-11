// src/lib/ai-monitor/wizard/validation.ts
//
// What the setup wizard will accept, and the normalised form it stores.
//
// PURE. No Prisma, no fetch — the wizard's API route and its tests both need
// these answers, and a validator that can only run against a database is a
// validator nobody exercises.
//
// NORMALISE ONCE, AT THE BOUNDARY. The domain a user types ("HTTPS://Www.Acme.com/
// pricing?utm=x") and the domain the citation matcher compares against
// (registrable, lowercase, no www) are not the same string, and deciding which
// one a column holds at read time is how two features end up disagreeing about
// whether a brand was cited. Everything downstream — analysis/citations.ts,
// the Source rollup — already assumes the registrable form, so this converts to
// it here and the column holds one shape.
//
// BRAND VARIATIONS ARE GENERATED, NOT DEMANDED. Asking a user to enumerate the
// spellings of their own name gets "Acme" and nothing else, and then the
// deterministic scan misses "Acme Inc." in half the answers. The obvious
// mechanical variants are derived; the user can still add their own.

import { registrableDomain } from "@/lib/registrable-domain";

/** Longer than this is a paste accident, not a brand. */
export const MAX_BRAND_CHARS = 80;
/** Enough for the longest real hostname; refuses a pasted essay. */
export const MAX_DOMAIN_CHARS = 253;
/** Generated variants beyond the name itself. */
export const MAX_GENERATED_VARIATIONS = 6;

/**
 * Legal-entity and punctuation noise that is never part of how someone refers
 * to a company in a question they type.
 */
const ENTITY_SUFFIXES = [
  "inc",
  "inc.",
  "llc",
  "ltd",
  "ltd.",
  "limited",
  "gmbh",
  "ag",
  "sa",
  "sarl",
  "bv",
  "nv",
  "plc",
  "co",
  "co.",
  "corp",
  "corp.",
  "corporation",
  "company",
];

/** Trimmed, collapsed whitespace. Never lowercased — this is a display name. */
export function normalizeBrand(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_BRAND_CHARS);
}

export function isValidBrand(raw: string): boolean {
  const brand = normalizeBrand(raw);
  // At least one letter or digit: "-" and "…" are not brands, and a name with
  // none of either cannot be matched in prose by the deterministic scan.
  return brand.length > 0 && /[\p{L}\p{N}]/u.test(brand);
}

/**
 * A typed website reduced to its registrable domain, or null.
 *
 * Accepts what people actually paste — a bare host, a full URL, a trailing
 * slash, a path, a query string, mixed case, a leading "www." — because
 * refusing those is a support ticket, not a validation.
 */
export function normalizeDomain(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.length > MAX_DOMAIN_CHARS || /\s/.test(trimmed)) return null;

  const domain = registrableDomain(trimmed);
  // registrableDomain is a PARSER, not a validator: handed "not a domain" it
  // hands it back. The shape check is what makes this a validation. Same guard
  // as analysis/citations.ts, and for the same reason.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return null;
  }
  // A single-label TLD is not a site anyone owns ("localhost", "com").
  if (domain.split(".").length < 2) return null;
  return domain;
}

export function isValidDomain(raw: string): boolean {
  return normalizeDomain(raw) !== null;
}

/**
 * Spellings that should count as this brand.
 *
 * Mechanical only — no LLM. These are the variants that follow from the name
 * itself: with and without the legal suffix, with and without the separator
 * between words. Anything requiring judgement ("Big Blue" for IBM) is the
 * user's to add, and guessing it would be the sort of false positive that
 * inflates mention rate and looks like success.
 *
 * The display name is always first, and the list is de-duplicated
 * case-insensitively so "Acme" and "acme" do not both reach the matcher.
 */
export function brandVariations(brand: string, extra: readonly string[] = []): string[] {
  const base = normalizeBrand(brand);
  if (!base) return [];

  const out: string[] = [base];
  const push = (candidate: string) => {
    const value = candidate.trim().replace(/\s+/g, " ");
    if (!value || value.length > MAX_BRAND_CHARS) return;
    if (out.some((existing) => existing.toLowerCase() === value.toLowerCase())) return;
    out.push(value);
  };

  // "Acme Analytics Inc." -> "Acme Analytics"
  const words = base.split(" ");
  if (words.length > 1 && ENTITY_SUFFIXES.includes(words[words.length - 1].toLowerCase())) {
    push(words.slice(0, -1).join(" "));
  }

  // The de-suffixed form is what the spacing variants are built from, so
  // "Acme Analytics Inc." yields "AcmeAnalytics" rather than "AcmeAnalyticsInc".
  const core = out[out.length - 1];
  if (core.includes(" ")) {
    push(core.replace(/\s+/g, ""));
    push(core.replace(/\s+/g, "-"));
  } else if (core.includes("-")) {
    push(core.replace(/-/g, " "));
    push(core.replace(/-/g, ""));
  }

  for (const value of extra) push(value);
  return out.slice(0, MAX_GENERATED_VARIATIONS + 1 + extra.length);
}

export interface WizardSubmission {
  brand: string;
  website: string;
  /** Provider ids the user ticked. */
  engines: string[];
  /** Prompt texts the user kept. */
  prompts: string[];
  aliases?: string[];
  industry?: string | null;
  country?: string | null;
  language?: string;
}

export type WizardFieldError =
  | "brand_required"
  | "domain_invalid"
  | "engines_required"
  | "prompts_required";

export interface WizardValidation {
  ok: boolean;
  errors: WizardFieldError[];
  /** Present only when ok. The exact values to persist. */
  normalized?: {
    brand: string;
    domain: string;
    aliases: string[];
    engines: string[];
    prompts: string[];
    industry: string | null;
    country: string | null;
    language: string;
  };
}

/**
 * Every rule the wizard enforces, in one place.
 *
 * RETURNS EVERY FAILURE, not the first. A wizard that reports one problem per
 * submission makes a user with three problems submit four times, and the
 * fourth is where they give up.
 *
 * The engine list is validated for NON-EMPTINESS here only. Whether a
 * particular engine may be selected at all is ./engines.ts's question, because
 * that answer depends on rates and adapters rather than on the form.
 */
export function validateSubmission(input: WizardSubmission): WizardValidation {
  const errors: WizardFieldError[] = [];

  if (!isValidBrand(input.brand)) errors.push("brand_required");

  const domain = normalizeDomain(input.website);
  if (domain === null) errors.push("domain_invalid");

  const engines = [...new Set((input.engines ?? []).map((e) => e.trim()).filter(Boolean))];
  if (engines.length === 0) errors.push("engines_required");

  const prompts: string[] = [];
  const seen = new Set<string>();
  for (const prompt of input.prompts ?? []) {
    const text = (prompt ?? "").trim().replace(/\s+/g, " ");
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    prompts.push(text);
  }
  if (prompts.length === 0) errors.push("prompts_required");

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors: [],
    normalized: {
      brand: normalizeBrand(input.brand),
      domain: domain as string,
      aliases: brandVariations(input.brand, input.aliases ?? []),
      engines,
      prompts,
      industry: input.industry?.trim() || null,
      country: input.country?.trim().toUpperCase() || null,
      language: input.language?.trim() || "en",
    },
  };
}
