import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import {
  issueExtensionToken,
  revokeExtensionToken,
  rotateExtensionToken,
} from "@/lib/extension-token";

/**
 * Dashboard-facing management of browser-extension API tokens. Session
 * authenticated + tenant scoped (NOT bearer auth — that is the extension's own
 * ingest path). Plaintext token is returned exactly once, on issue/rotate.
 */

function err(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Internal server error";
  const status = message.includes("Not authenticated") ? 401 : 500;
  return NextResponse.json({ error: message }, { status });
}

const issueSchema = z.object({
  label: z.string().trim().min(1).max(120),
  expiresInDays: z.number().int().positive().max(3650).optional(),
});

// GET — list tokens for the active tenant (metadata only; never the secret).
export async function GET(): Promise<NextResponse> {
  try {
    const { tenantId } = await requireTenant();
    const tokens = await prisma.extensionToken.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ data: tokens });
  } catch (e) {
    return err(e);
  }
}

// POST — issue a new token. Returns plaintext once.
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { tenantId, userId } = await requireTenant();
    const parsed = issueSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { label, expiresInDays } = parsed.data;
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86_400_000)
      : null;

    const issued = await issueExtensionToken({ tenantId, userId, label, expiresAt });

    await createAuditLog({
      tenantId,
      userId,
      action: "CREATE",
      entity: "ExtensionToken",
      entityId: issued.id,
      details: { label, prefix: issued.prefix },
    });

    return NextResponse.json(
      { data: { id: issued.id, prefix: issued.prefix, token: issued.token } },
      { status: 201 },
    );
  } catch (e) {
    return err(e);
  }
}

const mutateSchema = z.object({
  tokenId: z.string().min(1),
  action: z.enum(["rotate", "revoke"]),
});

// PATCH — rotate or revoke. Rotate returns a new plaintext.
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const { tenantId, userId } = await requireTenant();
    const parsed = mutateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    const { tokenId, action } = parsed.data;

    if (action === "revoke") {
      const ok = await revokeExtensionToken(tenantId, tokenId);
      if (!ok) return NextResponse.json({ error: "Token not found" }, { status: 404 });
      await createAuditLog({
        tenantId,
        userId,
        action: "DELETE",
        entity: "ExtensionToken",
        entityId: tokenId,
        details: { revoked: true },
      });
      return NextResponse.json({ data: { id: tokenId, revoked: true } });
    }

    const rotated = await rotateExtensionToken(tenantId, userId, tokenId);
    if (!rotated) return NextResponse.json({ error: "Token not found" }, { status: 404 });
    await createAuditLog({
      tenantId,
      userId,
      action: "UPDATE",
      entity: "ExtensionToken",
      entityId: rotated.id,
      details: { rotatedFrom: tokenId },
    });
    return NextResponse.json({
      data: { id: rotated.id, prefix: rotated.prefix, token: rotated.token, rotatedFrom: tokenId },
    });
  } catch (e) {
    return err(e);
  }
}
