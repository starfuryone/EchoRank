"use client";

// <CrawlerHelpModal> — the crawler's in-app help (Help button on /crawler,
// deep link ?help=1). Loaded with a dynamic import when opened, so the
// crawler page's bundle does not carry it.
//
// Built on the dashboard's shared Modal (src/components/ui/modal.tsx, the one
// the help hub's video card uses): role="dialog", aria-modal, aria-labelledby,
// the Tab focus trap, Escape and backdrop close and focus restore come from
// there. Nothing here is copy of its own: the capability cards are the public
// page's CRAWL_CAPABILITIES with the same flag / family gating, the plan
// numbers are the tenant's crawl quota (plan-config), and the rest is the
// helpModal catalog (en / fr / de-CH).

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { NosyBatLogo } from "@/components/brand/NosyBatLogo";
import { NB_INTRO_ANCHOR } from "@/lib/site-crawler/intro-video";
import { REGISTRY_FAMILIES } from "@/lib/crawl-rules-meta";
import { FLAGS } from "@/lib/flags";
import type { DashLocale, SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import { capabilityBody, visibleCapabilities, type CopyBase } from "@/lib/site-crawler/marketing-copy";
import type { CrawlQuotaDto } from "@/lib/site-crawler/types";

export const HELP_TABS = ["checks", "reading", "config", "plan"] as const;
export type HelpTab = (typeof HELP_TABS)[number];

/** The marketing copy is en / fr; de-CH reads the English cards (as the public page does). */
const copyBase = (l: DashLocale): CopyBase => (l === "fr" ? "fr" : "en");

/** The cards the public page shows, gated the same way. */
export function helpCapabilities() {
  return visibleCapabilities({ families: REGISTRY_FAMILIES, flags: FLAGS });
}

export default function CrawlerHelpModal({
  t,
  locale,
  quota,
  guideHref,
  allGuidesHref,
  onClose,
}: {
  t: SiteCrawlerCopy;
  locale: DashLocale;
  quota: CrawlQuotaDto | null;
  /** The full /learn guide (locale-prefixed). */
  guideHref: string;
  /** The crawler guides' section of the guides index (locale-prefixed). */
  allGuidesHref: string;
  onClose: () => void;
}) {
  const h = t.helpModal;
  const [tab, setTab] = useState<HelpTab>("checks");
  const int = new Intl.NumberFormat(locale === "de-CH" ? "de-CH" : locale);
  const base = copyBase(locale);
  const caps = helpCapabilities();
  const label: Record<HelpTab, string> = { checks: h.tabChecks, reading: h.tabReading, config: h.tabConfig, plan: h.tabPlan };
  const n = (v: number | null | undefined) => (v === null ? h.unlimited : int.format(v ?? 0));
  const plan: [string, string][] = quota
    ? [
        [h.plan.urls, n(quota.urlCap)],
        [h.plan.crawls, n(quota.monthlyLimit)],
        [h.plan.rendered, n(quota.renderCap)],
        [h.plan.extractors, n(quota.extractorCap)],
        [h.plan.schedules, n(quota.scheduleCap)],
        [h.plan.kept, n(quota.crawlsKept)],
        [h.plan.ai, n(quota.aiPageCap)],
        [h.plan.psi, n(quota.psiCap)],
        [h.plan.backlinks, n(quota.backlinkCap)],
      ]
    : [];

  return (
    <Modal open onClose={onClose} title={h.title} closeLabel={h.close} className="max-w-3xl">
      <div className="space-y-4">
        {/* The modal's title names the brand; the 28 px logo here is decorative, the byline text. */}
        <div className="flex items-center gap-3" data-testid="crawler-help-brand">
          <NosyBatLogo height={28} alt="" />
          <span className="text-xs text-gray-500">{t.byline}</span>
        </div>
        <div role="tablist" aria-label={h.title} className="flex flex-wrap gap-1 border-b border-gray-200">
          {HELP_TABS.map((id) => (
            <button
              key={id}
              id={`crawler-help-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`crawler-help-panel-${id}`}
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? "-mb-px border-b-2 border-blue-600 px-3 py-2 text-sm font-medium text-blue-700"
                  : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              }
            >
              {label[id]}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`crawler-help-panel-${tab}`} aria-labelledby={`crawler-help-tab-${tab}`} className="text-sm text-gray-700">
          {tab === "checks" && (
            <>
              <p className="mb-3 text-gray-600">{h.checksIntro(int.format(caps.length))}</p>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="crawler-help-capabilities">
                {caps.map((c) => (
                  <li key={c.id} data-cap={c.id} className="rounded-lg border border-gray-100 p-3">
                    <p className="font-medium text-gray-900">{c.title[base]}</p>
                    <p className="mt-1 text-gray-600">{capabilityBody(c, base)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {tab === "reading" && (
            <dl className="space-y-3">
              {h.reading.map((r) => (
                <div key={r.term}>
                  <dt className="font-medium text-gray-900">{r.term}</dt>
                  <dd className="text-gray-600">{r.text}</dd>
                </div>
              ))}
            </dl>
          )}
          {tab === "config" && (
            <>
              <dl className="space-y-2">
                {h.config.map((r) => (
                  <div key={r.term}>
                    <dt className="font-medium text-gray-900">{r.term}</dt>
                    <dd className="text-gray-600">{r.text}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="font-medium text-blue-900">{h.verifiedTitle}</p>
                <p className="mt-1 text-blue-800">{h.verifiedText}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-blue-800">
                  {h.verifiedWays.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
          {tab === "plan" && (
            <>
              <p className="mb-3 text-gray-600">{h.planIntro}</p>
              <table className="w-full text-left">
                <tbody>
                  {plan.map(([k, v]) => (
                    <tr key={k} className="border-t border-gray-100">
                      <th scope="row" className="py-2 pr-3 font-normal text-gray-600">
                        {k}
                      </th>
                      <td className="py-2 text-right font-medium tabular-nums text-gray-900">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-3">
          <a href={guideHref} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
            {h.guide}
          </a>
          <a href={allGuidesHref} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline" data-testid="help-all-guides">
            {h.allGuides}
          </a>
          <a href={`/${locale}/site-crawler#${NB_INTRO_ANCHOR}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline" data-testid="help-watch-intro">
            {h.watchIntro}
          </a>
          <Button type="button" variant="outline" onClick={onClose}>
            {h.close}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
