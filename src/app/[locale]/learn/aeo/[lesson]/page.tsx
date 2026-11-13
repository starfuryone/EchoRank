// /[locale]/learn/aeo/[lesson] — one lesson of the Echorank AEO course.
//
// ONE ROUTE, TWELVE LESSONS, all from src/lib/aeo-course.ts. Layout: the course
// sidebar (modules → lessons, completion ticks), the lesson, and "On this
// page". Every lesson closes the same way: key takeaways → practice task →
// knowledge check → one tool card → prev/next. The last lesson adds the
// worksheet and the sales CTA. "worksheet" and "all" are static siblings, so
// Next never routes them here; an unknown slug 404s.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/lib/seo/JsonLd";
import {
  AEO_BASE,
  AEO_COPY,
  AEO_LESSONS,
  AEO_MODULES,
  AEO_PLAN,
  AEO_WORKSHEET,
  aeoLessonBySlug,
  aeoLessonNumber,
  aeoLessonPath,
  aeoModule,
  aeoNeighbours,
  aeoToc,
  lessonMinutes,
  lessonsInModule,
} from "@/lib/aeo-course";
import { LEARN_BASE } from "@/lib/learn-content";
import { PublicNav } from "../../../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { CourseSidebar, MarkComplete, ProgressRing, RecordVisit } from "@/components/aeo-course/Progress";
import { Quiz } from "@/components/aeo-course/Quiz";
import { AEO_CHROME, LessonBlocks, SalesCta, ToolCard, baseOf } from "@/components/aeo-course/LessonParts";
import { aeoLessonGraph } from "../_shared/graph";
import { ChapterVideo } from "../../_shared/ChapterVideo";
import home from "../../../home2.module.css";
import css from "@/components/aeo-course/aeo.module.css";

/** locale × lesson — 5 × 12 = 60 static pages. */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) => AEO_LESSONS.map((l) => ({ locale, lesson: l.slug })));
}

