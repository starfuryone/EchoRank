// src/lib/site-crawler/public-api-archived.ts — the public API's answer for a
// crawl whose rows are in the archive. The dashboard routes it proxies (pages,
// export) answer 409 {code: "ARCHIVED"}; the public API speaks lower-case
// error codes, so it is re-worded here. Anything else passes through.

import { NextResponse } from "next/server";

export async function publicArchived(res: Response): Promise<Response> {
  if (res.status !== 409) return res;
  const body = (await res.clone().json().catch(() => null)) as { code?: string; storageState?: string } | null;
  if (body?.code !== "ARCHIVED") return res;
  return NextResponse.json({ error: "archived", storageState: body.storageState ?? "ARCHIVED" }, { status: 409 });
}
