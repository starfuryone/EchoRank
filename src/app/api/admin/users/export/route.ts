// GET /api/admin/users/export?q=&plan=&status= — staff only (404 otherwise).
// The /admin/users table as CSV, through src/lib/csv-export.ts (BOM, formula
// guard, CRLF), with the same filters, up to ADMIN_USERS_CSV_CAP rows; past
// the cap the last line says TRUNCATED.

import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform-admin";
import { contentDisposition, csvFilename, toCsv, truncationNotice } from "@/lib/csv-export";
import { ADMIN_USERS_CSV_CAP, ADMIN_USER_CSV_COLUMNS, exportAdminUsers, parseAdminUserFilters } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requirePlatformAdminApi();
  if (admin instanceof NextResponse) return admin;

  const filters = parseAdminUserFilters(request.nextUrl.searchParams);
  const { rows, truncated } = await exportAdminUsers(filters);
  let csv = toCsv(rows, ADMIN_USER_CSV_COLUMNS);
  if (truncated) csv += truncationNotice(ADMIN_USER_CSV_COLUMNS, ADMIN_USERS_CSV_CAP) + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition(csvFilename("admin-users")),
      "Cache-Control": "no-store",
    },
  });
}
