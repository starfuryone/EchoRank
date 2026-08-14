// src/lib/ai-tools.ts
//
// The AI hub config. Same shape and same rules as reputation-tools.ts and
// seo-tools.ts — one typed source, cards rendered from it, parity asserted by
// a test.
//
// WHY THIS EXISTS. The AI surfaces had accumulated in three unrelated places:
// a sidebar row pointing at one dashboard, two tools buried in the 25-card SEO
// hub, and AI Search Intelligence at a URL nothing in the app linked to at all.
// "Where is the AI stuff" had no answer. One sidebar row, one page, one answer.
//
// NO ROUTES MOVED. Every card points at the surface that already exists —
// /visibility is still the AI Visibility dashboard, and it is linked from the
// marketing site, the onboarding emails and the notification fan-in. The hub
// took a NEW path (/ai) rather than displacing it, exactly as /reputation did.
// This file is navigation only: it grants nothing and enforces nothing.
//
// TOOLS STAY REGISTERED WHERE THEY ARE. ai_attribution and custom_prompts are
// cards in SEO_TOOL_GROUPS and rows in dashNav already. The hub LINKS to them;
// it does not re-register them, and their four-place registry entries are
// untouched.
//
// ROLLOUT HIDES, PLAN LOCKS. Two different questions, deliberately not merged:
//   - reputation-tools.ts has `feature`, which LOCKS a card — the destination
//     exists and is finished, the tenant just has not bought it, so naming the
//     plan that unlocks it is useful.
//   - this file has `rollout`, which HIDES a card — the destination answers
//     notFound() when its build-progress switch is off, so a locked card would
//     promise something that 404s. A card nobody can reach is worse than no
//     card. See src/lib/ai-monitor/rollout.ts for why that switch is env.
// This module stays PURE: it reads no environment and no database. The page
// resolves the switches and passes the answers in, which is what keeps this
// file testable without either.

import type { ComponentType } from "react";
import { ScanEye, Telescope, MousePointerClick, MessageSquareText } from "lucide-react";
import type { PlanType } from "@/generated/prisma";

export const AI_HUB = "/ai";

export type AiGroupId = "answers" | "traffic";

export type AiToolId = "ai_visibility" | "ai_search" | "custom_prompts" | "ai_attribution";

/**
 * Build-progress switches a card's destination enforces for itself. Named
 * rather than boolean so adding a second rolled-out surface is a union member
 * and a key, not another parameter.
 */
export type AiRollout = "ai_search";

export interface AiTool {
  id: AiToolId;
  /** The EXISTING route. Never a new one. */
  href: string;
  icon: ComponentType<{ className?: string }>;
  /**
   * The rollout switch its destination already checks. Absent = always shown.
   * Present = shown ONLY when that switch is on for this tenant, because the
   * destination notFound()s otherwise.
   */
  rollout?: AiRollout;
}

export interface AiToolGroup {
  id: AiGroupId;
  tools: AiTool[];
}

/**
 * Two groups, and the split is the actual argument the product makes: three
 * surfaces answer "do we appear in AI answers", one answers "do those answers
 * send anyone". Grouping them any other way would just be alphabetising.
 */
export const AI_TOOL_GROUPS: AiToolGroup[] = [
  {
    id: "answers",
    tools: [
      { id: "ai_visibility", href: "/visibility", icon: ScanEye },
      // Gated by aiSearchEnabledFor() at its own route, which notFound()s when
      // off. Default off — see AI_SEARCH_ENABLED.
      { id: "ai_search", href: "/visibility/ai-search", icon: Telescope, rollout: "ai_search" },
      { id: "custom_prompts", href: "/visibility/tools/custom-prompts", icon: MessageSquareText },
    ],
  },
  {
    id: "traffic",
    tools: [
      { id: "ai_attribution", href: "/visibility/tools/ai-attribution", icon: MousePointerClick },
    ],
  },
];

export const ALL_AI_TOOLS: AiTool[] = AI_TOOL_GROUPS.flatMap((g) => g.tools);

/** Which build-progress switches are on for the tenant being rendered for. */
export type AiRolloutState = Record<AiRollout, boolean>;

/**
 * Groups this visitor may see, with rolled-out-but-off cards removed.
 *
 * A null/undefined plan sees NOTHING, matching visibleReputationGroups: that is
 * a signed-out visitor or a tenant we could not resolve, and the hub is not a
 * public surface. Beyond that no tier is confined — every signed-in tenant sees
 * every card whose destination is actually reachable.
 *
 * A group that empties out is dropped rather than rendered as a heading with no
 * cards under it.
 */
export function visibleAiGroups(
  plan: PlanType | null | undefined,
  rollouts: AiRolloutState,
): AiToolGroup[] {
  if (!plan) return [];
  return AI_TOOL_GROUPS.map((group) => ({
    ...group,
    tools: group.tools.filter((tool) => !tool.rollout || rollouts[tool.rollout]),
  })).filter((group) => group.tools.length > 0);
}

/** True when this plan can reach the hub at all. Drives the sidebar row. */
export function canSeeAiHub(plan: PlanType | null | undefined): boolean {
  return Boolean(plan);
}
