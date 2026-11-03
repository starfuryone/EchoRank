// src/lib/platform-admin-emails.ts
//
// The PLATFORM_ADMIN_EMAILS allowlist check, with no imports, so the request
// proxy (src/proxy.ts) can gate /api/admin/* without pulling the session
// module or `server-only` into its bundle. Server code uses
// src/lib/platform-admin.ts, which re-exports this.
//
// Unset means nobody — a missing env var must never open a platform-wide view.

export function isPlatformAdminEmail(email: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!email) return false;
  const list = (env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/** True for /api/admin and everything under it. */
export function isAdminApiPath(pathname: string): boolean {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}
