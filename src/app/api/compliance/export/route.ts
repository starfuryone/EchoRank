import { NextRequest } from "next/server";
import { requireRole } from "@/lib/tenant";
import { gdprService } from "@/infrastructure/compliance/gdpr";

/**
 * GET /api/compliance/export?customerId=...
 *
 * Exports all data for a customer (GDPR right of access).
 * Requires OWNER or ADMIN role.
 */
export async function GET(request: NextRequest) {
  try {
    const membership = await requireRole(["OWNER", "ADMIN"]);
    const tenantId = membership.tenantId;

    const customerId = request.nextUrl.searchParams.get("customerId");
    if (!customerId) {
      return Response.json(
        { error: "customerId query parameter is required" },
        { status: 400 }
      );
    }

    const data = await gdprService.exportCustomerData(tenantId, customerId);

    return Response.json(data);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Not authenticated or no tenant access" ||
        error.message === "Insufficient permissions")
    ) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      error.message.includes("not found")
    ) {
      return Response.json(
        { error: error.message },
        { status: 404 }
      );
    }

    console.error("Error exporting customer data:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
