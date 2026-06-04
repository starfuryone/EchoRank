import Papa from "papaparse";
import { createHash } from "node:crypto";
import type { MonitoringPlatform } from "@/generated/prisma";
import { ReviewNormalizer, type ExternalReviewInput } from "@/monitoring/normalizer";
import type { NormalizedReview } from "@/monitoring/platforms/base";
import type { ColumnMapping } from "./source-presets";

const normalizer = new ReviewNormalizer();

// Cap on row-level errors retained on the ImportJob, to keep the JSON bounded.
export const MAX_RETAINED_ERRORS = 100;

export interface ParsePreview {
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
}

export interface RowError {
  row: number; // 1-based, excludes header
  message: string;
}

export interface BuildResult {
  reviews: ExternalReviewInput[];
  errors: RowError[];
  totalRows: number;
}

/**
 * Parse raw CSV text into headers + a small sample for the mapping wizard.
 * Uses header mode so the first row supplies column names; when the file has no
 * header row we synthesize positional names (column_1, column_2, ...).
 */
export function parsePreview(
  rawText: string,
  hasHeaderRow: boolean,
  sampleSize = 5,
): ParsePreview {
  const result = Papa.parse<string[]>(rawText, {
    header: false,
    skipEmptyLines: "greedy",
  });

  const rows = (result.data ?? []).filter((r) => Array.isArray(r) && r.length > 0);
  if (rows.length === 0) {
    return { columns: [], sampleRows: [], totalRows: 0 };
  }

  let columns: string[];
  let dataRows: string[][];

  if (hasHeaderRow) {
    columns = rows[0].map((c, i) => (c?.trim() ? c.trim() : `column_${i + 1}`));
    dataRows = rows.slice(1);
  } else {
    const width = Math.max(...rows.map((r) => r.length));
    columns = Array.from({ length: width }, (_, i) => `column_${i + 1}`);
    dataRows = rows;
  }

  const sampleRows = dataRows.slice(0, sampleSize).map((r) => {
    const obj: Record<string, string> = {};
    columns.forEach((col, i) => {
      obj[col] = r[i] ?? "";
    });
    return obj;
  });

  return { columns, sampleRows, totalRows: dataRows.length };
}

/**
 * Apply a confirmed column mapping to the full file, producing normalized
 * ExternalReview inputs ready for persistAndDispatchReviews(). Rows that fail
 * validation (e.g. completely empty, or unparseable rating where required) are
 * collected as errors rather than aborting the whole import.
 */
export function buildReviews(
  rawText: string,
  hasHeaderRow: boolean,
  mapping: ColumnMapping,
  platform: MonitoringPlatform,
  tenantId: string,
  sourceId: string,
): BuildResult {
  const parsed = Papa.parse<Record<string, string>>(rawText, {
    header: hasHeaderRow,
    skipEmptyLines: "greedy",
    transformHeader: (h, i) => (h?.trim() ? h.trim() : `column_${i + 1}`),
  });

  const errors: RowError[] = [];
  const reviews: ExternalReviewInput[] = [];

  // When headerless, papaparse returns arrays; remap to column_N objects.
  let records: Record<string, string>[];
  if (hasHeaderRow) {
    records = (parsed.data ?? []) as Record<string, string>[];
  } else {
    const arr = (Papa.parse<string[]>(rawText, { header: false, skipEmptyLines: "greedy" })
      .data ?? []) as string[][];
    records = arr.map((row) => {
      const obj: Record<string, string> = {};
      row.forEach((v, i) => {
        obj[`column_${i + 1}`] = v ?? "";
      });
      return obj;
    });
  }

  records.forEach((record, idx) => {
    const rowNum = idx + 1;
    try {
      const get = (field: keyof ColumnMapping): string | undefined => {
        const col = mapping[field];
        if (!col) return undefined;
        const v = record[col];
        return v != null && String(v).trim() !== "" ? String(v).trim() : undefined;
      };

      const content = get("content");
      const ratingRaw = get("rating");
      const author = get("author");

      // A row with neither content nor rating carries no review signal.
      if (!content && !ratingRaw) {
        if (errors.length < MAX_RETAINED_ERRORS) {
          errors.push({ row: rowNum, message: "no content or rating" });
        }
        return;
      }

      const rating = ratingRaw != null ? coerceRating(ratingRaw) : undefined;
      const publishedAt = coerceDate(get("publishedAt"));

      // Stable externalId: prefer a native id column; otherwise hash the
      // review's identifying content so re-importing the same file dedupes.
      const nativeId = get("externalId");
      const externalId =
        nativeId ??
        `csv-${stableHash([tenantId, platform, author ?? "", content ?? "", ratingRaw ?? "", get("publishedAt") ?? ""])}`;

      const raw: NormalizedReview = {
        externalId,
        authorName: author,
        authorUrl: get("authorUrl"),
        rating,
        content,
        publishedAt,
        url: get("url"),
        metadata: { importedVia: "csv", row: rowNum },
      };

      const normalized = normalizer.normalize(raw, platform, tenantId, sourceId);
      reviews.push(normalized);
    } catch (err) {
      if (errors.length < MAX_RETAINED_ERRORS) {
        errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : "row failed to parse",
        });
      }
    }
  });

  return { reviews, errors, totalRows: records.length };
}

/**
 * Coerce assorted rating encodings to a 1–5 number. Handles "4", "4.0",
 * "4/5", "4 stars", and Facebook-style "recommends"/"doesn't recommend".
 * Returns undefined when no rating can be derived (the normalizer treats
 * undefined ratings as content-only reviews).
 */
function coerceRating(raw: string): number | undefined {
  const s = raw.toLowerCase().trim();

  if (/\bdoes\s*n['’]?t\s*recommend\b|\bnot\s*recommend/.test(s)) return 1;
  if (/\brecommend/.test(s)) return 5;

  // "4/5" → 4 ; "4 stars" → 4 ; "4.0" → 4
  const fraction = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) {
    const num = parseFloat(fraction[1]);
    const den = parseFloat(fraction[2]);
    if (den > 0) return clampRating((num / den) * 5);
  }

  const num = parseFloat(s.replace(/[^\d.]/g, ""));
  if (Number.isNaN(num)) return undefined;
  return clampRating(num);
}

function clampRating(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

/**
 * Best-effort date coercion. Accepts ISO and most JS-parseable formats; returns
 * undefined for unparseable values rather than throwing.
 */
function coerceDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function stableHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}
