"use client";

// Custom Prompts — the home of tracked prompts, moved off /visibility.
//
// It owns no data fetching of its own: AnswerTrackingCard and PromptTrends
// already fetch /api/ai/visibility/prompts and its trends sibling, and they
// moved here whole rather than being reimplemented. What this file adds is the
// page frame every other tool page has — the tool heading from SEO_TOOLS_COPY
// and the back links — so arriving from the hub looks like arriving at any
// other tool rather than at a fragment of the AI Visibility page.

import { Wrench } from "lucide-react";
import { BackLink, BackLinkRow } from "@/components/ui/back-link";
import { AnswerTrackingCard } from "@/components/visibility/AnswerTrackingCard";
import { PromptTrends } from "@/components/visibility/prompt-trends";
import { SEO_TOOLS_COPY, VISIBILITY_COPY, dashNav, type DashLocale } from "@/lib/i18n/dashboard";

export function CustomPromptsClient({ locale }: { locale: DashLocale }) {
  const it = SEO_TOOLS_COPY[locale].items.custom_prompts;

  return (
    <div className="space-y-6">
      <BackLinkRow>
        <BackLink href="/visibility">{VISIBILITY_COPY[locale].title}</BackLink>
        <BackLink href="/visibility/tools" icon={Wrench}>
          {dashNav[locale]["/visibility/tools"]}
        </BackLink>
      </BackLinkRow>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{it.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{it.description}</p>
      </div>

      {/* Both are AGENCY+ and render their own locked/empty states. */}
      <AnswerTrackingCard locale={locale} />
      <PromptTrends locale={locale} />
    </div>
  );
}
