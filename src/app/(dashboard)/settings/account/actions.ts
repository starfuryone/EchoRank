"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import { parseTenantName, buildTenantNameUpdate } from "@/lib/account-validation";

export interface UpdateTenantNameState {
  status: "idle" | "success" | "error";
  /** ACCOUNT_COPY key; the client localizes it. */
  errorKey?: "errorEmpty" | "errorTooLong" | "errorGeneric";
  name?: string;
}

/**
 * Rename the current workspace. Guarded by requireTenant only (no role or
 * feature gate, per spec). The tenant id comes from the session membership,
 * never from the form, so a caller cannot rename another tenant.
 */
export async function updateTenantNameAction(
  _prev: UpdateTenantNameState,
  formData: FormData
): Promise<UpdateTenantNameState> {
  const membership = await requireTenant();

  const parsed = parseTenantName({ name: formData.get("name") });
  if (!parsed.ok) {
    return { status: "error", errorKey: parsed.errorKey };
  }

  try {
    const updated = await prisma.tenant.update(
      buildTenantNameUpdate(membership.tenantId, parsed.name)
    );

    await createAuditLog({
      tenantId: membership.tenantId,
      userId: membership.userId,
      action: "UPDATE",
      entity: "Tenant",
      entityId: membership.tenantId,
      details: { field: "name" },
    });

    revalidatePath("/settings/account");
    return { status: "success", name: updated.name };
  } catch (err) {
    console.error("[account] tenant rename failed:", err);
    return { status: "error", errorKey: "errorGeneric" };
  }
}
