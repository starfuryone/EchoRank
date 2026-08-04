/**
 * POST /api/account/matrix/provision — issue this user a Matrix chat account.
 *
 * Guard chain: requireTenant → requireFeature(matrix_chat) → Redis rate limit
 * (5/hour/user) → reject if a live account already exists → derive an available
 * localpart → register with Synapse → store the mxid.
 *
 * THE PASSWORD IS RETURNED ONCE AND NEVER STORED. It exists in this response
 * body and nowhere else: not in the database (see the MatrixAccount comment),
 * not in a log line, not in an error message. If the user loses it they get a
 * reset, not a lookup — that is the point.
 *
 * AUTHENTICATED — do not add /api/account/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import {
  derivePassword,
  provisionMatrixAccount,
  usernameAvailable,
} from "@/lib/matrix/provision";
import {
  activeMatrixAccount,
  deriveLocalpart,
  resolveAvailableLocalpart,
} from "@/lib/matrix-accounts";

/** Per user. Provisioning is cheap for us and permanent for Synapse. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export const ELEMENT_URL = "https://element.echorank360.com";

export async function POST() {
  try {
    const membership = await requireTenant();
    await requireFeature("matrix_chat");

    const appUserId = membership.userId;
    const tenantId = membership.tenantId;

    const limited = await rateLimit(`matrix-provision:${appUserId}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const existing = await activeMatrixAccount(tenantId, appUserId);
    if (existing) {
      // 409, not 200-with-the-old-account: the caller asked to create
      // something that already exists, and we cannot re-issue its password.
      return NextResponse.json(
        { error: "You already have a chat account.", code: "ALREADY_PROVISIONED", mxid: existing.mxid },
        { status: 409 },
      );
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { slug: true, name: true },
    });
    const user = await prisma.user.findFirst({
      where: { id: appUserId },
      select: { email: true, name: true },
    });

    // Prefer the local part of the email — stable, unique per person, and what
    // a colleague would guess. Falls back to the display name, then the id.
    const userIdentifier =
      user?.email?.split("@")[0] || user?.name || appUserId.slice(0, 12);
    const base = deriveLocalpart(tenant?.slug || tenant?.name || "echorank", userIdentifier);

    const localpart = await resolveAvailableLocalpart(base, usernameAvailable);
    const password = derivePassword();
    const { mxid } = await provisionMatrixAccount(localpart, password);

    await prisma.matrixAccount.create({
      data: { tenantId, appUserId, mxid },
    });

    return NextResponse.json({ mxid, password, elementUrl: ELEMENT_URL });
  } catch (err) {
    const enforcement = enforcementErrorResponse(err);
    if (enforcement) return enforcement;
    if (err instanceof Error && err.message.includes("Not authenticated")) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    // Never echo the upstream message: a Synapse error can carry the localpart
    // and, on a misconfiguration, fragments of the registration secret.
    console.error("[matrix] provision failed:", err instanceof Error ? err.name : typeof err);
    return NextResponse.json(
      { error: "Could not create a chat account right now.", code: "PROVISION_FAILED" },
      { status: 502 },
    );
  }
}
