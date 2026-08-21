// One shell for every Knowledge Hub article — the ten course chapters and the
// five ultimate guides. Chapters add prev/next; nothing else differs.
//
// LOCALE MODEL: en/fr bases, exactly like GuideArticle and /resources. en-CA
// folds to en, fr-CA to fr, and de-CH shows English chrome per the house
// convention — a third catalog here would be unreachable code. The article
// BODY is English in every locale in this pass (see learn-content.ts), which is
// why these pages canonical to their en URL.
//
// The one genuinely five-locale string on the page is the video player's
// caption, which comes from CONTENT[locale].player and has real de-CH copy.
//
// Server component. The table of contents is sticky in CSS, not JavaScript.

import Link from "next/link";
import { PublicNav } from "../../PublicNav";
import { HomeVideo } from "../../HomeVideo";
import { CONTENT, HOME_TOOLS } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/config";
import {
  chapterVideoOf,
  inlineVideoOf,
  tableOfContents,
  type LearnBlock,
  type LearnCta,
  type LearnFaqEntry,
  type LearnLink,
  type LearnVideo,
} from "@/lib/learn-content";
import { Blocks } from "./Blocks";
import { ChapterVideo } from "./ChapterVideo";
import { resolveHref } from "./inline";
import s from "../../home2.module.css";
import c from "./learn.module.css";

export type Base = "en" | "fr";
export const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

const CHROME = {
  en: {
    hub: "Knowledge Hub",
    course: "Learn Reputation & AI Visibility",
    toc: "On this page",
    minRead: (n: number) => `${n} min read`,
    related: "Keep going",
    prev: "Previous",
    next: "Next",
    ctaAudit: {
      h: "See where you stand — free",
      p: "Run the Echorank audit on your own site. No account and no card: you get a score, itemized checks, and a PDF worth keeping as your day-zero baseline.",
      btn: "Run the free audit →",
    },
    ctaRegister: {
      h: "Put this into practice",
      p: "Import your review history, ask every customer in one tap, and watch the themes — and the AI mentions — move.",
      btn: "Start free trial ↗",
    },
  },
  fr: {
    hub: "Centre de connaissances",
    course: "Réputation et visibilité IA",
    toc: "Sur cette page",
    minRead: (n: number) => `${n} min de lecture`,
    related: "Pour aller plus loin",
    prev: "Précédent",
    next: "Suivant",
    ctaAudit: {
      h: "Faites le point — gratuitement",
      p: "Lancez l'audit Echorank sur votre propre site. Sans compte et sans carte : vous obtenez un score, des vérifications détaillées et un PDF à conserver comme point de départ.",
      btn: "Lancer l'audit gratuit →",
    },
    ctaRegister: {
      h: "Passez à la pratique",
      p: "Importez votre historique d'avis, sollicitez chaque client en un geste, et voyez évoluer les thèmes — et les mentions par les IA.",
      btn: "Essai gratuit ↗",
    },
  },
} as const;

/** English body in every locale, so the article is only ever authored once. */
const ENGLISH_BODY_NOTICE = {
  en: null,
  fr: "Cet article n'est pour l'instant disponible qu'en anglais. La traduction est en cours — le reste du site est en français.",
} as const;

export interface ArticleShellProps {
  locale: string;
  /** "CHAPTER 03" / "GUIDE" — already composed by the caller. */
  eyebrow: string;
  /**
   * This article's BODY is written in the reader's language.
   *
   * Suppresses the English-only notice below, which would otherwise tell a
   * French reader their French article is in English. Knowledge Hub articles
   * leave it false — their prose really is English under every locale.
   */
  localizedBody?: boolean;
  title: string;
  description: string;
  readingTime: number;
  body: readonly LearnBlock[];
  video?: LearnVideo;
  faq?: readonly LearnFaqEntry[];
  /**
   * Closing CTA block. OPTIONAL, and omitted on purpose by the help article
   * about cancelling: that page promises "no retention hoops", and closing it
   * with a Start-free-trial pitch would be one. Every Knowledge Hub article
   * still passes one.
   */
  cta?: LearnCta;
  related: readonly LearnLink[];
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}

