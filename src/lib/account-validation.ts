/**
 * Validation for the /settings/account tenant-name edit.
 *
 * Kept out of the "use server" module on purpose: Next only permits async
 * function exports from a server-action file, so a schema exported alongside
 * the action is a build error. Keeping it here also makes it unit-testable
 * without pulling in next/headers or Prisma.
 */
import { z } from "zod";

export const TENANT_NAME_MAX = 200;

/** Error codes are ACCOUNT_COPY keys so the client can localize them. */
export const tenantNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "errorEmpty" })
    .max(TENANT_NAME_MAX, { message: "errorTooLong" }),
});

export type TenantNameInput = z.infer<typeof tenantNameSchema>;

export type ParseResult =
  | { ok: true; name: string }
  | { ok: false; errorKey: "errorEmpty" | "errorTooLong" | "errorGeneric" };

/** Pure parse step: unknown input -> trimmed name or a localizable error key. */
export function parseTenantName(raw: unknown): ParseResult {
  const result = tenantNameSchema.safeParse(raw);
  if (result.success) return { ok: true, name: result.data.name };

  const code = result.error.issues[0]?.message;
  if (code === "errorEmpty" || code === "errorTooLong") {
    return { ok: false, errorKey: code };
  }
  return { ok: false, errorKey: "errorGeneric" };
}

/**
 * Builds the Prisma update args. Separated so tests can assert that the write
 * is always scoped to the caller's tenant id and touches only `name` — a
 * regression here would be a cross-tenant write.
 */
export function buildTenantNameUpdate(tenantId: string, name: string) {
  return {
    where: { id: tenantId },
    data: { name },
    select: { id: true, name: true },
  } as const;
}

// ── AI revenue assumptions ──────────────────────────────────────────────────
//
// Both feed every figure on /visibility/tools/revenue and the nightly rollup.
// The bounds are not cosmetic: convRate = 0 makes `won` identically zero, which
// reads as a data outage rather than a bad input, and avgSaleValue = 0 does the
// same to both headline numbers. A convRate above 1 would claim more sales than
// leads. Postgres carries the same two bounds as CHECK constraints, as a
// backstop under any future path that skips this parse.

/** Schema defaults, mirrored from prisma/schema.prisma so the form can reset. */
export const CONV_RATE_DEFAULT = 0.3;
export const AVG_SALE_VALUE_DEFAULT = 450;

/**
 * Upper bound on a single sale, chosen to catch a typo rather than to police a
 * business: a tenant selling €40,000 machine tools is real, a tenant who typed
 * their phone number into the box is not.
 */
export const AVG_SALE_VALUE_MAX = 10_000_000;

export type RevenueAssumptionsErrorKey =
  | "errorConvRate"
  | "errorAvgSaleValue"
  | "errorGeneric";

/**
 * Accepts a comma decimal separator before coercing.
 *
 * fr and de-CH users type "0,35" and "1250,50", and a bare Number() turns both
 * into NaN — which this form would then report as "must be between 0 and 1",
 * blaming the value rather than the separator.
 */
function toNumber(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return NaN;
  return Number(raw.trim().replace(",", "."));
}

export const revenueAssumptionsSchema = z.object({
  convRate: z
    .number()
    .refine((n) => Number.isFinite(n) && n > 0 && n <= 1, { message: "errorConvRate" }),
  avgSaleValue: z
    .number()
    .refine((n) => Number.isFinite(n) && n > 0 && n <= AVG_SALE_VALUE_MAX, {
      message: "errorAvgSaleValue",
    }),
});

export type RevenueAssumptionsInput = z.infer<typeof revenueAssumptionsSchema>;

export type RevenueAssumptionsParseResult =
  | { ok: true; convRate: number; avgSaleValue: number }
  | { ok: false; errorKey: RevenueAssumptionsErrorKey };

/** Pure parse step: form strings -> two bounded numbers or a localizable key. */
export function parseRevenueAssumptions(raw: {
  convRate: unknown;
  avgSaleValue: unknown;
}): RevenueAssumptionsParseResult {
  const result = revenueAssumptionsSchema.safeParse({
    convRate: toNumber(raw.convRate),
    avgSaleValue: toNumber(raw.avgSaleValue),
  });
  if (result.success) {
    return {
      ok: true,
      convRate: result.data.convRate,
      avgSaleValue: result.data.avgSaleValue,
    };
  }

  const code = result.error.issues[0]?.message;
  if (code === "errorConvRate" || code === "errorAvgSaleValue") {
    return { ok: false, errorKey: code };
  }
  return { ok: false, errorKey: "errorGeneric" };
}

/**
 * Builds the Prisma update args. Separated for the same reason as the rename
 * above: a test can assert the write is scoped to the caller's tenant id and
 * touches only these two columns.
 */
export function buildRevenueAssumptionsUpdate(
  tenantId: string,
  convRate: number,
  avgSaleValue: number,
) {
  return {
    where: { id: tenantId },
    data: { convRate, avgSaleValue },
    select: { id: true, convRate: true, avgSaleValue: true },
  } as const;
}
