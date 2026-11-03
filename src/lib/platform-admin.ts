// src/lib/platform-admin.ts
//
// Echorank staff, as opposed to a tenant's OWNER/ADMIN. There is no staff
// role in the schema, so platform-wide pages and APIs (lead lists, spend
// across every visitor, every queue) are gated by an explicit allowlist:
// PLATFORM_ADMIN_EMAILS, comma-separated. Unset means nobody — a missing env
// var must never open a page of other people's email addresses.
//
// /api/admin/* is gated twice: the proxy answers 403 before the route runs,
// and every route calls requirePlatformAdminApi() itself, because the proxy
// waves through any /api/ request carrying the internal secret.
// tests/admin-api-gate.test.ts holds every route under src/app/api/admin to it.
import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdminEmail } from "@/lib/platform-admin-emails";

export { isPlatformAdminEmail };

/** The signed-in staff member's email, or null. */
export async function platformAdmin(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  return isPlatformAdminEmail(email) ? email : null;
}

export const forbidden = () => NextResponse.json({ error: "forbidden" }, { status: 403 });

/**
 * For /api/admin/* handlers: `{ email }` for staff, otherwise the 403 to
 * return. Signed out, a tenant OWNER, an unset allowlist: all 403.
 */
export async function requirePlatformAdminApi(): Promise<{ email: string } | NextResponse> {
  const email = await platformAdmin().catch(() => null);
  return email ? { email } : forbidden();
}
