import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { McpServerClient } from "@/components/seo-tools/mcp-server-client";

// MCP server connection instructions. Paid gating enforced by ../layout.tsx;
// the active-key count is read server-side for the caller's own tenant only.
export default async function McpServerPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();
  const activeKeys = membership
    ? await prisma.apiKey.count({
        where: { tenantId: membership.tenantId, revokedAt: null },
      })
    : 0;
  return <McpServerClient locale={locale} activeKeys={activeKeys} />;
}
