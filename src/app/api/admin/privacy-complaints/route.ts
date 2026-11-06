import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform-admin";
import { listComplaints } from "@/lib/privacy/complaints";

// Staff only (PLATFORM_ADMIN_EMAILS): every data-protection complaint, newest first,
// with its status and the timestamp of each step.
export async function GET() {
  const admin = await requirePlatformAdminApi();
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json({ complaints: await listComplaints() });
}
