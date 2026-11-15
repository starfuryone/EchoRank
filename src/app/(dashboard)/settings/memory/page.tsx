import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { requireTenant } from "@/lib/tenant";
import { MemoryPageClient } from "./page-client";

export const dynamic = "force-dynamic";

// /settings/memory — AI memory: the on/off switch, what is remembered (with
// per-item delete) and "Delete all memories". Everything it shows comes from
// /api/account/memory, which gates on the paid plan and the session's tenant.
export default async function MemoryPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  await requireTenant();
  return <MemoryPageClient locale={locale} />;
}
