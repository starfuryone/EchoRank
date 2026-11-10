// src/lib/authority-checker/override.ts — the staff override of a tenant's
// monthly Link Authority Checker allowance, as /admin/link-authority accepts
// it. Dependency-free (the admin page, its API and the tests read it).

/** What /admin/link-authority accepts (inclusive). */
export const LINK_AUTHORITY_OVERRIDE_BOUNDS = [1, 100_000] as const;

/** "" or absent = null (the plan's value); else an integer within the bounds. */
export function parseLinkAuthorityOverride(raw: string | null | undefined): { ok: true; value: number | null } | { ok: false } {
  const v = (raw ?? "").trim();
  if (v === "") return { ok: true, value: null };
  const n = Number(v.replace(/[,\s']/g, ""));
  const [min, max] = LINK_AUTHORITY_OVERRIDE_BOUNDS;
  return Number.isInteger(n) && n >= min && n <= max ? { ok: true, value: n } : { ok: false };
}
