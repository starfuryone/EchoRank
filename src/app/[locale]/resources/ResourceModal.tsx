"use client";

/**
 * The download modal behind every card on /resources.
 *
 * Rendered through a portal on document.body so the page's sticky nav and the
 * section stacking contexts cannot clip it or fight it for z-index.
 *
 * A card is always a real <a href> underneath (see ResourceGrid). This modal is
 * progressive enhancement: with JS off, every card is still a working link, so
 * the hrefs stay in the SSR HTML and crawlable.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HomeContent } from "@/lib/i18n/content";
import { EbookLeadForm } from "./EbookLeadForm";
import f from "./resources.module.css";

/** gated = email first · pdf = direct download · guide = navigate */
export type ResourceKind = "gated" | "pdf" | "guide";

export interface Resource {
  label: string;
  desc: string;
  /** "PDF · 34 pages" — authored per resource, so it lives with the page copy. */
  meta: string;
  href: string;
  kind: ResourceKind;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ResourceModal({
  resource,
  locale,
  labels,
  onClose,
}: {
  resource: Resource;
  locale: string;
  labels: HomeContent["resourceModal"];
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Gated resources start behind the form; everything else is immediately
  // actionable. "unlocked" is only ever set by the placeholder form.
  const [unlocked, setUnlocked] = useState(resource.kind !== "gated");

  // Esc anywhere, plus a Tab loop kept inside the panel.
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    // Lock the page behind the modal. Restoring the previous value rather than
    // clearing it avoids stomping anything else that set overflow.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus in on open; ResourceGrid puts it back on the card on close.
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [onKeyDown]);

  const isDownload = resource.kind === "pdf" || resource.kind === "gated";

  return createPortal(
    <div
      className={f.backdrop}
      // Backdrop click only — a click that started inside the panel and drifted
      // out must not close it, hence the target check.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={f.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button type="button" className={f.closeBtn} onClick={onClose} aria-label={labels.close}>
          ✕
        </button>

        <h2 className={f.title} id={titleId}>
          {resource.label}
        </h2>
        <p className={f.desc}>{resource.desc}</p>
        <p className={f.meta}>{resource.meta}</p>

        {resource.kind === "gated" && !unlocked ? (
          <EbookLeadForm
            locale={locale}
            labels={labels}
            onDone={() => setUnlocked(true)}
          />
        ) : (
          <>
            {resource.kind === "gated" && <p className={f.desc}>{labels.ready}</p>}
            <a
              className={f.primaryBtn}
              href={resource.href}
              {...(isDownload ? { download: "" } : {})}
            >
              {isDownload ? labels.downloadPdf : labels.openGuide}
            </a>
          </>
        )}

        <a className={f.directLink} href={resource.href}>
          {labels.openDirectly}
        </a>
      </div>
    </div>,
    document.body,
  );
}
