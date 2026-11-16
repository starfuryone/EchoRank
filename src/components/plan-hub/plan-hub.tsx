// The "Your plan" hub (/plan, PLAN-HUB Part 2). PRESENTATIONAL: the page
// loads; this renders. That is what lets a test render every plan and every
// billing state without a database.
//
// Top to bottom: welcome banner (verified checkout only) → plan & billing →
// included in your plan → get started → help & resources → account
// essentials → more with another plan (collapsed; not on Agency/Enterprise).
// Dashboard components (Card, Button) and the dashboard's Tailwind look; the
// dashboard is light-only (globals.css), so there is no dark variant.

import Link from "next/link";
import { Check, ExternalLink, Lock, Mail } from "lucide-react";
import type { PlanType } from "@/generated/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashLocale } from "@/lib/i18n/dashboard";
import { AI_HUB_COPY, ONBOARDING_COPY, REPUTATION_COPY, SEO_TOOLS_COPY, dashNav } from "@/lib/i18n/dashboard";
import type { PlanHubCopy } from "@/lib/i18n/plan-hub";
import { HUB_GROUPS, type LimitKey, type PlanResources, type PlanResourceItem } from "@/lib/plan-resources";
import type { MeterUsage } from "@/lib/plan-usage";
import type { OnboardingStep } from "@/lib/onboarding";
import { formatPeriodDate, type PlanCardState } from "@/lib/billing/plan-card-state";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { pricingBase, usd, usdCents } from "@/lib/pricing-page/format";
import { guideBySlug, guideCopy } from "@/lib/learn-content";
import { helpArticleBySlug, helpArticleCopy, helpArticleHref } from "@/lib/help-articles";
import { AEO_BASE } from "@/lib/aeo-course-routes";
import { PROMPT_GUIDES_BASE } from "@/lib/prompt-guide-routes";
import { PlanBillingActions } from "./plan-billing-actions";
import { PlanWelcomeBanner } from "./plan-welcome-banner";

export const SUPPORT_EMAIL = "support@echorank360.com";
const CANCEL_SLUG = "cancel-subscription";
/** The trial-ending notice goes out 24 h before the trial converts (src/lib/billing/trial-notice.ts). */
const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;

export interface PlanHubProps {
  locale: DashLocale;
  t: PlanHubCopy;
  plan: PlanType;
  resources: PlanResources;
  usage: Partial<Record<LimitKey, MeterUsage>>;
  billing: {
    state: PlanCardState;
    /** ISO: trial end, renewal, or the day access ends. */
    periodEnd: string | null;
    /** The subscription's own charge; null → the date alone. */
    charge: { cents: number; interval: "month" | "year" } | null;
    hasPortal: boolean;
  };
  canManage: boolean;
  ownerName: string | null;
  /** ?welcome=1 after a verified, paid checkout. */
  welcome: boolean;
  steps: OnboardingStep[];
  enterpriseEmail: string | null;
}

function itemCopy(locale: DashLocale, item: PlanResourceItem): { name: string; description: string } {
  if (item.source === "seo") return SEO_TOOLS_COPY[locale].items[item.id as keyof (typeof SEO_TOOLS_COPY)["en"]["items"]];
  if (item.source === "ai") return AI_HUB_COPY[locale].items[item.id as keyof (typeof AI_HUB_COPY)["en"]["items"]];
  if (item.source === "reputation") return REPUTATION_COPY[locale].items[item.id as keyof (typeof REPUTATION_COPY)["en"]["items"]];
  return { name: dashNav[locale][item.href] ?? item.href, description: "" };
}

/**
 * The authored help copy's two inline marks: **bold** and [label](/path). A
 * site path is locale-prefixed (the public help articles live under
 * /{locale}/help/...) and opens in a new tab, like the other help links here.
 */
