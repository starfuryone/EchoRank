// Homepage section: the SEO Tools hub, shown to logged-out visitors.
//
// WHY THIS IS A SERVER COMPONENT: it renders straight from SEO_TOOL_GROUPS —
// the same typed config the real hub at /visibility/tools renders. The hub is
// paid-gated behind login, so this page is the only public view of it, and the
// one failure mode that matters is marketing drifting out of sync with the
// product. Deriving the grid means adding a tool to the config puts it here
// automatically, and removing one removes it here.
//
// NOTHING IS HAND-DUPLICATED:
//   the tool list, groups and order  -> src/lib/seo-tools.ts
//   names + one-line benefits        -> SEO_TOOLS_COPY in src/lib/i18n/dashboard.ts
//   LIVE / COMING SOON               -> the `comingSoon` flag, which
//                                       seo-tools.test.ts asserts against the
//                                       actual route files
//   section chrome + featured copy   -> HOME_TOOLS in src/lib/i18n/content.ts
//
// The dashboard catalog carries three locales (en / fr / de-CH) which cover all
// five marketing locales through the documented fold, so no tool copy needed
// re-translating for this page.
//
// CARDS ARE NOT LINKS. Every /visibility/tools/* route is behind the paid gate,
// so linking a logged-out visitor to one lands them on a login screen having
// learned nothing. The section carries a single CTA to /register instead.

import Link from "next/link";
import { HomeVideo } from "./HomeVideo";
import { SEO_TOOL_GROUPS } from "@/lib/seo-tools";
import { SEO_TOOLS_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { HOME_TOOLS } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/config";
import s from "./home2.module.css";

/** Marketing locale -> dashboard catalog locale. Mirrors dashboardLocale(). */
function toDashLocale(locale: Locale): DashLocale {
  if (locale.startsWith("fr")) return "fr";
  if (locale.startsWith("de")) return "de-CH";
  return "en";
}

export function ClassicSeoTools({
  locale,
  sectionNumber,
}: {
  locale: Locale;
  /** Rendered as "/ NN" so the section sits in the page's running order. */
  sectionNumber: string;
}) {
  const t = HOME_TOOLS[locale];
  const copy = SEO_TOOLS_COPY[toDashLocale(locale)];

  const all = SEO_TOOL_GROUPS.flatMap((g) => g.tools);
  const liveCount = all.filter((tool) => !tool.comingSoon).length;
  const soonCount = all.length - liveCount;

  return (
    <section id="tools" className={s.section}>
      <div className={s.container}>
        <p className={s.label}>
          <b>/ {sectionNumber}</b> — {t.label}
        </p>
        <h2 className={s.h2}>{t.h2}</h2>
        <p className={s.sub}>{t.sub}</p>
        <p className={s.toolsCount}>{t.count(liveCount, soonCount)}</p>

        {/* Featured row — the four that are hardest to infer from a name —
            paired with the overview video. The label sits ABOVE the split
            rather than inside the left column, which is what actually makes
            the video top-align with the first row of cards instead of with
            the label. All five locales carry exactly four cards, so the 2x2
            never leaves a ragged last row. */}
        <p className={s.toolsFeaturedLabel}>{t.featuredLabel}</p>
        <div className={s.toolsFeaturedRow}>
          <div className={s.toolsFeatured}>
            {t.featured.map((f) => (
              <div className={s.toolsFeatureCard} key={f.k}>
                <div className={s.toolsFeatureTag}>{f.k}</div>
                <h3 className={s.toolsFeatureH}>{f.h}</h3>
                <p className={s.toolsFeatureP}>{f.p}</p>
              </div>
            ))}
          </div>
          {/* Click to play, not hover. Hover-play started this 57s narrated
              overview for a mouse that was only passing through. Starts muted
              with a caption saying so, and the chip turns sound on in one
              click. See HomeVideo.tsx.
              No autoplay and preload="none": it weighs 34 MB and must stay
              off the initial page load.
              Second in the DOM, so the mobile single-column stack puts it
              after the cards without needing an order override. */}
          <HomeVideo
            wrapClassName={s.toolsVideoWrap}
            className={s.foundVideo}
            src="/videos/echorank-classic-seo-tools-overview.mp4"
            poster="/videos/echorank-classic-seo-tools-overview-poster.jpg"
            ariaLabel={t.videoLabel}
            labels={t.player}
          />
        </div>

        {/* The full grid, group by group, in hub order. */}
        {SEO_TOOL_GROUPS.map((group) => (
          <div className={s.toolsGroup} key={group.id}>
            <h3 className={s.toolsGroupName}>{copy.groups[group.id]}</h3>
            <div className={s.toolsGrid}>
              {group.tools.map((tool) => {
                const item = copy.items[tool.id];
                const soon = tool.comingSoon === true;
                return (
                  <div className={s.toolCard} key={tool.id}>
                    <div className={s.toolCardHead}>
                      <tool.icon className={s.toolIcon} />
                      <span className={s.toolName}>{item.name}</span>
                      <span className={soon ? s.toolBadgeSoon : s.toolBadgeLive}>
                        {soon ? t.badgeSoon : t.badgeLive}
                      </span>
                    </div>
                    <p className={s.toolDesc}>{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <p className={s.toolsIncluded}>{t.included}</p>
        <Link className={`${s.btn} ${s.btnPrimary}`} href="/register">
          {t.cta}
        </Link>
      </div>
    </section>
  );
}
