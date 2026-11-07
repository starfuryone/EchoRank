import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdminApi } from "@/lib/platform-admin";
import { setInquiryStatus } from "@/lib/sales/inquiries";

const Body = z.object({ status: z.enum(["NEW", "CONTACTED", "CLOSED"]) });

// Staff only: move a sales inquiry to new / contacted / closed.
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const admin = await requirePlatformAdminApi();
  if (admin instanceof NextResponse) return admin;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { id } = await ctx.params;
  const row = await setInquiryStatus(id, parsed.data.status);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ inquiry: row });
}
