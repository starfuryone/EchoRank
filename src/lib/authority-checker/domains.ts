// src/lib/authority-checker/domains.ts
//
// What the visitor typed, turned into the registrable domains we look up.
// Dependency-free: the client form validates with it before sending, and the
// route re-validates with it before spending.
//
// registrableDomain() (src/lib/registrable-domain.ts) is the existing eTLD+1
// helper: "https://www.blog.example.co.uk/x" -> "example.co.uk". It does not
// judge validity, so the shape check below does.

import { registrableDomain } from "@/lib/registrable-domain";
import { MAX_COMPETITORS } from "./config";

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** The registrable domain, or null when the input is not a public hostname. */
export function parseDomainInput(raw: string | null | undefined): string | null {
  const input = (raw ?? "").trim();
  if (!input || input.length > 300 || /\s/.test(input)) return null;
  const domain = registrableDomain(input.replace(/^www\./i, ""));
  if (!domain || domain.length > 253) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return null;
  // A TLD is letters (or an IDNA xn-- label); an IP address is not a domain.
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,63}$/.test(tld) && !/^xn--[a-z0-9-]{2,59}$/.test(tld)) return null;
  return domain;
}

export type CheckInputError = "invalid_domain" | "invalid_competitor" | "too_many_competitors";

/**
 * The check's domains: the visitor's, then up to three distinct competitors
 * that are not the visitor's own domain. Blank competitor fields are skipped;
 * a filled one that is not a domain is an error rather than silently dropped.
 */
export function normalizeCheck(input: { domain: string; competitors?: string[] }):
  | { ok: true; domain: string; competitors: string[] }
  | { ok: false; error: CheckInputError } {
  const domain = parseDomainInput(input.domain);
  if (!domain) return { ok: false, error: "invalid_domain" };
  const filled = (input.competitors ?? []).map((c) => c.trim()).filter(Boolean);
  if (filled.length > MAX_COMPETITORS) return { ok: false, error: "too_many_competitors" };
  const competitors: string[] = [];
  for (const raw of filled) {
    const c = parseDomainInput(raw);
    if (!c) return { ok: false, error: "invalid_competitor" };
    if (c !== domain && !competitors.includes(c)) competitors.push(c);
  }
  return { ok: true, domain, competitors };
}
