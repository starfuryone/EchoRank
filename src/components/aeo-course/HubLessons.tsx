"use client";

// The hub's module cards and lesson filter. Filters on lesson title, summary
// and objectives; shows a live count, an empty state and completion ticks.
// Receives plain props — never the config module, which would put the whole
// course's copy in the browser bundle.

import { useState } from "react";
import Link from "next/link";
import { LessonTick } from "./Progress";
import css from "./aeo.module.css";

export interface HubLesson {
  slug: string;
  n: number;
  href: string;
  title: string;
  summary: string;
  /** Searched, not shown. */
  keywords: string;
  minutes: string;
}

export interface HubModule {
  n: number;
  label: string;
  title: string;
  blurb: string;
  lessons: HubLesson[];
}

export function lessonMatches(l: Pick<HubLesson, "title" | "summary" | "keywords">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${l.title} ${l.summary} ${l.keywords}`.toLowerCase().includes(q);
}

export function HubLessons({
  modules,
  copy,
}: {
  modules: HubModule[];
  /** Plain strings only: these props cross the server/client boundary. */
  copy: { label: string; placeholder: string; empty: string; one: string; many: string; completed: string; lesson: string };
}) {
  const [query, setQuery] = useState("");
  const shown = modules.map((m) => ({ ...m, lessons: m.lessons.filter((l) => lessonMatches(l, query)) })).filter((m) => m.lessons.length > 0);
  const count = shown.reduce((n, m) => n + m.lessons.length, 0);
  return (
    <div>
      <div className={css.filter}>
        <label htmlFor="aeo-lesson-filter">{copy.label}</label>
        <input id="aeo-lesson-filter" type="search" value={query} placeholder={copy.placeholder} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
        <p className={css.count} aria-live="polite" data-testid="aeo-lesson-count">
          {count} {count === 1 ? copy.one : copy.many}
        </p>
      </div>
      {count === 0 && (
        <p className={css.empty} role="status">
          {copy.empty}
        </p>
      )}
      {shown.map((m) => (
        <section key={m.n} className={css.module} aria-labelledby={`aeo-module-${m.n}`}>
          <div className={css.moduleHead}>
            <span>{m.label}</span>
            <h3 id={`aeo-module-${m.n}`}>{m.title}</h3>
            <p>{m.blurb}</p>
          </div>
          <div className={css.cards}>
            {m.lessons.map((l) => (
              <Link key={l.slug} href={l.href} className={css.card} data-lesson={l.slug}>
                <span className={css.cardTop}>
                  <span>
                    {copy.lesson} {String(l.n).padStart(2, "0")} · {l.minutes}
                  </span>
                  <LessonTick slug={l.slug} label={copy.completed} />
                </span>
                <span className={css.cardTitle}>{l.title}</span>
                <span className={css.cardBody}>{l.summary}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
