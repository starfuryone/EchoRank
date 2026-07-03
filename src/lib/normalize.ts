/**
 * normalize.ts — flatten nested Prisma `include` shapes into the flat fields
 * dashboard pages render. Use at the fetch boundary so an API shape change
 * can't crash a page (e.g. `undefined.split()`).
 */

export interface WithCustomer {
  customer?: { name?: string | null; email?: string | null } | null;
  customerName?: string | null;
  customerEmail?: string | null;
}
export function flattenCustomer<T extends WithCustomer>(
  row: T,
): T & { customerName: string; customerEmail: string | null } {
  return {
    ...row,
    customerName: row.customerName ?? row.customer?.name ?? "Unknown",
    customerEmail: row.customerEmail ?? row.customer?.email ?? null,
  };
}

export interface WithUser {
  user?: { name?: string | null; email?: string | null; image?: string | null } | null;
}
export function flattenUser<T extends WithUser>(
  row: T,
): T & { name: string; email: string; avatarUrl: string | null } {
  return {
    ...row,
    name: row.user?.name ?? row.user?.email ?? "Unknown",
    email: row.user?.email ?? "",
    avatarUrl: row.user?.image ?? null,
  };
}

/** Safe initials — never throws on null/empty. */
export function initials(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}
