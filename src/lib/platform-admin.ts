// src/lib/platform-admin.ts
//
// Echorank staff, as opposed to a tenant's OWNER/ADMIN. There is no staff
// role in the schema, so platform-wide pages and APIs (lead lists, spend
// across every visitor, every queue) are gated by an explicit allowlist:
// PLATFORM_ADMIN_EMAILS, comma-separated. Unset means nobody — a missing env
// var must never open a page of other people's email addresses.
//
// /api/admin/* is gated twice: the proxy answers before the route runs, and
// every route calls requirePlatformAdminApi() itself, because the proxy
// waves through any /api/ request carrying the internal secret.
// tests/admin-api-gate.test.ts holds every route under src/app/api/admin to it.
//
// NOT STAFF = 404, never 403 (owner, 2026-11-16): pages call notFound(), the
// APIs answer { error: "not_found" } 404, so nothing tells an outsider that a
// staff area exists. (403 until then.)
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

/** The signed-in staff member, with the user id audit rows need, or null. */
export async function platformAdminUser(): Promise<{ email: string; userId: string | null } | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!isPlatformAdminEmail(email)) return null;
  return { email: email!, userId: session?.user?.id ?? null };
}

/** What a non-staff caller gets from /api/admin/*: the same as a missing route. */
export const adminNotFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

/**
 * For /api/admin/* handlers: `{ email, userId }` for staff, otherwise the 404
 * to return. Signed out, a tenant OWNER, an unset allowlist: all 404.
 */
export async function requirePlatformAdminApi(): Promise<{ email: string; userId: string | null } | NextResponse> {
  const admin = await platformAdminUser().catch(() => null);
  return admin ?? adminNotFound();
}
