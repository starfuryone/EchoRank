"use client";

// The knowledge check: three questions, each a native radio group inside a
// fieldset, so it is keyboard operable (Tab into the group, arrows between
// options) with a visible focus ring. Picking an option shows right or wrong
// and the one-line explanation in a polite live region. Nothing is stored or
// sent; the questions live only in the config.

import { useState } from "react";
import type { AeoQuestion } from "@/lib/aeo-course";
import css from "./aeo.module.css";

export interface QuizCopy {
  correct: string;
  incorrect: string;
}

function Question({ q, n, name, copy }: { q: AeoQuestion; n: number; name: string; copy: QuizCopy }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const right = picked === q.correct;
  return (
    <fieldset className={css.q}>
      <legend>
        {n}. {q.q}
      </legend>
      <div className={css.opts}>
        {q.options.map((o, i) => {
          const state = !answered ? "" : i === q.correct ? css.optRight : i === picked ? css.optWrong : "";
          return (
            <label key={o} className={state ? `${css.opt} ${state}` : css.opt}>
              <input type="radio" name={name} value={i} checked={picked === i} onChange={() => setPicked(i)} />
              <span>{o}</span>
            </label>
          );
        })}
      </div>
      <p className={`${css.feedback} ${answered ? (right ? css.fbRight : css.fbWrong) : ""}`} aria-live="polite">
        {answered && (
          <>
            <b>{right ? copy.correct : copy.incorrect}</b>
            {q.explain}
          </>
        )}
      </p>
    </fieldset>
  );
}

export function Quiz({ slug, questions, copy }: { slug: string; questions: AeoQuestion[]; copy: QuizCopy }) {
  return (
    <div className={css.quiz}>
      {questions.map((q, i) => (
        <Question key={q.q} q={q} n={i + 1} name={`${slug}-q${i}`} copy={copy} />
      ))}
    </div>
  );
}
