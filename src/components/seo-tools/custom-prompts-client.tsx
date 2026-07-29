"use client";

// Custom Prompts — the home of tracked prompts, moved off /visibility.
//
// It owns no data fetching of its own: AnswerTrackingCard and PromptTrends
// already fetch /api/ai/visibility/prompts and its trends sibling, and they
// moved here whole rather than being reimplemented. What this file adds is the
// page frame every other tool page has — the tool heading from SEO_TOOLS_COPY,
// the back links, and the help button — so arriving from the hub looks like
// arriving at any other tool rather than at a fragment of the AI Visibility
// page.
//
// The prompt allowance is lifted out of AnswerTrackingCard's existing load
// rather than fetched again, so the help modal can quote the live number
// without the page issuing two identical GETs.

import { useCallback, useState } from "react";
import { Wrench } from "lucide-react";
import { BackLink, BackLinkRow } from "@/components/ui/back-link";
import { AnswerTrackingCard } from "@/components/visibility/AnswerTrackingCard";
import { PromptTrends } from "@/components/visibility/prompt-trends";
import {
  CustomPromptsHelpButton,
  type PromptQuota,
} from "@/components/seo-tools/custom-prompts-help";
import { SEO_TOOLS_COPY, VISIBILITY_COPY, dashNav, type DashLocale } from "@/lib/i18n/dashboard";

export function CustomPromptsClient({ locale }: { locale: DashLocale }) {
  const it = SEO_TOOLS_COPY[locale].items.custom_prompts;
  const [quota, setQuota] = useState<PromptQuota | null>(null);

  // Stable identity so the card's loader is not re-created on every render.
  const handleQuota = useCallback((next: PromptQuota) => setQuota(next), []);

  return (
    <div className="space-y-6">
      <BackLinkRow>
        <BackLink href="/visibility">{VISIBILITY_COPY[locale].title}</BackLink>
        <BackLink href="/visibility/tools" icon={Wrench}>
          {dashNav[locale]["/visibility/tools"]}
        </BackLink>
      </BackLinkRow>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{it.name}</h2>
          <p className="mt-1 text-sm text-gray-500">{it.description}</p>
        </div>
        <div className="shrink-0">
          <CustomPromptsHelpButton locale={locale} quota={quota} />
        </div>
      </div>

      {/* Both are AGENCY+ and render their own locked/empty states. */}
      <AnswerTrackingCard locale={locale} onQuota={handleQuota} />
      <PromptTrends locale={locale} />
    </div>
  );
}