function Rich({ text, locale }: { text: string; locale: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
        if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          const href = link[2]!.startsWith("/") ? `/${locale}${link[2]}` : link[2]!;
          return (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">
              {link[1]}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-semibold text-gray-900">
      {children}
    </h2>
  );
}

export function PlanHub(p: PlanHubProps) {
  const { t, locale, resources } = p;
  const planName = PLAN_CONFIGS[p.plan].name;
  const fmt = (n: number) => n.toLocaleString(locale);
  const date = p.billing.periodEnd ? formatPeriodDate(p.billing.periodEnd, locale) : null;

  // ── Plan & billing ────────────────────────────────────────────────────────
  let statusLine: string | null = null;
  if (p.billing.state === "trial" && date) statusLine = t.statusTrial(date);
  else if (p.billing.state === "renewing" && date) statusLine = t.statusRenewing(date);
  else if (p.billing.state === "cancelling" && date) statusLine = t.statusCancelling(date);
  else if (p.billing.state === "past_due") statusLine = t.statusPastDue;
  else if (p.billing.state === "ended") statusLine = t.statusEnded;

  const base = pricingBase(locale);
  const amount = p.billing.charge
    ? p.billing.charge.interval === "year"
      ? t.perYear(usdCents(p.billing.charge.cents / 100, base))
      : t.perMonth(usd(p.billing.charge.cents / 100, base))
    : null;

  const cancelArticle = helpArticleBySlug(CANCEL_SLUG);
  const cancelFaq = cancelArticle ? helpArticleCopy(cancelArticle, locale).faq.a : null;

  const trialEnd = p.billing.state === "trial" && p.billing.periodEnd ? new Date(p.billing.periodEnd) : null;

  // ── Included ──────────────────────────────────────────────────────────────
  const limitsByItem = new Map<string, PlanResources["limits"]>();
  for (const l of resources.limits) limitsByItem.set(l.itemKey, [...(limitsByItem.get(l.itemKey) ?? []), l]);

  const meterLine = (l: PlanResources["limits"][number]) => {
    const unit = t.meter[l.key];
    const u = p.usage[l.key];
    const limit = u?.limitOverride !== undefined && u.limitOverride !== null ? u.limitOverride : l.limit;
    if (limit === "custom") return t.custom(unit);
    if (limit === "unlimited") return u?.used != null ? t.limitOnly(fmt(u.used), unit) : t.unlimited(unit);
    if (u?.used != null) return t.used(fmt(u.used), fmt(limit), unit);
    return t.limitOnly(fmt(limit), unit);
  };

  const groupsOf = (items: PlanResourceItem[]) =>
    HUB_GROUPS.map((g) => ({ g, items: items.filter((i) => i.group === g) })).filter((x) => x.items.length > 0);

  const done = p.steps.filter((s) => s.done).length;
  const stepLabels = ONBOARDING_COPY[locale].steps;

  return (
    <div className="space-y-8" data-testid="plan-hub" data-plan={p.plan}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
      </div>

      {p.welcome && <PlanWelcomeBanner text={t.welcome(planName)} dismiss={t.dismiss} />}

      {/* ── Plan & billing ── */}
      <section aria-labelledby="plan-billing">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <h2 id="plan-billing" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t.billingTitle}
              </h2>
              <p className="mt-1 text-xl font-semibold text-gray-900" data-testid="plan-name">
                {t.planLine(planName)}
              </p>
              {amount && (
                <p className="text-sm text-gray-700" data-testid="plan-amount">
                  {amount}
                </p>
              )}
              {statusLine && (
                <p className="mt-1 text-sm text-gray-700" data-testid="plan-status">
                  {statusLine}
                </p>
              )}
            </div>

            {trialEnd && (
              <ol className="grid gap-2 border-t border-gray-100 pt-4 text-sm text-gray-700 sm:grid-cols-3" aria-label={t.timelineTitle} data-testid="plan-timeline">
                <li className="rounded-lg bg-gray-50 px-3 py-2">
                  <span className="block font-medium text-gray-900">{t.timelineToday}</span>
                  {t.timelineTrialStarts}
                </li>
                <li className="rounded-lg bg-gray-50 px-3 py-2">{t.timelineReminder(formatPeriodDate(new Date(trialEnd.getTime() - REMINDER_LEAD_MS), locale))}</li>
                <li className="rounded-lg bg-gray-50 px-3 py-2">{t.timelineCharge(formatPeriodDate(trialEnd, locale))}</li>
              </ol>
            )}

            <div className="border-t border-gray-100 pt-4">
              <PlanBillingActions locale={locale} state={p.billing.state} canManage={p.canManage} ownerName={p.ownerName} hasPortal={p.billing.hasPortal} />
            </div>
            {cancelFaq && (
              <p className="text-xs leading-relaxed text-gray-500" data-testid="plan-cancel-anytime">
                <Rich text={cancelFaq} locale={locale} />
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Included in your plan ── */}
      <section aria-labelledby="plan-included" className="space-y-4">
        <SectionTitle id="plan-included">{t.includedTitle}</SectionTitle>
        {groupsOf(resources.included).map(({ g, items }) => (
          <div key={g}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.groups[g]}</h3>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const c = itemCopy(locale, item);
                const description = item.source === "nav" ? (t.nav[item.href] ?? "") : c.description;
                const usable = item.status === "available";
                return (
                  <li key={item.key} data-item={item.key} data-status={item.status} className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                          {item.status === "coming" && <Badge variant="warning">{t.comingSoon}</Badge>}
                          {item.status === "waiting_approval" && <Badge variant="warning">{t.waitingGoogle}</Badge>}
                          {/* A partner card's name already says "by EchoPilot". */}
                        </div>
                        {description && <p className="mt-1 text-xs leading-snug text-gray-500">{description}</p>}
                        {(limitsByItem.get(item.key) ?? []).map((l) => (
                          <p key={l.key} className="mt-2 text-xs font-medium text-gray-700" data-meter={l.key}>
                            {meterLine(l)}
                          </p>
                        ))}
                      </div>
                    </div>
                    {usable && (
                      <div className="mt-3 pt-1">
                        <Link href={item.href} className="text-sm font-medium text-blue-600 hover:text-blue-700" data-open={item.key}>
                          {t.open} →
                        </Link>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {p.enterpriseEmail && resources.limits.some((l) => l.limit === "custom") && (
          <p className="text-sm text-gray-600" data-testid="plan-enterprise-contact">
            {t.enterpriseContact(p.enterpriseEmail)}
          </p>
        )}
      </section>

      {/* ── Get started ── */}
      {p.steps.length > 0 && (
        <section aria-labelledby="plan-start">
          <SectionTitle id="plan-start">{t.startTitle}</SectionTitle>
          <p className="mt-1 text-sm text-gray-500">{ONBOARDING_COPY[locale].progress(done, p.steps.length)}</p>
          <ol className="mt-3 space-y-2" data-testid="plan-steps">
            {p.steps.map((s) => (
              <li key={s.key} data-step={s.key} data-done={s.done ? "true" : "false"}>
                <Link href={s.href} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm hover:bg-gray-50">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${s.done ? "border-green-600 bg-green-600 text-white" : "border-gray-300"}`}
                    aria-hidden="true"
                  >
                    {s.done && <Check className="h-3 w-3" />}
                  </span>
                  <span className={s.done ? "text-gray-500 line-through" : "text-gray-900"}>{stepLabels[s.key] ?? s.key}</span>
                  {s.done && <span className="sr-only">{t.stepDone}</span>}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Help & resources ── */}
      <section aria-labelledby="plan-help" className="space-y-3">
        <SectionTitle id="plan-help">{t.helpTitle}</SectionTitle>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li>
            <Link href="/help" className="font-medium text-blue-600 hover:text-blue-700">
              {t.helpHub}
            </Link>
          </li>
          {cancelArticle && (
            <li>
              <a href={helpArticleHref(locale, CANCEL_SLUG)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700">
                {t.howToCancel}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </li>
          )}
          {/* The address as text, selectable: the repo keeps no support@
              mailto links (tests/sales-links.test.ts). */}
          <li className="inline-flex items-center gap-1 text-gray-700" data-testid="plan-support">
            <Mail className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            {t.support}: <span className="select-all font-medium">{SUPPORT_EMAIL}</span>
          </li>
        </ul>
        {resources.help.length > 0 && (
          <div>
            <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.guidesTitle}</h3>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="plan-guides">
              {resources.help.map((h) => {
                let href: string;
                let label: string;
                if (h.kind === "aeo") {
                  href = `/${locale}${AEO_BASE}`;
                  label = t.aeoCourse;
                } else if (h.kind === "prompt-guides") {
                  href = `/${locale}${PROMPT_GUIDES_BASE}`;
                  label = t.promptGuides;
                } else {
                  const g = guideBySlug(h.slug!);
                  if (!g) return null;
                  href = `/${locale}/learn/${g.slug}`;
                  label = guideCopy(g, locale.startsWith("fr") ? "fr" : "en", locale).title;
                }
                return (
                  <li key={href}>
                    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700" data-guide={h.slug ?? h.kind}>
                      {label}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* ── Account essentials ── */}
      <section aria-labelledby="plan-account" className="space-y-3">
        <SectionTitle id="plan-account">{t.accountTitle}</SectionTitle>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="plan-account">
          {resources.account.map((a) => (
            <li key={a.key} data-account={a.key}>
              <Link href={a.href} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 hover:bg-gray-50">
                {t.account[a.key]}
                {a.key === "invite" && <span className="text-xs text-gray-500">· {t.account.inviteNote}</span>}
                {a.key === "gsc" && a.status !== "available" && <Badge variant="warning">{a.status === "waiting_approval" ? t.waitingGoogle : t.comingSoon}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── More with another plan ── */}
      {resources.showMore && (
        <section aria-labelledby="plan-more">
          <details className="rounded-xl border border-gray-200 bg-white" data-testid="plan-more">
            <summary id="plan-more" className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
              {t.moreTitle}
            </summary>
            <div className="space-y-4 border-t border-gray-100 px-4 py-4">
              <p className="text-sm text-gray-500">{t.moreLead}</p>
              {groupsOf(resources.locked).map(({ g, items }) => (
                <div key={g}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.groups[g]}</h3>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((item) => {
                      const c = itemCopy(locale, item);
                      const target = "upgradeTo" in item ? (item as { upgradeTo: PlanType }).upgradeTo : null;
                      return (
                        <li key={item.key} data-locked={item.key} data-upgrade-to={target ?? undefined}>
                          <Link href="/billing#plans" className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
                            <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                            <span className="min-w-0 flex-1">{c.name}</span>
                            {target && <span className="shrink-0 text-xs font-medium text-gray-500">{t.includedIn(PLAN_CONFIGS[target].name)}</span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <Link href="/billing#plans" className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
                {t.seePlans} →
              </Link>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
