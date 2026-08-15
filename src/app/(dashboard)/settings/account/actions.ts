"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import {
  parseTenantName,
  buildTenantNameUpdate,
  parseRevenueAssumptions,
  buildRevenueAssumptionsUpdate,
  type RevenueAssumptionsErrorKey,
} from "@/lib/account-validation";

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

export interface UpdateRevenueAssumptionsState {
  status: "idle" | "success" | "error";
  /** ACCOUNT_COPY key; the client localizes it. */
  errorKey?: RevenueAssumptionsErrorKey;
  convRate?: number;
  avgSaleValue?: number;
}

/**
 * Save the two AI revenue assumptions.
 *
 * Guarded by requireTenant only, matching the rename above — these are a
 * workspace's own numbers, not a billing or role-gated setting. The tenant id
 * comes from the session membership, never from the form, so a caller cannot
 * write another tenant's assumptions.
 *
 * Both figures feed every number on /visibility/tools/revenue AND the nightly
 * RevenueRollup job, so a save here changes what tonight's rollup stores. It
 * does NOT rewrite rows already stored: a month a customer has already read
 * keeps the numbers it was read with, and the tool page says so when the two
 * diverge.
 */
export async function updateRevenueAssumptionsAction(
  _prev: UpdateRevenueAssumptionsState,
  formData: FormData
): Promise<UpdateRevenueAssumptionsState> {
  const membership = await requireTenant();

  const parsed = parseRevenueAssumptions({
    convRate: formData.get("convRate"),
    avgSaleValue: formData.get("avgSaleValue"),
  });
  if (!parsed.ok) {
    return { status: "error", errorKey: parsed.errorKey };
  }

  try {
    const updated = await prisma.tenant.update(
      buildRevenueAssumptionsUpdate(membership.tenantId, parsed.convRate, parsed.avgSaleValue)
    );

    await createAuditLog({
      tenantId: membership.tenantId,
      userId: membership.userId,
      action: "UPDATE",
      entity: "Tenant",
      entityId: membership.tenantId,
      details: { field: "revenueAssumptions" },
    });

    revalidatePath("/settings/account");
    revalidatePath("/visibility/tools/revenue");
    return {
      status: "success",
      convRate: updated.convRate,
      avgSaleValue: updated.avgSaleValue,
    };
  } catch (err) {
    console.error("[account] revenue assumptions save failed:", err);
    return { status: "error", errorKey: "errorGeneric" };
  }
}
