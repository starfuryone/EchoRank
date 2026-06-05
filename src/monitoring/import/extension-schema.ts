import { z } from "zod";

/**
 * Validation for the payload the browser extension POSTs to
 * /api/extension/import. The extension is UNTRUSTED input — everything here is
 * size-capped and coerced server-side. The scraper's ScrapedReview interface
 * (extension/shared/types.ts) is the mirror of `scrapedReviewSchema`.
 */

// Platforms the extension is allowed to import for (Phase 1).
export const EXTENSION_PLATFORMS = ["GOOGLE", "FACEBOOK", "TRUSTPILOT"] as const;
export type ExtensionPlatform = (typeof EXTENSION_PLATFORMS)[number];

const MAX_TEXT = 8_000;
const MAX_NAME = 300;
const MAX_URL = 2_000;
export const MAX_REVIEWS_PER_BATCH = 200;

const trimmed = (max: number) => z.string().trim().max(max);

export const scrapedReviewSchema = z
  .object({
    platform: z.enum(EXTENSION_PLATFORMS),
    reviewerName: trimmed(MAX_NAME).optional().nullable(),
    // Google/Trustpilot: 1–5. Facebook has no numeric rating — see recommendationStatus.
    rating: z.coerce.number().min(0).max(5).optional().nullable(),
    // Facebook recommendation maps to a synthetic rating downstream.
    recommendationStatus: z.enum(["recommended", "not_recommended"]).optional().nullable(),
    reviewText: trimmed(MAX_TEXT).optional().nullable(),
    // Raw, as scraped from the page ("3 weeks ago", "May 2026", ISO, etc.).
    reviewDate: trimmed(120).optional().nullable(),
    ownerResponse: trimmed(MAX_TEXT).optional().nullable(),
    sourceUrl: trimmed(MAX_URL).optional().nullable(),
    // Native review id if the page exposes one; improves dedup stability.
    externalId: trimmed(256).optional().nullable(),
  })
  .strict();

export type ScrapedReviewInput = z.infer<typeof scrapedReviewSchema>;

export const extensionImportSchema = z
  .object({
    platform: z.enum(EXTENSION_PLATFORMS),
    // The page the batch was scraped from — used to key the MonitoringSource.
    // Enforced https so a stored source.url can never be javascript:/data: etc.
    pageUrl: trimmed(MAX_URL)
      .url()
      .refine((u) => u.startsWith("https://"), "pageUrl must be https"),
    // Business name as shown on the page, for the source label (best-effort).
    businessName: trimmed(MAX_NAME).optional().nullable(),
    reviews: z.array(scrapedReviewSchema).min(1).max(MAX_REVIEWS_PER_BATCH),
    // Opaque client-generated id for idempotent retries from the extension.
    batchId: trimmed(64).optional().nullable(),
  })
  .strict()
  .superRefine((val, ctx) => {
    // Every review in a batch must match the batch platform.
    val.reviews.forEach((r, i) => {
      if (r.platform !== val.platform) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reviews", i, "platform"],
          message: `Review platform ${r.platform} does not match batch platform ${val.platform}`,
        });
      }
    });
  });

export type ExtensionImportPayload = z.infer<typeof extensionImportSchema>;
