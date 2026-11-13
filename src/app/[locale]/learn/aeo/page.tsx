// /[locale]/learn/aeo — the Echorank AEO course hub.
//
// A static segment beside /learn/[chapter]: Next matches "aeo" here before the
// dynamic chapter route, and tests/aeo-course-pages.test.ts asserts that no
// chapter slug is "aeo". Everything on the page reads src/lib/aeo-course.ts.
// Client pieces: the lesson filter, the progress ring and the resume link.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/lib/seo/JsonLd";
import {
  AEO_ALL,
  AEO_BASE,
  AEO_COPY,
  AEO_COURSE,
  AEO_LESSONS,
  AEO_MODULES,
  AEO_WORKSHEET,
  MRCA_STAGES,
  aeoLessonPath,
  courseMinutes,
  glanceRows,
  lessonMinutes,
  lessonsInModule,
} from "@/lib/aeo-course";
import { LEARN_BASE } from "@/lib/learn-content";
import { PublicNav } from "../../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { MrcaLoop } from "@/components/aeo-course/graphics-m5";
import { HubLessons } from "@/components/aeo-course/HubLessons";
import { ProgressRing, ResumeLink } from "@/components/aeo-course/Progress";
import { AEO_CHROME, SalesCta, baseOf } from "@/components/aeo-course/LessonParts";
import { aeoHubGraph } from "./_shared/graph";
import home from "../../home2.module.css";
import css from "@/components/aeo-course/aeo.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: AEO_BASE,
    title: AEO_COURSE.name,
    description: AEO_COURSE.metaDescription,
    canonicalLocale: "en",
  });
}

export default async function AeoHub({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const L = (p: string) => `/${locale}${p}`;
  const t = AEO_CHROME[baseOf(locale)];
  const C = AEO_COPY;
  const slugs = AEO_LESSONS.map((l) => l.slug);

  return (
    <div className={`${home.page} ${css.root}`}>
      <PublicNav locale={locale} current="learn" />
      <JsonLd graph={aeoHubGraph(locale)} />
      <main>
        <section className={css.hero}>
          <div className={css.wrap}>
            <nav className={css.crumbs} aria-label="Breadcrumb">
              <Link href={L("")}>{t.home}</Link>
              <span aria-hidden="true">/</span>
              <Link href={L(LEARN_BASE)}>{t.learn}</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{C.hubCrumb}</span>
            </nav>
            <div className={css.heroGrid}>
              <div>
                <p className={css.eyebrow}>{C.heroEyebrow}</p>
                <h1 className={home.h1}>{C.heroH1}</h1>
                <p className={css.lead}>{C.heroLead}</p>
                <div className={css.actions}>
                  <ResumeLink
                    lessons={AEO_LESSONS.map((l) => ({ slug: l.slug, title: l.title, href: L(aeoLessonPath(l.slug)) }))}
                    startLabel={C.start}
                    startHref={L(aeoLessonPath(AEO_LESSONS[0].slug))}
                    resumePrefix="Resume:"
                    className={`${home.btn} ${home.btnPrimary}`}
                  />
                  <Link className={`${home.btn} ${home.btnGhost}`} href={L(AEO_WORKSHEET)}>
                    {C.worksheetCta}
                  </Link>
                </div>
                <div className={css.actions}>
                  <ProgressRing slugs={slugs} label={C.progress} />
                  <span className={css.ringLabel}>
                    {AEO_LESSONS.length} lessons · {courseMinutes()} min · free ·{" "}
                    <Link href={L(AEO_ALL)} style={{ color: "var(--goldText)" }}>
                      {C.printAll}
                    </Link>
                  </span>
                </div>
                {t.notice && <p className={css.notice}>{t.notice}</p>}
              </div>
              <MrcaLoop />
            </div>
          </div>
        </section>

        <section className={css.section} id="lessons">
          <div className={css.wrap}>
            <p className={home.label}>
              <b>/ 01</b> — LESSONS
            </p>
            <h2 className={home.h2}>{C.modulesH2}</h2>
            <HubLessons
              modules={AEO_MODULES.map((m) => ({
                n: m.n,
                label: C.moduleN(m.n),
                title: m.title,
                blurb: m.blurb,
                lessons: lessonsInModule(m.n).map((l) => ({
                  slug: l.slug,
                  n: AEO_LESSONS.indexOf(l) + 1,
                  href: L(aeoLessonPath(l.slug)),
                  title: l.title,
                  summary: l.summary,
                  keywords: l.objectives.join(" "),
                  minutes: C.minutes(lessonMinutes(l)),
                })),
              }))}
              copy={{
                label: C.filterLabel,
                placeholder: C.filterPlaceholder,
                empty: C.filterEmpty,
                one: C.lessonOne,
                many: C.lessonMany,
                completed: C.completed,
                lesson: "LESSON",
              }}
            />
          </div>
        </section>

        <section className={css.section} id="mrca">
          <div className={css.wrap}>
            <p className={home.label}>
              <b>/ 02</b> — MRCA
            </p>
            <h2 className={home.h2}>{C.mrcaH2}</h2>
            <p className={css.p}>{C.mrcaBody}</p>
            <div className={css.tableWrap}>
              <table className={css.table}>
                <caption>The four MRCA stages</caption>
                <thead>
                  <tr>
                    <th scope="col">Stage</th>
                    <th scope="col">Passes when</th>
                  </tr>
                </thead>
                <tbody>
                  {MRCA_STAGES.map((s) => (
                    <tr key={s.key}>
                      <th scope="row">
                        {s.key} · {s.name}
                      </th>
                      <td>{s.line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={css.section} id="at-a-glance">
          <div className={css.wrap}>
            <p className={home.label}>
              <b>/ 03</b> — {C.glanceH2}
            </p>
            <h2 className={home.h2}>{C.glanceH2}</h2>
            <div className={css.tableWrap}>
              <table className={`${css.table} ${css.wideTable}`} data-testid="aeo-glance">
                <caption>{C.glanceCaption}</caption>
                <thead>
                  <tr>
                    {C.glanceHead.map((h, i) => (
                      <th key={h} scope="col" className={i === 3 ? css.num : undefined}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {glanceRows().map((r) => (
                    <tr key={r.slug}>
                      <th scope="row">
                        <Link href={L(aeoLessonPath(r.slug))}>
                          {r.n}. {r.title}
                        </Link>
                      </th>
                      <td>{r.learn}</td>
                      <td>{r.produce}</td>
                      <td className={css.num}>{r.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className={css.wrap}>
          <SalesCta locale={locale} />
        </div>
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
