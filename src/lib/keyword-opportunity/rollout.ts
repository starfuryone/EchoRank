// src/lib/keyword-opportunity/rollout.ts
//
// The switch that decides whether a tenant gets a LIVE domain analysis or the
// worked example.
//
// SAME SHAPE AS ai-monitor/rollout.ts, AND A SEPARATE VARIABLE. The two
// products reach GA on their own timetables, and sharing one flag would mean
// dogfooding this feature silently exposed whichever watcher phase happened to
// be half-built. Its header explains at length why this is env rather than
// database and why the default is off; that reasoning applies here unchanged
// and is not repeated.
//
// ── WHAT "OFF" MEANS HERE IS UNUSUAL, AND DELIBERATE ────────────────────────
//
// For the watcher, off means the surface is hidden. Here, off means the page
// renders the AcmeCRM worked example behind its preview notice — the Phase 2
// experience, unchanged. Nothing regresses for a tenant who is not allowlisted:
// they keep a page that demonstrates the product honestly and says so.
//
// That is why this gate must be read at the point a RUN is started, not only
// where the page is rendered. A non-allowlisted tenant seeing the demo must not
// be able to POST their way to a real analysis by guessing the endpoint.

/** Set to "1"/"true" to give every paid tenant live domain analyses. */
export const KOF_FLAG_ENV = "KOF_ENABLED";

/** Comma-separated tenant ids that get live runs regardless of the switch. */
export const KOF_TENANTS_ENV = "KOF_TENANT_IDS";

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/** The global switch, ignoring per-tenant allowlisting. */
export function kofEnabledGlobally(env: NodeJS.ProcessEnv = process.env): boolean {
  return isTruthy(env[KOF_FLAG_ENV]);
}

export function kofAllowlist(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = env[KOF_TENANTS_ENV];
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id !== ""),
  );
}

/**
 * Does this tenant get live domain analyses?
 *
 * The allowlist is checked even when the global switch is off — that is what it
 * is for — but never the other way round: an allowlist cannot take live runs
 * AWAY once the global switch is on, because a partial rollback that leaves
 * some tenants holding analyses they can no longer re-run is worse than no
 * rollback.
 */
export function kofEnabledFor(
  tenantId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (kofEnabledGlobally(env)) return true;
  if (!tenantId) return false;
  return kofAllowlist(env).has(tenantId);
}
