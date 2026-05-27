import { requireRole } from "@/lib/tenant";
import { gdprService } from "@/infrastructure/compliance/gdpr";

/**
 * POST /api/compliance/erase
 *
 * GDPR erasure request (right to be forgotten).
 * Body: { customerId: string, reason?: string }
 * Requires OWNER role.
 */
export async function POST(request: Request) {
  try {
    const membership = await requireRole(["OWNER"]);
    const tenantId = membership.tenantId;

    const body = await request.json();
    const { customerId, reason } = body as {
      customerId?: string;
      reason?: string;
    };

    if (!customerId || typeof customerId !== "string") {
      return Response.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    await gdprService.eraseCustomerData(
      tenantId,
      customerId,
      membership.userId
    );

    return Response.json({
      success: true,
      message: `Customer data for ${customerId} has been erased`,
      reason: reason ?? "GDPR erasure request",
      erasedAt: new Date().toISOString(),
    });
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

    if (
      error instanceof Error &&
      error.message.includes("legal hold")
    ) {
      return Response.json(
        { error: error.message },
        { status: 409 }
      );
    }

    console.error("Error erasing customer data:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
