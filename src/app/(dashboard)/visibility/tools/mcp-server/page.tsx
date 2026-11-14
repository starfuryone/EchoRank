import { cookies } from "next/headers";
import { SEO_TOOLS_COPY, dashboardLocale } from "@/lib/i18n/dashboard";
import { PLAN_ACCESS_COPY } from "@/lib/i18n/plan-access";
import { getCurrentTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { apiAccessPlan, planIncludesApi } from "@/lib/api-access";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { McpServerClient } from "@/components/seo-tools/mcp-server-client";
import { ToolLockedCard } from "@/components/seo-tools/tool-locked-card";
import { agentSkillIndex } from "@/lib/agent-skills/loader";

export default async function McpServerPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();
  // The MCP server rides the public API's keys: Agency and up
  // (src/lib/api-access.ts). Below it, the locked card and no key count.
  if (!planIncludesApi(membership?.tenant.planType)) {
    const c = PLAN_ACCESS_COPY[locale];
    return (
      <ToolLockedCard
        name={SEO_TOOLS_COPY[locale].items.mcp_server.name}
        title={c.apiLockedTitle(PLAN_CONFIGS[apiAccessPlan()].name)}
        body={c.apiLockedBody}
        cta={c.cta}
      />
    );
  }
  const activeKeys = membership
    ? await prisma.apiKey.count({
        where: { tenantId: membership.tenantId, revokedAt: null },
      })
    : 0;
  // Read on the server and passed down as data. The loader touches the
  // filesystem, so a client component must never import it — see CLAUDE.md's
  // client/server boundary rule.
  const skills = agentSkillIndex();

  return <McpServerClient locale={locale} activeKeys={activeKeys} skills={skills} />;
}
