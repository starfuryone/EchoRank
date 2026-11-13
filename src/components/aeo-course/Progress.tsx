"use client";

// Lesson progress, in this browser only (store.ts): the "Mark complete"
// button, the animated progress ring, the sidebar with completion ticks,
// "Resume where you left off" and the visit recorder. Each renders the empty
// state on the server and fills in once the stored state is read.

import { useEffect } from "react";
import Link from "next/link";
import { progressStore, recordVisit, setLessonDone, useStore } from "./store";
import css from "./aeo.module.css";

export function MarkComplete({ slug, labels }: { slug: string; labels: { mark: string; done: string; undo: string } }) {
  const p = useStore(progressStore);
  const done = p.done.includes(slug);
  return (
    <button
      type="button"
      className={done ? `${css.ghost} ${css.done}` : css.ghost}
      aria-pressed={done}
      onClick={() => setLessonDone(slug, !done)}
      title={done ? labels.undo : undefined}
    >
      {done ? `✓ ${labels.done}` : labels.mark}
    </button>
  );
}

/** Counts only slugs that are real lessons, so a stale key cannot push it past 100%. */
export function ProgressRing({ slugs, size = 56, label }: { slugs: string[]; size?: number; /** "{done} of {total} …": a template, since functions cannot cross to the client. */ label: string }) {
  const p = useStore(progressStore);
  const done = slugs.filter((s) => p.done.includes(s)).length;
  const total = slugs.length;
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const text = label.replace("{done}", String(done)).replace("{total}", String(total));
  return (
    <div className={css.ring} role="img" aria-label={text}>
      <svg className={css.ringSvg} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle cx={size / 2} cy={size / 2} r={r} className={css.ringTrack} strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={css.ringBar}
          strokeWidth={6}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (total ? done / total : 0))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x={size / 2} y={size / 2 + 5} fontSize={size / 4} className={css.ringNum} textAnchor="middle">
          {done}
        </text>
      </svg>
      <span className={css.ringLabel}>{text}</span>
    </div>
  );
}

/** Remembers the lesson being read, for the hub's resume link. Renders nothing. */
export function RecordVisit({ slug }: { slug: string }) {
  useEffect(() => {
    recordVisit(slug);
  }, [slug]);
  return null;
}

export interface SideLesson {
  slug: string;
  n: number;
  title: string;
  href: string;
}

export function CourseSidebar({
  modules,
  current,
  title,
}: {
  modules: { n: number; label: string; lessons: SideLesson[] }[];
  current?: string;
  title: string;
}) {
  const p = useStore(progressStore);
  return (
    <details className={css.sideDetails} open>
      <summary>{title}</summary>
      {modules.map((m) => (
        <div key={m.n} className={css.sideModule}>
          <p>{m.label}</p>
          <ul className={css.sideList}>
            {m.lessons.map((l) => {
              const done = p.done.includes(l.slug);
              return (
                <li key={l.slug}>
                  <Link href={l.href} aria-current={l.slug === current ? "page" : undefined}>
                    <span className={done ? `${css.sideMark} ${css.sideMarkDone}` : css.sideMark} aria-hidden="true">
                      {done ? "✓" : ""}
                    </span>
                    <span>
                      {l.n}. {l.title}
                      {done && <span className={css.srOnly}> (completed)</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </details>
  );
}

/** "Resume where you left off" once a lesson has been visited; "Start lesson 1" until then. */
export function ResumeLink({
  lessons,
  startLabel,
  startHref,
  resumePrefix,
  className,
}: {
  lessons: { slug: string; title: string; href: string }[];
  startLabel: string;
  startHref: string;
  resumePrefix: string;
  className: string;
}) {
  const p = useStore(progressStore);
  const last = lessons.find((l) => l.slug === p.last);
  return last ? (
    <Link className={className} href={last.href} data-testid="aeo-resume">
      {resumePrefix} {last.title}
    </Link>
  ) : (
    <Link className={className} href={startHref} data-testid="aeo-start">
      {startLabel}
    </Link>
  );
}

/** A completion tick for a lesson card. */
export function LessonTick({ slug, label }: { slug: string; label: string }) {
  const p = useStore(progressStore);
  return p.done.includes(slug) ? <span className={css.tick}>✓ {label}</span> : null;
}
