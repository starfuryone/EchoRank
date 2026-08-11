import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { aiSearchEnabledFor } from "@/lib/ai-monitor/rollout";
import { prisma } from "@/lib/prisma";
import { readPromptAnswers, readPrompts } from "@/lib/ai-monitor/dashboard/read";
import { PromptDrilldown } from "./drilldown-client";

/**
 * The prompt list, and one prompt's answers when `prompt` is set.
 *
 * Both are reads. The single write the page can make — a prompt's tracking
 * switch and its tags — goes through PATCH /api/ai-search/prompts/[id].
 */
export default async function AiSearchPromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; prompt?: string }>;
}) {
  const membership = await requireTenant();
  if (!aiSearchEnabledFor(membership.tenantId)) notFound();

  const { brand: brandId, prompt: promptId } = await searchParams;

  // Tenant-scoped in the query, so a guessed brand id from another tenant is a
  // 404 rather than a leak.
  const brand = await prisma.brandProfile.findFirst({
    where: { tenantId: membership.tenantId, ...(brandId ? { id: brandId } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!brand) notFound();

  const prompts = await readPrompts(brand.id);
  const selected = promptId ? prompts.find((prompt) => prompt.id === promptId) : undefined;
  const answers = selected ? await readPromptAnswers(selected.id, brand.id) : [];

  return (
    <PromptDrilldown
      brand={brand}
      prompts={prompts}
      selected={selected ?? null}
      answers={answers}
      timezone={membership.tenant.timezone}
    />
  );
}
