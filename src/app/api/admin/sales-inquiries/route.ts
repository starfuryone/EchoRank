import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform-admin";
import { listInquiries, type InquiryStatusValue } from "@/lib/sales/inquiries";

const STATUSES = new Set<InquiryStatusValue>(["NEW", "CONTACTED", "CLOSED"]);

// Staff only: sales inquiries, newest first, optionally ?status=NEW|CONTACTED|CLOSED.
export async function GET(request: Request) {
  const admin = await requirePlatformAdminApi();
  if (admin instanceof NextResponse) return admin;
  const s = new URL(request.url).searchParams.get("status")?.toUpperCase() as InquiryStatusValue | undefined;
  if (s && !STATUSES.has(s)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  return NextResponse.json({ inquiries: await listInquiries(s) });
}
