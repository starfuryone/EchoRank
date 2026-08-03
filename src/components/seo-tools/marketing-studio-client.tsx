"use client";

// Marketing Studio — the brief picker.
//
// The mode chip on every card is the point of this screen, not decoration. The
// three modes differ in what they cost and in where the data goes, and a tenant
// deciding whether to paste their customer feedback into a box deserves to know
// which one they are about to use BEFORE they paste, not in a tooltip after.
// So "Computed on this server" is a chip on the card, in the same place, in the
// same weight as the name.

import Link from "next/link";
import { Lock, Sparkles, Calculator, ServerCog, Mic2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MARKETING_CATEGORIES, type MarketingMode } from "@/lib/marketing-templates";
import type { MarketingUsage } from "@/lib/marketing/types";
import {
  MARKETING_COPY,
  marketingLabel,
  type DashLocale,
} from "@/lib/i18n/dashboard";

const STUDIO_BASE = "/visibility/tools/ai-content-helper";

/** Button-styled Link. The ui/Button has no asChild, and the adjacent tool
 *  pages (content-explorer, ai-lens) all render CTAs this way. */
export const CTA_LINK_CLASS =
  "inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

const SECONDARY_LINK_CLASS =
  "inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

interface Props {
  locale: DashLocale;
  usage: MarketingUsage | null;
  hasVoiceGuide: boolean;
}

const MODE_ICON: Record<MarketingMode, typeof Sparkles> = {
  generate: Sparkles,
  hybrid: Calculator,
  heuristic: ServerCog,
};

export function MarketingStudioClient({ locale, usage, hasVoiceGuide }: Props) {
  const t = MARKETING_COPY[locale];
  const unlocked = usage?.unlocked ?? false;

  const modeLabel = (mode: MarketingMode): string =>
    mode === "generate" ? t.modeGenerate : mode === "hybrid" ? t.modeHybrid : t.modeHeuristic;

  const num = (n: number) => n.toLocaleString(locale === "de-CH" ? "de-CH" : locale);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">{t.hubTitle}</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">{t.hubIntro}</p>

        {unlocked && usage ? (
          <p className="mt-3 text-xs text-gray-500">
            <span className="tabular-nums">
              {usage.limit === null
                ? t.usageUnlimited(num(usage.used))
                : t.usageLine(num(usage.used), num(usage.limit))}
            </span>
            {usage.limit !== null ? <> {t.usageResets}</> : null} {t.usageFree}
          </p>
        ) : null}
      </header>

      {!unlocked ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6">
            <Badge className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              {t.lockedTitle}
            </Badge>
            <p className="max-w-2xl text-sm text-gray-600">{t.lockedBody}</p>
            <Link href="/billing" className={CTA_LINK_CLASS}>
              {t.upgradeCta}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* The brand-voice card sits above the grid because saving a voice
          changes the output of the other eleven — it is a setting, not a
          thirteenth brief. */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Mic2 className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-900">{t.voiceTitle}</p>
              <p className="mt-0.5 max-w-2xl text-xs text-gray-600">
                {hasVoiceGuide ? t.voiceActive : t.voiceNone} {t.voiceSamplesNotStored}
              </p>
            </div>
          </div>
          <Link href={`${STUDIO_BASE}/voice`} className={SECONDARY_LINK_CLASS}>
            {t.voiceTitle}
          </Link>
        </CardContent>
      </Card>

      <section aria-labelledby="brief-picker">
        <h2 id="brief-picker" className="sr-only">
          {t.hubPickPrompt}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETING_CATEGORIES.map((category) => {
            const Icon = MODE_ICON[category.mode];
            return (
              <li key={category.id}>
                <Link
                  href={`${STUDIO_BASE}/${category.id}`}
                  className="block h-full rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {marketingLabel(t, category.nameKey)}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-gray-400">{category.num}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
                    {marketingLabel(t, category.roleKey)}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {modeLabel(category.mode)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
