import type { MonitoringPlatform, ImportSourceFormat } from "@/generated/prisma";

/**
 * Canonical review fields the importer understands. Every uploaded CSV column
 * is mapped onto one of these (or ignored). `content` is the only field whose
 * presence is strongly recommended; everything else is best-effort.
 */
export type CanonicalField =
  | "externalId" // native review id, when the export provides one (best dedup key)
  | "rating"
  | "content"
  | "author"
  | "authorUrl"
  | "publishedAt"
  | "url"
  | "language";

export const CANONICAL_FIELDS: CanonicalField[] = [
  "externalId",
  "rating",
  "content",
  "author",
  "authorUrl",
  "publishedAt",
  "url",
  "language",
];

export type ColumnMapping = Partial<Record<CanonicalField, string>>;

/**
 * Header-name aliases per canonical field. Matching is case-insensitive and
 * whitespace/underscore-insensitive (see normalizeHeader). Ordered loosely by
 * specificity; first hit wins during auto-suggestion.
 */
const FIELD_ALIASES: Record<CanonicalField, string[]> = {
  externalId: ["reviewid", "review id", "id", "externalid", "external id"],
  rating: ["rating", "star rating", "stars", "score", "starrating", "rate"],
  content: [
    "content",
    "review",
    "reviewtext",
    "review text",
    "text",
    "comment",
    "comments",
    "body",
    "message",
    "feedback",
    "reviewbody",
  ],
  author: [
    "author",
    "authorname",
    "author name",
    "reviewer",
    "reviewername",
    "reviewer name",
    "name",
    "customer",
    "customername",
    "user",
    "username",
  ],
  authorUrl: ["authorurl", "author url", "reviewerurl", "profileurl", "profile url"],
  publishedAt: [
    "publishedat",
    "published at",
    "date",
    "datetime",
    "createdat",
    "created at",
    "time",
    "timestamp",
    "reviewdate",
    "review date",
    "publishtime",
    "createtime",
  ],
  url: ["url", "link", "reviewurl", "review url", "permalink"],
  language: ["language", "lang", "locale"],
};

/**
 * Per-format header expectations for the common exports. Used both to suggest
 * the source `format` from the headers and to bias auto-mapping. These mirror
 * the column names Google Takeout / Facebook / Trustpilot CSV exports use.
 */
const FORMAT_SIGNATURES: Array<{
  format: ImportSourceFormat;
  platform: MonitoringPlatform;
  // headers (normalized) that, if all present, strongly imply this format
  requires: string[];
}> = [
  {
    format: "TRUSTPILOT_CSV",
    platform: "TRUSTPILOT",
    requires: ["stars", "reviewtitle"],
  },
  {
    format: "GOOGLE_CSV",
    platform: "GOOGLE",
    requires: ["starrating", "reviewtext"],
  },
  {
    format: "FACEBOOK_CSV",
    platform: "FACEBOOK",
    requires: ["recommendationtype"],
  },
];

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-./]+/g, "").trim();
}

/**
 * Suggest the export format + platform from the detected headers. Falls back to
 * GENERIC_CSV / CUSTOM when nothing matches.
 */
export function detectFormat(columns: string[]): {
  format: ImportSourceFormat;
  platform: MonitoringPlatform;
} {
  const normalized = new Set(columns.map(normalizeHeader));
  for (const sig of FORMAT_SIGNATURES) {
    if (sig.requires.every((r) => normalized.has(r))) {
      return { format: sig.format, platform: sig.platform };
    }
  }
  return { format: "GENERIC_CSV", platform: "CUSTOM" };
}

/**
 * Best-effort auto-mapping of detected columns onto canonical fields. Only
 * confident matches are returned; the user confirms/edits in the wizard.
 */
export function suggestMapping(columns: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();

  for (const field of CANONICAL_FIELDS) {
    const aliases = FIELD_ALIASES[field].map(normalizeHeader);
    for (const col of columns) {
      if (used.has(col)) continue;
      if (aliases.includes(normalizeHeader(col))) {
        mapping[field] = col;
        used.add(col);
        break;
      }
    }
  }

  return mapping;
}
