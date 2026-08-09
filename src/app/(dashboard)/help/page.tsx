// In-app Help hub — /help.
//
// The retention half of the knowledge base. Same articles as the public
// /[locale]/learn hub, indexed for someone who is already inside the product
// and stuck on a specific screen.
//
// GATING: requireTenant only. Help is NEVER plan-gated — not by tier, not by
// billing status. No tier is confined to a subset of the dashboard any more,
// so there is no allowlist for /help to be exempted from either.
//
// NO NEW SIDEBAR ROW. The ruled nine-row sidebar stands; this page is reached
// from the per-page Help buttons, which now carry a "Browse all help" link.
//
// Card structure and styling mirror the Reputation Tools hub (/reputation) so
// the two in-app hubs read as one pattern rather than two designs.

import Link from "next/link";
import { cookies } from "next/headers";
import { BookOpen, ExternalLink } from "lucide-react";
import { dashboardLocale, HELP_COPY } from "@/lib/i18n/dashboard";
import { requireTenant } from "@/lib/tenant";
import { HELP_GROUPS, HELP_VIDEO, learnHref, type HelpCard } from "@/lib/help-content";
import {
  ECHOPEDIA_DESCRIPTION,
  ECHOPEDIA_TITLE,
  LEARN_BASE,
  chapterBySlug,
  guideBySlug,
} from "@/lib/learn-content";
import { HelpVideoCard } from "./HelpVideoCard";

/** Title, description and reading time for a card — derived, never restated. */
function resolve(card: HelpCard, copy: (typeof HELP_COPY)["en"], locale: string) {
  switch (card.kind) {
    case "chapter": {
      const ch = chapterBySlug(card.slug!)!;
      return {
        name: ch.title,
        description: ch.description,
        href: learnHref(locale, `${LEARN_BASE}/${ch.slug}`),
        minutes: ch.readingTime,
        newTab: true,
      };
    }
    case "guide": {
      const g = guideBySlug(card.slug!)!;
      return {
        name: g.title,
        description: g.blurb,
        href: learnHref(locale, `${LEARN_BASE}/guides/${g.slug}`),
        minutes: g.readingTime,
        newTab: true,
      };
    }
    case "glossary":
      return {
        name: copy.cards.echopedia.name,
        description: ECHOPEDIA_DESCRIPTION || ECHOPEDIA_TITLE,
        href: learnHref(locale, `${LEARN_BASE}/${card.slug}`),
        newTab: true,
      };
    case "app":
      return {
        name: copy.cards[card.id].name,
        description: copy.cards[card.id].description,
        href: card.href!,
        newTab: false,
      };
    default:
      return {
        name: copy.cards[card.id].name,
        description: copy.cards[card.id].description,
        href: card.href!,
        newTab: true,
      };
  }
}

export default async function HelpHubPage() {
  // Membership, not plan: every tier reaches this page.
  await requireTenant();

  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const copy = HELP_COPY[locale];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {copy.hubTitle}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">{copy.hubSubtitle}</p>
      </div>

      {HELP_GROUPS.map((group, gi) => (
        <section
          key={group.id}
          aria-labelledby={`help-group-${group.id}`}
          className={gi > 0 ? "border-t border-gray-200 pt-8" : undefined}
        >
          <h3
            id={`help-group-${group.id}`}
            className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400"
          >
            {copy.groups[group.id]}
          </h3>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {group.cards.map((card) => {
              // The one card that does not navigate: the install walkthrough
              // opens in place, because a reader is following along with it.
              if (card.kind === "video") {
                const g = guideBySlug(card.slug!)!;
                return HELP_VIDEO ? (
                  <li key={card.id}>
                    <HelpVideoCard
                      title={g.title}
                      description={g.blurb}
                      badge={copy.videoBadge}
                      closeLabel={copy.closeLabel}
                      locale={locale}
                      video={HELP_VIDEO}
                      articleHref={learnHref(locale, `${LEARN_BASE}/guides/${g.slug}`)}
                      articleLabel={copy.readFullGuide}
                    />
                  </li>
                ) : null;
              }

              const item = resolve(card, copy, locale);
              const Icon = card.kind === "external" ? ExternalLink : BookOpen;

              const body = (
                <>
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      {item.minutes ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          {copy.minRead(item.minutes)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      {item.description}
                    </p>
                  </div>
                </>
              );

              const className =
                "flex h-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm";

              return (
                <li key={card.id}>
                  {item.newTab ? (
                    // New tab, so nobody loses the screen they were working on.
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={className}
                      aria-label={`${item.name} (${copy.newTab})`}
                    >
                      {body}
                    </a>
                  ) : (
                    <Link href={item.href} className={className}>
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
