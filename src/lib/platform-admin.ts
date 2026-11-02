// src/lib/platform-admin.ts
//
// Echorank staff, as opposed to a tenant's OWNER/ADMIN. There is no staff
// role in the schema, so platform-wide pages (lead lists, spend across every
// visitor) are gated by an explicit allowlist: PLATFORM_ADMIN_EMAILS,
// comma-separated. Unset means nobody — a missing env var must never open a
// page of other people's email addresses.
import "server-only";

import { auth } from "@/lib/auth";

export function isPlatformAdminEmail(email: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!email) return false;
  const list = (env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/** The signed-in staff member's email, or null. */
export async function platformAdmin(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  return isPlatformAdminEmail(email) ? email : null;
}
