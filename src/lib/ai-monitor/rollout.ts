// src/lib/ai-monitor/rollout.ts
//
// The kill switch for the AI Search Intelligence surface, while it is being
// built out phase by phase.
//
// SEPARATE FROM src/lib/feature-flags.ts, which answers a different question.
// That file says what a TIER has bought and is stable, tested product
// definition; this says whether the code is finished enough to show anyone. A
// tenant on AGENCY carries `ai_visibility` today and must keep carrying it —
// folding a build-progress switch into that set would mean editing the product
// definition twice per phase and would put an env read into a module that
// client components import.
//
// ENV, NOT DATABASE. This box serves production from its working tree and
// restarts several times a day; flipping the surface on has to be a
// one-line .env change plus a restart, not a migration.
//
// DEFAULT OFF. An unset variable means "not ready" — the failure mode of a
// half-built dashboard appearing for every tenant is much worse than the
// failure mode of an operator having to set one variable.

/** Set to "1"/"true" to expose the surface. */
export const AI_SEARCH_FLAG_ENV = "AI_SEARCH_ENABLED";

/** Comma-separated tenant ids that see it regardless of the global switch. */
export const AI_SEARCH_TENANTS_ENV = "AI_SEARCH_TENANT_IDS";

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/** The global switch, ignoring per-tenant allowlisting. */
export function aiSearchEnabledGlobally(env: NodeJS.ProcessEnv = process.env): boolean {
  return isTruthy(env[AI_SEARCH_FLAG_ENV]);
}

export function aiSearchAllowlist(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = env[AI_SEARCH_TENANTS_ENV];
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id !== ""),
  );
}

/**
 * Should this tenant see the AI Search Intelligence surface?
 *
 * The allowlist exists so the phases can be dogfooded on the real box with
 * real spend against one tenant before the global switch goes on. It is
 * checked even when the global switch is off — that is the whole point of it —
 * but never the other way round: an allowlist cannot take the surface AWAY from
 * a tenant once the global switch is on, because a partial rollback that leaves
 * some tenants with data they can no longer see is worse than no rollback.
 */
export function aiSearchEnabledFor(
  tenantId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (aiSearchEnabledGlobally(env)) return true;
  if (!tenantId) return false;
  return aiSearchAllowlist(env).has(tenantId);
}
