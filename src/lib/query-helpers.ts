/**
 * Standard where clause addition to exclude soft-deleted records.
 * Use in all queries that should not return deleted records.
 */
export const notDeleted = { deletedAt: null } as const;

/**
 * Combine a where clause with soft-delete filtering.
 */
export function withNotDeleted<T extends Record<string, unknown>>(where: T) {
  return { ...where, deletedAt: null };
}
