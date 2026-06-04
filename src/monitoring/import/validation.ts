import { z } from "zod";
import { CANONICAL_FIELDS } from "./source-presets";

const PLATFORMS = [
  "GOOGLE",
  "FACEBOOK",
  "TRUSTPILOT",
  "YELP",
  "REDDIT",
  "TWITTER",
  "TIKTOK",
  "YOUTUBE",
  "APP_STORE",
  "CUSTOM",
] as const;

const FORMATS = [
  "GENERIC_CSV",
  "GOOGLE_CSV",
  "FACEBOOK_CSV",
  "TRUSTPILOT_CSV",
  "EXCEL",
] as const;

/**
 * Mapping object: each canonical field optionally maps to a source column name.
 * At least `content` or `rating` must be mapped or the import carries no signal.
 */
export const columnMappingSchema = z
  .object(
    Object.fromEntries(
      CANONICAL_FIELDS.map((f) => [f, z.string().min(1).optional()]),
    ) as Record<(typeof CANONICAL_FIELDS)[number], z.ZodOptional<z.ZodString>>,
  )
  .refine((m) => Boolean(m.content) || Boolean(m.rating), {
    message: "Map at least a content or rating column",
  });

export const commitImportSchema = z.object({
  mapping: columnMappingSchema,
  platform: z.enum(PLATFORMS),
  format: z.enum(FORMATS).optional(),
  hasHeaderRow: z.boolean().default(true),
});

export type CommitImportInput = z.infer<typeof commitImportSchema>;
