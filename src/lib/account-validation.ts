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
