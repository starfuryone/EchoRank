"use client";

/**
 * The resource cards, progressively enhanced.
 *
 * Every card is a real <a href> pointing at the PDF or page. With JavaScript
 * the click is intercepted and opens the modal instead; without it, the link
 * works exactly as it did before this change. That is what keeps the hrefs in
 * the SSR HTML and the link-integrity check passing.
 *
 * Modifier-clicks and middle-clicks are left alone, so "open in new tab" still
 * behaves like a link rather than silently opening a dialog.
 */

import { useRef, useState } from "react";
import type { HomeContent } from "@/lib/i18n/content";
import { ResourceModal, type Resource } from "./ResourceModal";
import s from "../home2.module.css";
import f from "./resources.module.css";

export interface ResourceGroup {
  h: string;
  items: Resource[];
}

export function ResourceGrid({
  groups,
  locale,
  labels,
}: {
  groups: ResourceGroup[];
  locale: string;
  labels: HomeContent["resourceModal"];
}) {
  const [open, setOpen] = useState<Resource | null>(null);
  /** The card that opened the modal, so focus can go back to it on close. */
  const triggerRef = useRef<HTMLAnchorElement | null>(null);

  function close() {
    setOpen(null);
    triggerRef.current?.focus();
    triggerRef.current = null;
  }

  return (
    <>
      {groups.map((g) => (
        <div className={s.toolsGroup} key={g.h}>
          <h2 className={s.toolsGroupName}>{g.h}</h2>
          <div className={s.toolsGrid}>
            {g.items.map((it) => (
              <div className={s.toolCard} key={it.href + it.label}>
                <a
                  className={`${s.toolName} ${f.cardLink}`}
                  href={it.href}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    triggerRef.current = e.currentTarget;
                    setOpen(it);
                  }}
                >
                  {it.label}
                </a>
                <p className={s.toolDesc}>{it.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {open && (
        <ResourceModal resource={open} locale={locale} labels={labels} onClose={close} />
      )}
    </>
  );
}
