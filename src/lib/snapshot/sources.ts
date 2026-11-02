// src/lib/snapshot/sources.ts
//
// Snapshot v2: which sources decided the answers, and what to do about them.
//
//   sourceMap()   — every cited domain: how many answers cited it, which
//                   competitors those answers named, and whether the user's
//                   own domain was cited alongside it in any of them.
//   actionRows()  — the cited domains the user is absent from (never cited in
//                   the same answer), most-cited first, typed by ONE model
//                   call, top 5 with a one-line action. Competitor-owned
//                   sources are listed and carry no action; so does anything
//                   the classifier could not type ("unknown"), including every
//                   row when the call fails.
//
// Pure apart from the injected classifier, so tests pin the map and the
// fallback on fixtures (tests/snapshot-sources.test.ts).

import { fold, sameSite } from "./match";
import type { StoredAnswer } from "./report";
import type { ActionRow, CompetitorCount, SourceAction, SourceRow, SourceType } from "./types";

export const TOP_ACTIONS = 5;

export function sourceMap(answers: StoredAnswer[], userDomain: string): SourceRow[] {
  const rows = new Map<string, { timesCited: number; comps: Map<string, CompetitorCount>; userCited: boolean }>();
  for (const a of answers) {
    if (a.error) continue;
    const domains = [...new Set(a.citedDomains)];
    const userHere = domains.some((d) => sameSite(d, userDomain));
    for (const d of domains) {
      const row = rows.get(d) ?? { timesCited: 0, comps: new Map(), userCited: false };
      row.timesCited += 1;
      row.userCited ||= userHere;
      for (const name of a.competitors) {
        const key = fold(name).replace(/ /g, "");
        const c = row.comps.get(key) ?? { name, count: 0, byEngine: {} };
        c.count += 1;
        c.byEngine[a.engine] = (c.byEngine[a.engine] ?? 0) + 1;
        row.comps.set(key, c);
      }
      rows.set(d, row);
    }
  }
  return [...rows.entries()]
    .map(([domain, r]) => ({
      domain,
      timesCited: r.timesCited,
      competitors: [...r.comps.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      userCited: r.userCited,
    }))
    .sort((a, b) => b.timesCited - a.timesCited || a.domain.localeCompare(b.domain));
}

/** Cited domains the user's domain never appeared beside, most-cited first. The user's own site is not a gap. */
export function absentSources(map: SourceRow[], userDomain: string): SourceRow[] {
  return map.filter((s) => !s.userCited && !sameSite(s.domain, userDomain));
}

/**
 * A source whose domain is a competitor's name is competitor-owned, whatever
 * the classifier says: "pipeworks.co.uk" for "Pipeworks Ltd". Compared on the
 * folded, space-less name with legal suffixes dropped.
 */
export function ownedByCompetitor(domain: string, competitors: string[]): boolean {
  const label = fold(domain.split(".")[0]).replace(/ /g, "");
  if (label.length < 4) return false;
  return competitors.some((name) => {
    const n = fold(name)
      .replace(/\b(ltd|limited|inc|llc|co|corp|gmbh|sa|sarl|plc)\b/g, "")
      .replace(/ /g, "");
    return n.length >= 4 && (label === n || label.startsWith(n) || n.startsWith(label));
  });
}

/** What the classifier may answer, per domain. */
export type ClassifiedKind = "directory" | "review_site" | "publisher" | "competitor" | "forum";

export const CLASSIFY_INSTRUCTIONS =
  "Classify each website domain by what it is to a business that wants to be recommended by AI assistants. " +
  "directory = a listing or marketplace of businesses; review_site = a site where customers rate businesses and " +
  "a business can claim its profile; publisher = editorial content (news, blog, magazine, comparison articles); " +
  "competitor = the site of a company named in COMPETITORS, or of another business selling the same thing; " +
  "forum = user discussions (Reddit, Q&A, community boards). Use only these labels.";

export const CLASSIFY_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["domains"],
  properties: {
    domains: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["domain", "type"],
        properties: {
          domain: { type: "string" },
          type: { type: "string", enum: ["directory", "review_site", "publisher", "competitor", "forum"] },
        },
      },
    },
  },
};

const KIND_TO_ROW: Record<ClassifiedKind, { type: SourceType; action: SourceAction | null }> = {
  directory: { type: "directory", action: "get_listed" },
  review_site: { type: "directory", action: "claim_profile" },
  publisher: { type: "publisher", action: "pitch_comparison" },
  forum: { type: "forum", action: "join_discussion" },
  competitor: { type: "competitor", action: null },
};

export function parseClassification(value: unknown): Map<string, ClassifiedKind> {
  const out = new Map<string, ClassifiedKind>();
  const list = (value as { domains?: unknown })?.domains;
  if (!Array.isArray(list)) return out;
  for (const item of list) {
    const d = String((item as { domain?: unknown })?.domain ?? "").toLowerCase().trim();
    const t = (item as { type?: unknown })?.type;
    if (d && typeof t === "string" && t in KIND_TO_ROW) out.set(d, t as ClassifiedKind);
  }
  return out;
}

/**
 * The "What to do" rows. `classified` is null when the call failed or was not
 * made: every row is then "unknown" with no action, except the ones the
 * competitor-name match already settles.
 */
export function actionRows(
  absent: SourceRow[],
  competitors: string[],
  classified: Map<string, ClassifiedKind> | null,
): ActionRow[] {
  return absent.slice(0, TOP_ACTIONS).map((s) => {
    if (ownedByCompetitor(s.domain, competitors)) return { domain: s.domain, timesCited: s.timesCited, type: "competitor", action: null };
    const kind = classified?.get(s.domain);
    const r = kind ? KIND_TO_ROW[kind] : { type: "unknown" as const, action: null };
    return { domain: s.domain, timesCited: s.timesCited, type: r.type, action: r.action };
  });
}

/** The classifier's input: the absent domains, and the competitors to recognise. */
export function classifyInput(absent: SourceRow[], competitors: string[]): string {
  return (
    `COMPETITORS: ${competitors.join(", ") || "(none)"}\n\nDOMAINS:\n` +
    absent
      .slice(0, TOP_ACTIONS)
      .map((s) => s.domain)
      .join("\n")
  );
}
