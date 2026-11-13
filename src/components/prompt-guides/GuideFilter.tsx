"use client";

// The hub's filterable card grid. Filters on title + description + eyebrow,
// as the package did, with a live count and an empty state. It receives plain
// props from the server page — never the config module itself, which would put
// ~50 KB of prompt copy in the browser bundle.

import { useState } from "react";
import Link from "next/link";
import type { IconShape } from "@/lib/prompt-guides";
import { GuideIcon } from "./GuideIcon";
import pg from "./prompt-guides.module.css";

export interface FilterCard {
  slug: string;
  href: string;
  name: string;
  description: string;
  eyebrow: string;
  icon: readonly IconShape[];
}

export interface FilterCopy {
  filterLabel: string;
  placeholder: string;
  empty: string;
  read: string;
  one: string;
  many: string;
}

/** Exported for the test: the same predicate the input drives. */
export function matchesQuery(card: Pick<FilterCard, "name" | "description" | "eyebrow">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${card.name} ${card.description} ${card.eyebrow}`.toLowerCase().includes(q);
}

export function GuideFilter({ cards, copy }: { cards: readonly FilterCard[]; copy: FilterCopy }) {
  const [query, setQuery] = useState("");
  const visible = cards.filter((c) => matchesQuery(c, query));
  const total = cards.length;
  return (
    <div>
      <div className={pg.sectionHead}>
        <div className={pg.filter}>
          <label htmlFor="prompt-guide-filter">{copy.filterLabel}</label>
          <input
            id="prompt-guide-filter"
            type="search"
            value={query}
            placeholder={copy.placeholder}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className={pg.count} aria-live="polite" data-testid="guide-count">
          {visible.length} {visible.length === 1 ? copy.one : copy.many}
        </p>
      </div>
      {visible.length > 0 ? (
        <div className={pg.cards}>
          {visible.map((c) => {
            const n = cards.indexOf(c) + 1;
            return (
              <Link key={c.slug} href={c.href} className={pg.card} data-guide={c.slug}>
                <span className={pg.cardNum}>{`${String(n).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}</span>
                <span className={pg.cardIcon}>
                  <GuideIcon shapes={c.icon} />
                </span>
                <h3 className={pg.cardTitle}>{c.name}</h3>
                <p className={pg.cardBody}>{c.description}</p>
                <span className={pg.cardMore}>
                  {copy.read} <span aria-hidden="true">→</span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className={pg.empty} role="status">
          {copy.empty}
        </p>
      )}
    </div>
  );
}
