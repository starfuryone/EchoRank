// src/lib/opportunity-scanner/grade.ts
//
// Score -> letter, and audit -> the three gaps worth putting in an email.
//
// PURE, AND NO PRISMA. The worker calls it, the tests call it directly.
//
// ── The bands are the sidecar's bands, not new ones ─────────────────────────
// ai_visibility_audit.py's grade() is the source:
//
//     A >= 85, B >= 70, C >= 55, D >= 40, F below
//
// Copied here rather than fetched because the sidecar's /audit response does
// not carry a grade — only /grade does, and that endpoint is the anonymous free
// tool with its own crawl policy. Copying a five-line band table is the smaller
// evil against calling a second endpoint per prospect, but it IS a copy, so
// BANDS below is asserted against those exact numbers in the tests and this
// comment is the pointer for whoever changes one of them.
//
// The consequence of drift is worth naming: the free AI Search Grader and this
// scanner would give the same site two different letters, and an agency would
// eventually put both in front of the same prospect.

/** [minimum score, letter], highest first. */
export const BANDS: ReadonlyArray<readonly [number, string]> = [
  [85, "A"],
  [70, "B"],
  [55, "C"],
  [40, "D"],
  [0, "F"],
] as const;

/**
 * A NON-FINITE SCORE GRADES F, not A. NaN and Infinity both mean "the sidecar
 * sent us something that is not a score", and the safe reading of an unusable
 * number is the pessimistic one: an F is visibly wrong to whoever looks at the
 * table, where an A silently tells an agency a broken site is fine and gets put
 * in front of a prospect.
 */
export function gradeFor(score: number): string {
  const n = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  for (const [floor, letter] of BANDS) {
    if (n >= floor) return letter;
  }
  return "F";
}

/**
 * Sort key for the batch table: worst first.
 *
 * A BEFORE F WOULD BE THE WRONG TABLE. This is a prospecting list — the
 * interesting rows are the sites that are broken, because those are the ones
 * with something to sell. "Sorted grade asc" in the spec means F at the top:
 * ascending by quality, not alphabetically by letter, which would put A first
 * and bury every prospect worth calling.
 *
 * Failed rows (no grade) sort last. They are not good news or bad news, they
 * are an absence of news, and an agency scanning them to the top of a thousand
 * rows would see nothing useful.
 */
export function gradeRank(grade: string | null | undefined): number {
  switch (grade) {
    case "F": return 0;
    case "D": return 1;
    case "C": return 2;
    case "B": return 3;
    case "A": return 4;
    default: return 5;
  }
}

/** One scored check as the sidecar returns it: [category, points, max, status, recommendation]. */
type RawCheck = [string, number, number, string, string];

export interface TopGap {
  category: string;
  status: string;
  recommendation: string;
  /** Points this check gave up. The reason it made the list. */
  lost: number;
}

/**
 * THREE ELEMENTS IS ENOUGH: category, points, max. The sidecar returns
 * five-element checks today and the status and recommendation strings are what
 * the outreach PDF prints, but a check that arrives without them is still a
 * real point loss and still belongs in the top three. Requiring all five would
 * make a thinner upstream response produce an empty gaps section, which reads
 * as "no problems found" on a site that has them — the single most damaging
 * thing this feature could get wrong.
 */
function isRawCheck(value: unknown): value is RawCheck {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    typeof value[0] === "string" &&
    typeof value[1] === "number" &&
    typeof value[2] === "number"
  );
}

/**
 * The three checks that lost the most points.
 *
 * WORST BY POINTS LOST, not by score ratio. A check worth 20 that scored 10 is
 * a bigger opportunity than one worth 4 that scored 0, even though the second
 * looks worse as a percentage — and the number the outreach PDF prints is
 * "recover up to +N points", which only means anything if N is what ranked it.
 *
 * A check at full marks is never a gap, including a zero-max check: `lost > 0`
 * is the filter, so a check the sidecar scores out of 0 cannot produce a card
 * that says "recover up to +0 points".
 *
 * Ties break on category name so a re-run of the same site produces the same
 * three in the same order. Two identical scans that disagree about their top
 * three would be the kind of bug nobody reports and everybody notices.
 */
export function topGaps(checks: unknown, limit = 3): TopGap[] {
  if (!Array.isArray(checks)) return [];

  const gaps: TopGap[] = [];
  for (const raw of checks) {
    if (!isRawCheck(raw)) continue;
    const [category, points, max, status, recommendation] = raw;
    const lost = Math.round(max - points);
    if (!(lost > 0)) continue;
    gaps.push({
      category,
      status: typeof status === "string" ? status : "",
      recommendation: typeof recommendation === "string" ? recommendation : "",
      lost,
    });
  }

  gaps.sort((a, b) => b.lost - a.lost || a.category.localeCompare(b.category));
  return gaps.slice(0, limit);
}
