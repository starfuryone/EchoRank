import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdminApi } from "@/lib/platform-admin";
import { setComplaintStatus } from "@/lib/privacy/complaints";

const Body = z.object({
  status: z.enum(["RECEIVED", "IN_PROGRESS", "ANSWERED"]),
  answerNote: z.string().max(10_000).optional(),
});

// Staff only: move a complaint to in progress / answered. Each step's timestamp
// is set once, the first time it is reached.
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const admin = await requirePlatformAdminApi();
  if (admin instanceof NextResponse) return admin;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { id } = await ctx.params;
  const row = await setComplaintStatus(id, parsed.data.status, parsed.data.answerNote);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ complaint: row });
}
