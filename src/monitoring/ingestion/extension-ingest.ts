import { createHash } from "crypto";
import type { Prisma, MonitoringPlatform } from "@/generated/prisma";
import type { ExternalReviewInput } from "@/monitoring/normalizer";
import type { ScrapedReviewInput } from "@/monitoring/import/extension-schema";

/**
 * Turn an untrusted batch of scraped reviews into the canonical
 * ExternalReviewInput[] that persistAndDispatchReviews() consumes. This is the
 * server-side trust boundary: the extension proposes data, this module decides
 * what actually gets stored (stable external ids, dedup keys, clamped ratings,
 * parsed dates). Nothing here trusts a client-supplied id blindly.
 */

function clampRating(n: number | null | undefined): number | undefined {
  if (n == null || Number.isNaN(n)) return undefined;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Strip control chars / null bytes from untrusted text; keep tab/newline. */
function sanitizeText(v: string | null | undefined, max: number): string | undefined {
  if (!v) return undefined;
  // eslint-disable-next-line no-control-regex
  const cleaned = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

/** Only accept a client externalId from a safe charset; else fall back to fingerprint. */
const SAFE_EXTERNAL_ID = /^[A-Za-z0-9_:.\-]{1,256}$/;

/** Keep a scraped url only if it is a well-formed https URL. */
function safeHttpsUrl(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" ? u.toString().slice(0, 2000) : undefined;
  } catch {
    return undefined;
  }
}

/** Facebook has no stars; map its recommend/not-recommend to 5/1. */
function facebookRating(status: string | null | undefined): number | undefined {
  if (status === "recommended") return 5;
  if (status === "not_recommended") return 1;
  return undefined;
}

const RELATIVE = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i;
const UNIT_MS: Record<string, number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000, // ~30d, good enough for ordering/recency
  year: 31_536_000_000,
};

/**
 * Best-effort parse of a scraped date string. Handles ISO, common absolute
 * formats, and relative phrasings ("3 weeks ago"). Returns undefined if it
 * cannot be parsed — downstream treats publishedAt as optional.
 */
export function parseScrapedDate(raw: string | null | undefined, now = Date.now()): Date | undefined {
  if (!raw) return undefined;
  const text = raw.trim();
  if (!text) return undefined;

  const rel = RELATIVE.exec(text);
  if (rel) {
    const qty = parseInt(rel[1], 10);
    const unit = rel[2].toLowerCase();
    const ms = UNIT_MS[unit];
    if (ms && Number.isFinite(qty)) return new Date(now - qty * ms);
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return new Date(parsed);

  return undefined;
}

/**
 * Derive a stable native id. Prefer a real id from the page; otherwise hash the
 * content fingerprint so the SAME review scraped twice dedups, while DIFFERENT
 * reviews don't collide. Excludes relative dates from the fingerprint (they
 * drift between scrapes).
 */
function deriveExternalId(r: ScrapedReviewInput): string {
  const claimed = r.externalId?.trim();
  if (claimed && SAFE_EXTERNAL_ID.test(claimed)) return claimed;
  const fingerprint = [
    r.platform,
    (r.reviewerName ?? "").toLowerCase().trim(),
    (r.reviewText ?? "").replace(/\s+/g, " ").trim().slice(0, 500),
    r.rating ?? r.recommendationStatus ?? "",
    r.sourceUrl ?? "",
  ].join("|");
  return "ext-" + createHash("sha256").update(fingerprint).digest("hex").slice(0, 32);
}

export interface IngestBuildResult {
  reviews: ExternalReviewInput[];
  /** Count dropped for having no usable content AND no rating. */
  skipped: number;
}

/**
 * Build ExternalReviewInput rows for a validated batch.
 * @param sourceId  the (already upserted) MonitoringSource these attach to.
 */
export function buildExtensionReviews(
  tenantId: string,
  sourceId: string,
  platform: MonitoringPlatform,
  batch: ScrapedReviewInput[],
): IngestBuildResult {
  const reviews: ExternalReviewInput[] = [];
  let skipped = 0;

  for (const r of batch) {
    const content = sanitizeText(r.reviewText, 8_000);
    const rating =
      r.platform === "FACEBOOK"
        ? clampRating(r.rating ?? null) ?? facebookRating(r.recommendationStatus)
        : clampRating(r.rating ?? null);

    // A row with neither text nor a rating carries no signal — drop it.
    if (!content && rating == null) {
      skipped++;
      continue;
    }

    const externalId = deriveExternalId(r);
    const metadata: Prisma.InputJsonValue = {
      origin: "extension",
      scrapedAt: new Date().toISOString(),
      ...(r.recommendationStatus ? { recommendationStatus: r.recommendationStatus } : {}),
      ...(sanitizeText(r.ownerResponse, 8_000)
        ? { ownerResponse: sanitizeText(r.ownerResponse, 8_000) }
        : {}),
      ...(r.reviewDate ? { rawDate: r.reviewDate } : {}),
    };

    reviews.push({
      tenantId,
      sourceId,
      platform,
      externalId,
      authorName: sanitizeText(r.reviewerName, 300),
      authorUrl: undefined,
      rating,
      content,
      language: undefined, // normalizer-style detection can be applied later
      publishedAt: parseScrapedDate(r.reviewDate),
      url: safeHttpsUrl(r.sourceUrl),
      // Mirror ReviewNormalizer.generateDeduplicationKey: `${platform}:${externalId}`
      deduplicationKey: `${platform}:${externalId}`,
      metadata,
    });
  }

  return { reviews, skipped };
}