export function ArticleShell({
  locale,
  eyebrow,
  localizedBody = false,
  title,
  description,
  readingTime,
  body,
  video,
  faq,
  cta,
  related,
  prev,
  next,
}: ArticleShellProps) {
  const b = baseOf(locale);
  const t = CHROME[b];
  const foot = CONTENT[locale as Locale].footer;
  // The player's five-locale catalog, including real de-CH copy. Reused rather
  // than restated so the "tap the speaker icon to unmute" caption is worded
  // identically here and on the homepage.
  const player = HOME_TOOLS[locale as Locale].player;
  const L = (p: string) => `/${locale}${p.startsWith("/") ? p : `/${p}`}`;
  const toc = tableOfContents(body);
  const ctaCopy = cta && (cta === "audit" ? t.ctaAudit : t.ctaRegister);
  const notice = localizedBody ? null : ENGLISH_BODY_NOTICE[b];
  // One field, two placements — narrowed here so the JSX below never inspects
  // the discriminant itself. A chapter video goes to the fixed slot after the
  // intro; a prose-placed one goes to its marker, through HomeVideo.
  const chapterVideo = chapterVideoOf({ video });
  const inlineVideo = inlineVideoOf({ video });

  return (
    <div className={s.page}>
      <PublicNav locale={locale} current="learn" />

      <section className={s.section}>
        <div className={s.container}>
          <nav className={c.crumbs} aria-label="Breadcrumb">
            <Link href={L("/learn")}>{t.hub}</Link>
            <span aria-hidden="true">/</span>
            <span>{title}</span>
          </nav>

          <div className={c.articleLayout}>
            <article className={c.article}>
              <p className={s.label}>
                <b>/ {eyebrow}</b> — {t.minRead(readingTime)}
              </p>
              <h1 className={c.articleH1}>{title}</h1>
              <p className={c.articleLede}>{description}</p>

              {notice && <p className={c.langNotice}>{notice}</p>}

              <Blocks
                body={body}
                locale={locale}
                faq={faq}
                // A chapter's own video, in a fixed structural position: after
                // the intro prose, before the first section heading.
                afterIntro={chapterVideo ? <ChapterVideo video={chapterVideo} /> : undefined}
                video={
                  inlineVideo ? (
                    // The mp4 is Caddy-served from /opt/echorank/extension-dist,
                    // outside this repo — referenced absolutely, never copied
                    // into public/videos/. Same player as the homepage: muted by
                    // default, arrow overlay, mute chip, caption in every locale.
                    <HomeVideo
                      className={c.video}
                      src={inlineVideo.src}
                      poster={inlineVideo.poster}
                      ariaLabel={inlineVideo.title}
                      labels={player}
                    />
                  ) : undefined
                }
              />

              {ctaCopy && (
                <aside className={c.cta}>
                  <h2 className={c.ctaH}>{ctaCopy.h}</h2>
                  <p className={c.ctaP}>{ctaCopy.p}</p>
                  {cta === "audit" ? (
                    <Link className={`${s.btn} ${s.btnPrimary}`} href={L("/free-audit")}>
                      {ctaCopy.btn}
                    </Link>
                  ) : (
                    <Link className={`${s.btn} ${s.btnPrimary}`} href="/register">
                      {ctaCopy.btn}
                    </Link>
                  )}
                </aside>
              )}

              {related.length > 0 && (
                <section className={c.related}>
                  <h2 className={c.relatedH}>{t.related}</h2>
                  <ul className={c.relatedList}>
                    {related.map((r) =>
                      r.internal ? (
                        <li key={r.href}>
                          <Link href={resolveHref(r.href, locale)}>{r.label}</Link>
                        </li>
                      ) : (
                        <li key={r.href}>
                          <a href={r.href}>{r.label}</a>
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              )}

              {(prev || next) && (
                <nav className={c.pager} aria-label={t.course}>
                  {prev ? (
                    <Link className={c.pagerLink} href={prev.href}>
                      <span className={c.pagerDir}>← {t.prev}</span>
                      <span className={c.pagerTitle}>{prev.label}</span>
                    </Link>
                  ) : (
                    <span />
                  )}
                  {next && (
                    <Link className={`${c.pagerLink} ${c.pagerNext}`} href={next.href}>
                      <span className={c.pagerDir}>{t.next} →</span>
                      <span className={c.pagerTitle}>{next.label}</span>
                    </Link>
                  )}
                </nav>
              )}
            </article>

            {toc.length > 0 && (
              <nav className={c.toc} aria-label={t.toc}>
                <p className={c.tocH}>{t.toc}</p>
                <ul className={c.tocList}>
                  {toc.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`}>{h.text}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <div className={s.footin}>
            <span>{foot.copyright}</span>
            <span>
              {foot.links.map((l) => (
                <Link key={l.label} href={L(l.href)} style={{ marginLeft: 14 }}>
                  {l.label}
                </Link>
              ))}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
