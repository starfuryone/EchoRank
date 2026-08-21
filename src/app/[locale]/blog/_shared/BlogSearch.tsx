"use client";

// Client-side filtering over the generated index. No API route, no backend.
//
// THE SERVER GRID IS PASSED AS `children` AND RENDERED UNCHANGED while the box
// is empty. That is the whole design: the index page's cards are server-rendered
// markup a crawler sees, and this component only takes over the slot once a
// visitor has typed something. Rendering the grid from the index client-side
// would have shipped an empty <div> to every crawler that reads /blog.
//
// It imports the copy catalog directly rather than receiving strings as props —
// copy.ts pulls in nothing but types, so it costs a few KB and keeps the
// pluralization rules next to the sentences they belong to.

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { BlogBase, BlogSearchEntry } from "@/lib/blog/constants";
import { blogArticlePath } from "@/lib/blog/constants";
import { BLOG_CHROME, categoryLabel } from "./copy";
import s from "./blog.module.css";

/**
 * Fold accents and case so "visibilite" matches "visibilité".
 *
 * The French catalog is real French, so a reader typing on a keyboard without
 * dead keys would otherwise get nothing back from their own language's articles.
 */
const fold = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Every token must appear somewhere in the entry — AND, not OR.
 *
 * "geo metrics" should narrow to the articles about both, not widen to
 * everything mentioning either. With a few dozen articles that is the behaviour
 * people expect from a box labelled "search".
 */
function matches(entry: BlogSearchEntry, tokens: string[]): boolean {
  const hay = fold(
    [entry.title, entry.excerpt, entry.category, ...entry.tags].join(" "),
  );
  return tokens.every((t) => hay.includes(t));
}

export function BlogSearch({
  entries,
  locale,
  base,
  tabs,
  children,
}: {
  entries: BlogSearchEntry[];
  locale: string;
  base: BlogBase;
  /**
   * The category tabs, rendered between the box and the results and NEVER
   * replaced. They are the way out of a search that found nothing, so hiding
   * them alongside the grid would strand a reader on an empty page.
   */
  tabs: ReactNode;
  /** The server-rendered featured card and grid, shown while the box is empty. */
  children: ReactNode;
}) {
  const t = BLOG_CHROME[base];
  const [query, setQuery] = useState("");

  const tokens = useMemo(
    () => fold(query).split(/\s+/).filter(Boolean),
    [query],
  );
  const results = useMemo(
    () => (tokens.length ? entries.filter((e) => matches(e, tokens)) : null),
    [entries, tokens],
  );

  return (
    <>
      <div className={s.searchWrap}>
        <input
          type="search"
          className={s.searchInput}
          placeholder={t.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Labelled rather than wrapped in a <label>: the placeholder is the
          // visible affordance and a duplicate visible label above a search box
          // in a hero reads as chrome.
          aria-label={t.searchPlaceholder}
        />
      </div>
      {/* Announced politely so a screen-reader user hears the count change
          without the box stealing focus on every keystroke. */}
      <p className={s.searchCount} role="status" aria-live="polite">
        {results ? t.searchCount(results.length) : ""}
      </p>

      {tabs}

      {results === null ? (
        children
      ) : results.length === 0 ? (
        <p className={s.empty}>{t.searchNone}</p>
      ) : (
        <div className={s.grid}>
          {results.map((e) => (
            <Link key={e.slug} className={s.card} href={`/${locale}${blogArticlePath(e.slug)}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={s.cardImg}
                src={e.image}
                alt={e.imageAlt}
                width={1400}
                height={600}
                loading="lazy"
                decoding="async"
              />
              <span className={s.cardBody}>
                <span className={s.chip}>{categoryLabel(e.category, base)}</span>
                <span className={s.cardTitle}>{e.title}</span>
                <span className={s.cardExcerpt}>{e.excerpt}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
