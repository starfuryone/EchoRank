// Renders a LearnBlock[] — the whole article body, one shell for chapters and
// guides alike, so the fifteen articles cannot drift apart in structure.

import type { LearnBlock, LearnFaqEntry } from "@/lib/learn-content";
import { headingId } from "@/lib/learn-content";
import { inline } from "./inline";
import type { ReactNode } from "react";
import b from "./learn.module.css";

export interface BlocksProps {
  body: readonly LearnBlock[];
  locale: string;
  /** Rendered where the prose carries a {k:"video"} marker. */
  video?: ReactNode;
  /** Rendered where the prose carries a {k:"faq"} marker. */
  faq?: readonly LearnFaqEntry[];
}

export function Blocks({ body, locale, video, faq }: BlocksProps) {
  return (
    <>
      {body.map((block, i) => {
        const key = `b${i}`;

        switch (block.k) {
          case "h2":
            // id from the heading text, matching tableOfContents() — the TOC
            // links and these anchors are the same pure function, so they
            // cannot fall out of step.
            return (
              <h2 key={key} id={headingId(block.t)} className={b.h2}>
                {block.t}
              </h2>
            );

          case "h3":
            return (
              <h3 key={key} id={headingId(block.t)} className={b.h3}>
                {block.t}
              </h3>
            );

          case "p":
            return (
              <p key={key} className={b.para}>
                {inline(block.t, locale, key)}
              </p>
            );

          case "ul":
            return (
              <ul key={key} className={b.list}>
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{inline(item, locale, `${key}-${j}`)}</li>
                ))}
              </ul>
            );

          case "ol":
            return (
              <ol key={key} className={b.list}>
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{inline(item, locale, `${key}-${j}`)}</li>
                ))}
              </ol>
            );

          case "quote":
            return (
              <blockquote key={key} className={b.quote}>
                {block.paras.map((p, j) => (
                  <p key={`${key}-${j}`}>{inline(p, locale, `${key}-${j}`)}</p>
                ))}
              </blockquote>
            );

          case "code":
            // Scrolls inside its own box. A CSV header row is wider than the
            // column and must not widen the page.
            return (
              <pre key={key} className={b.code}>
                <code>{block.t}</code>
              </pre>
            );

          case "table":
            return (
              <div key={key} className={b.tableWrap}>
                <table className={b.table}>
                  <thead>
                    <tr>
                      {block.head.map((h, j) => (
                        <th key={`${key}-h${j}`} scope="col">
                          {inline(h, locale, `${key}-h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={`${key}-r${j}`}>
                        {row.map((cell, c) => (
                          <td key={`${key}-r${j}-${c}`}>
                            {inline(cell, locale, `${key}-r${j}-${c}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "video":
            return video ? (
              <div key={key} className={b.videoBlock}>
                {video}
              </div>
            ) : null;

          case "faq":
            // The FAQPage JSON-LD is built from this same array by the page —
            // markup describing questions that are not on screen is a
            // structured-data violation, so there is only ever one array.
            return faq ? (
              <dl key={key} className={b.faq}>
                {faq.map((entry, j) => (
                  <div key={`${key}-${j}`} className={b.faqItem}>
                    <dt className={b.faqQ}>{entry.q}</dt>
                    <dd className={b.faqA}>{inline(entry.a, locale, `${key}-a${j}`)}</dd>
                  </div>
                ))}
              </dl>
            ) : null;
        }
      })}
    </>
  );
}
