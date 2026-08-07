"use client";

// src/app/[locale]/LegalDocModal.tsx
//
// One dialog for all four consent documents. Clicking a different document name
// swaps the body in place rather than opening a second dialog.
//
// LAZY. The bodies are dynamic imports (see _content/registry.ts), so the
// pricing bundle does not carry five legal documents for a modal most visitors
// never open. The first open shows a loading line while its chunk arrives;
// documents already fetched are cached in a ref, so re-opening is instant and a
// second network trip never happens.
//
// SAME TEXT AS THE ROUTE. The body comes from the same builder the
// /legal/... page renders, through the shared LegalBody component — no iframe,
// no second copy.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConsentDocumentId } from "@/lib/consent-config";
import { CONSENT_DOCUMENTS } from "@/lib/consent-config";
import { CONSENT_COPY } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/config";
import { loadLegalDoc } from "./legal/_content/registry";
import { LegalBody, type LegalDoc } from "./legal/_content/types";
import s from "./home2.module.css";

export function LegalDocModal({
  locale,
  docId,
  onClose,
  onSwitch,
}: {
  locale: Locale;
  docId: ConsentDocumentId;
  onClose: () => void;
  /** Switching documents keeps one dialog open and swaps its body. */
  onSwitch: (next: ConsentDocumentId) => void;
}) {
  const t = CONSENT_COPY[locale];
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  /** Documents already fetched, so switching back is instant. */
  const cache = useRef(new Map<string, LegalDoc>());

  useEffect(() => {
    let cancelled = false;
    const key = `${docId}:${locale}`;
    const cached = cache.current.get(key);
    if (cached) {
      setDoc(cached);
      return;
    }
    setDoc(null);
    loadLegalDoc(docId, locale).then((d) => {
      if (cancelled) return;
      cache.current.set(key, d);
      setDoc(d);
    });
    return () => {
      cancelled = true;
    };
  }, [docId, locale]);

  // A swapped document starts at the top; keeping the previous scroll offset
  // drops the reader into the middle of a document they have not seen.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [docId, doc]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Focus trap: cycle Tab within the dialog so a keyboard user cannot land
      // on the pricing cards behind an open modal.
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
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
    const prevOverflow = document.body.style.overflow;
    const restore = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      restore?.focus?.();
    };
  }, [handleKeyDown]);

  const title = doc?.title ?? t[CONSENT_DOCUMENTS.find((d) => d.id === docId)!.labelKey];

  return (
    <div
      className={s.legalOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={s.legalDialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className={s.legalHead}>
          <p className={s.legalTitle}>{title}</p>
          <button type="button" className={s.legalClose} onClick={onClose} aria-label={t.modalClose}>
            ×
          </button>
        </div>

        {/* Switch row: the other documents, so a reader can move between them
            without closing and re-opening. Built from config, like the gate. */}
        <div className={s.legalTabs}>
          {CONSENT_DOCUMENTS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={d.id === docId ? s.legalTabOn : s.legalTab}
              aria-current={d.id === docId ? "true" : undefined}
              onClick={() => onSwitch(d.id)}
            >
              {t[d.labelKey]}
            </button>
          ))}
        </div>

        <div className={s.legalBody} ref={bodyRef}>
          {doc ? (
            <>
              <p className={s.legalUpdated}>{doc.updated}</p>
              <LegalBody doc={doc} headingClassName={s.legalH2} paragraphClassName={s.legalP} />
            </>
          ) : (
            <p className={s.legalP}>…</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default LegalDocModal;
