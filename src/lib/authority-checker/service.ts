// src/lib/authority-checker/service.ts — what a check and an unlock buy, in
// order, with the cache read before any money moves.
//
//   CHECK  (anonymous): Echorank Authority for every domain (one bulk_ranks
//          for the uncached ones) + the visitor's own summary.
//   UNLOCK (email): the top 10 referring domains + each competitor's summary,
//          stored on the check so the page and the PDF read the same numbers.
//
// The route decides whether a purchase is allowed (Turnstile, IP limit,
// budget); these functions only read and buy.

import "server-only";

import { DataforseoError } from "@/lib/dataforseo/client";
import {
  alertIfNearBudget,
  budgetState,
  buyLinks,
  buyRanks,
  buyRefDomains,
  cachedLinks,
  cachedRanks,
  cachedRefDomains,
} from "./data";
import type { DomainRow, LinkMetrics, StoredCheck } from "./types";

export interface Preview {
  authority: Record<string, number | null>;
  missingRanks: string[];
  links: LinkMetrics | null;
}

/** Everything a check needs that is already cached. Free. */
export async function cachedPreview(domain: string, competitors: string[], now = new Date()): Promise<Preview> {
  const { known, missing } = await cachedRanks([domain, ...competitors], now);
  return { authority: known, missingRanks: missing, links: await cachedLinks(domain, now) };
}

export function previewComplete(p: Preview): boolean {
  return p.missingRanks.length === 0 && p.links !== null;
}

/** Buy what the cache did not have: one bulk_ranks for the missing domains, the summary if missing. */
export async function completePreview(p: Preview, domain: string, now = new Date()) {
  const bought = await buyRanks(p.missingRanks, now);
  const links = p.links ?? (await buyLinks(domain, now));
  await alertIfNearBudget(now);
  return { authority: { ...p.authority, ...bought }, links };
}

/** The metering's own cap (monthly, per sentinel) reads as the same "back tomorrow". */
export function isBudgetError(err: unknown): boolean {
  return err instanceof DataforseoError && err.code === "RATE_LIMITED";
}

export type FullOutcome = { state: "ok"; check: StoredCheck } | { state: "budget" };

/**
 * Fill the unlocked section: cached parts first, then the purchases, refused
 * as a whole when today's budget is spent. Throws on an upstream failure.
 */
export async function ensureFull(check: StoredCheck, now = new Date()): Promise<FullOutcome> {
  if (check.full) return { state: "ok", check };

  let refDomains = await cachedRefDomains(check.domain, now);
  const links = new Map<string, LinkMetrics>([[check.domain, check.links]]);
  const missing: string[] = [];
  for (const c of check.competitors) {
    const hit = await cachedLinks(c, now);
    if (hit) links.set(c, hit);
    else missing.push(c);
  }

  if (refDomains === null || missing.length > 0) {
    if ((await budgetState(now)).exhausted) return { state: "budget" };
    try {
      if (refDomains === null) refDomains = await buyRefDomains(check.domain, now);
      for (const c of missing) links.set(c, await buyLinks(c, now));
    } catch (err) {
      if (isBudgetError(err)) return { state: "budget" };
      throw err;
    }
    await alertIfNearBudget(now);
  }

  const comparison: DomainRow[] = [check.domain, ...check.competitors].map((d) => ({
    domain: d,
    authority: check.authority[d] ?? null,
    ...(links.get(d) as LinkMetrics),
  }));
  return { state: "ok", check: { ...check, full: { referringDomains: refDomains ?? [], comparison, at: now.toISOString() } } };
}