type Params = Promise<{ locale: string; lesson: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, lesson } = await params;
  if (!isSupportedLocale(locale)) return {};
  const l = aeoLessonBySlug(lesson);
  if (!l) return {};
  return buildMetadata({
    locale,
    path: aeoLessonPath(l.slug),
    title: `${l.title} · AEO course`,
    description: l.metaDescription,
    ogType: "article",
    canonicalLocale: "en",
  });
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function AeoLessonPage({ params }: { params: Params }) {
  const { locale, lesson: slug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const lesson = aeoLessonBySlug(slug);
  if (!lesson) notFound();

  const L = (p: string) => `/${locale}${p}`;
  const t = AEO_CHROME[baseOf(locale)];
  const C = AEO_COPY;
  const n = aeoLessonNumber(lesson);
  const mod = aeoModule(lesson.module)!;
  const { prev, next } = aeoNeighbours(lesson.slug);
  const section = AEO_PLAN.find((s) => s.section === lesson.practice.section)!;
  const isLast = n === AEO_LESSONS.length;
  const marks = { mark: C.markComplete, done: C.completed, undo: C.markIncomplete };

  return (
    <div className={`${home.page} ${css.root}`}>
      <PublicNav locale={locale} current="learn" />
      <JsonLd graph={aeoLessonGraph(lesson, locale)} />
      <RecordVisit slug={lesson.slug} />
      <main className={css.wrap} style={{ paddingTop: 32 }}>
        <nav className={css.crumbs} aria-label="Breadcrumb">
          <Link href={L("")}>{t.home}</Link>
          <span aria-hidden="true">/</span>
          <Link href={L(LEARN_BASE)}>{t.learn}</Link>
          <span aria-hidden="true">/</span>
          <Link href={L(AEO_BASE)}>{C.hubCrumb}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{C.lessonN(n)}</span>
        </nav>

        <div className={css.layout}>
          <aside className={css.sidebar} aria-label={C.contents}>
            <ProgressRing slugs={AEO_LESSONS.map((l) => l.slug)} size={44} label={C.progress} />
            <CourseSidebar
              title={C.contents}
              current={lesson.slug}
              modules={AEO_MODULES.map((m) => ({
                n: m.n,
                label: `${C.moduleN(m.n)} · ${m.title}`,
                lessons: lessonsInModule(m.n).map((l) => ({ slug: l.slug, n: AEO_LESSONS.indexOf(l) + 1, title: l.title, href: L(aeoLessonPath(l.slug)) })),
              }))}
            />
          </aside>

          <article className={css.article}>
            <p className={css.eyebrow}>
              {C.moduleN(mod.n)} · {mod.title} · {C.lessonN(n)}
            </p>
            <h1 className={css.lessonH1}>{lesson.title}</h1>
            <p className={css.lead}>{lesson.summary}</p>
            <div className={css.meta}>
              <span>{C.minutes(lessonMinutes(lesson))}</span>
              <MarkComplete slug={lesson.slug} labels={marks} />
            </div>
            {t.notice && <p className={css.notice}>{t.notice}</p>}
            <section className={css.objectives} aria-labelledby="objectives">
              <h2 id="objectives">{C.objectives}</h2>
              <ul>
                {lesson.objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </section>

            {/* The lesson's own video, before the reading starts: it walks
                through the whole lesson. Every locale gets it, because every
                locale gets the English body. Hidden in print (.noPrint). */}
            {lesson.video && (
              <ChapterVideo
                video={lesson.video}
                preload="metadata"
                className={`${css.figure} ${css.noPrint}`}
                caption={C.videoCaption(Math.round(lesson.video.durationSeconds / 60), lesson.video.covers)}
              />
            )}

            <LessonBlocks body={lesson.body} locale={locale} />

            <div className={css.closing}>
              <h2 id="takeaways">{C.takeaways}</h2>
              <ul className={css.takeaways}>
                {lesson.takeaways.map((k) => (
                  <li key={k}>
                    <Check />
                    {k}
                  </li>
                ))}
              </ul>

              <h2 id="practice">{C.practice}</h2>
              <div className={css.practice}>
                <p>{C.practiceSection(section.title)}</p>
                <ol>
                  {lesson.practice.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <Link href={`${L(AEO_WORKSHEET)}#sheet-${section.section}`}>{t.worksheet} →</Link>
              </div>

              <h2 id="check">{C.check}</h2>
              <p className={css.quizIntro}>{C.checkIntro}</p>
              <Quiz slug={lesson.slug} questions={lesson.quiz} copy={{ correct: C.correct, incorrect: C.incorrect }} />

              <ToolCard tool={lesson.tool} locale={locale} />

              <div className={css.complete}>
                <MarkComplete slug={lesson.slug} labels={marks} />
              </div>

              {isLast && (
                <>
                  <div className={css.actions}>
                    <Link className={`${home.btn} ${home.btnPrimary}`} href={L(AEO_WORKSHEET)}>
                      {C.worksheetCta}
                    </Link>
                  </div>
                  <SalesCta locale={locale} />
                </>
              )}

              <nav className={css.pager} aria-label={C.contents}>
                {prev ? (
                  <Link href={L(aeoLessonPath(prev.slug))}>
                    <span>← {C.prev}</span>
                    {prev.title}
                  </Link>
                ) : (
                  <Link href={L(AEO_BASE)}>
                    <span>←</span>
                    {C.hubCrumb}
                  </Link>
                )}
                {next ? (
                  <Link href={L(aeoLessonPath(next.slug))} className={css.pagerNext}>
                    <span>{C.next} →</span>
                    {next.title}
                  </Link>
                ) : (
                  <Link href={L(AEO_WORKSHEET)} className={css.pagerNext}>
                    <span>→</span>
                    {C.worksheet.title}
                  </Link>
                )}
              </nav>
            </div>
          </article>

          <nav className={css.toc} aria-label={C.onThisPage}>
            <p>{C.onThisPage}</p>
            <ul>
              {aeoToc(lesson).map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`}>{h.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
