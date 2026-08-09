"use client";

// src/app/[locale]/ConsentGate.tsx
//
// The checkout consent gate: one checkbox spanning the pricing grid, plus the
// "agreement required" modal a plan CTA opens when it is unchecked.
//
// THE DOCUMENT LIST IS NEVER WRITTEN IN JSX. Both the page sentence and the
// modal's are the SAME component (ConsentRow) mapping CONSENT_DOCUMENTS, so
// adding a document to src/lib/consent-config.ts adds a link in both places and
// to what the server requires, in one edit. A hardcoded sentence would drift
// from the server's validation the first time that list changed, and the
// failure would be a checkout rejected for a document the user was never shown.
//
// THE MODAL CARRIES THE CHECKBOX, not a pointer back to the page's. Sending the
// visitor out of the dialog to tick a box further down the page and click their
// plan a second time is three actions for one decision, and the plan choice is
// the one most easily lost on the way. The two checkboxes are one state, owned
// by PricingSection — checking either checks both, because they are the same
// `accepted` prop.
//
// THE PLAN CTAs ARE NOT DISABLED when consent is missing. A disabled button
// explains nothing — the visitor sees a dead control and no reason. Letting the
// click through and answering with a modal that names the documents is what
// tells them what to do. The modal's OWN button is disabled until the box is
// ticked, which is the opposite case: there the reason is the sentence directly
// above it, so the disabled state reads as a consequence rather than a wall.

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CONSENT_DOCUMENTS, CONSENT_VERSION, type ConsentPayload } from "@/lib/consent-config";
import { CONSENT_COPY } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/config";
import type { ConsentDocumentId } from "@/lib/consent-config";
import s from "./home2.module.css";

// Lazy: the dialog and the four document bodies are fetched the first time
// someone asks to read one, not on every pricing page view. ssr:false because
// the modal only ever exists in response to a click.
const LegalDocModal = dynamic(() => import("./LegalDocModal"), { ssr: false });

/** Distinct so the two rows are never duplicate ids on the same document. */
const PAGE_BOX_ID = "checkout-consent";
const MODAL_BOX_ID = "checkout-consent-modal";
const MODAL_TITLE_ID = "checkout-consent-title";

/** Built fresh at click time so the timestamp is the moment of the action. */
export function consentPayload(): ConsentPayload {
  return {
    accepted: true,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
    documents: CONSENT_DOCUMENTS.map((d) => d.id),
  };
}

/**
 * A document link that opens the modal instead of navigating.
 *
 * THE href STAYS REAL, and the interception is a preventDefault on a plain
 * left-click only. Middle-click, ctrl/cmd-click and "open in new tab" still
 * reach the full page; so does a visitor with JS disabled, and so does every
 * crawler, which is what keeps the pages indexable and the sitemap honest. The
 * modal is an enhancement over a working link, not a replacement for one.
 */
function docLink(
  locale: Locale,
  doc: (typeof CONSENT_DOCUMENTS)[number],
  label: string,
  onOpen: (id: ConsentDocumentId) => void,
) {
  return (
    <a
      key={doc.id}
      href={`/${locale}${doc.href}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        // Let the browser handle any click that means "somewhere else".
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
          return;
        }
        e.preventDefault();
        onOpen(doc.id);
      }}
    >
      {label}
    </a>
  );
}

/**
 * Checkbox + the linked sentence. Rendered twice — under the pricing grid and
 * inside the modal — against ONE `accepted` value, so the two can never
 * disagree about what the buyer has agreed to.
 */
function ConsentRow({
  locale,
  boxId,
  className,
  accepted,
  onChange,
  onOpenDoc,
  boxRef,
}: {
  locale: Locale;
  boxId: string;
  className: string;
  accepted: boolean;
  onChange: (next: boolean) => void;
  onOpenDoc: (id: ConsentDocumentId) => void;
  boxRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const t = CONSENT_COPY[locale];
  return (
    <div className={className}>
      <input
        ref={boxRef}
        id={boxId}
        type="checkbox"
        className={s.consentBox}
        checked={accepted}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={boxId} className={s.consentText}>
        {t.agreePrefix}{" "}
        {CONSENT_DOCUMENTS.map((doc, i) => (
          <span key={doc.id}>
            {i > 0 && (i === CONSENT_DOCUMENTS.length - 1 ? t.lastSeparator : t.separator)}
            {docLink(locale, doc, t[doc.labelKey], onOpenDoc)}
          </span>
        ))}
        .
      </label>
    </div>
  );
}

export function ConsentGate({
  locale,
  accepted,
  onChange,
  modalOpen,
  onCloseModal,
  ctaLabel,
  onAccept,
}: {
  locale: Locale;
  accepted: boolean;
  onChange: (next: boolean) => void;
  modalOpen: boolean;
  onCloseModal: () => void;
  /** The plan cards' own checkout label — the modal must not invent a second. */
  ctaLabel: string;
  /** Consent is on record: resume the checkout the modal interrupted. */
  onAccept: () => void;
}) {
  const t = CONSENT_COPY[locale];
  const dialogRef = useRef<HTMLDivElement>(null);
  const modalBoxRef = useRef<HTMLInputElement>(null);
  // Which document the reader is on. null = the dialog is closed.
  const [openDoc, setOpenDoc] = useState<ConsentDocumentId | null>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // A legal document is open ON TOP of this modal and owns the keyboard.
      // Both listeners sit on `document`, where stopPropagation does not
      // separate them — without this check one Esc would close both dialogs and
      // silently drop the plan the buyer had picked.
      if (openDoc) return;
      if (e.key === "Escape") {
        onCloseModal();
        return;
      }
      if (e.key !== "Tab") return;
      // Focus trap: cycle Tab within the dialog so a keyboard user cannot land
      // on the pricing cards behind an open modal.
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    [openDoc, onCloseModal],
  );

  // Focus in on open, back to the plan button that opened it on close. Kept
  // apart from the listener effect below on purpose: that one re-subscribes
  // whenever a document is opened, and re-running this one would yank focus out
  // of the document dialog and back onto the checkbox behind it.
  useEffect(() => {
    if (!modalOpen) return;
    const restore = document.activeElement as HTMLElement | null;
    modalBoxRef.current?.focus();
    return () => {
      restore?.focus?.();
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, onKeyDown]);

  return (
    <>
      <ConsentRow
        locale={locale}
        boxId={PAGE_BOX_ID}
        className={s.consentCard}
        accepted={accepted}
        onChange={onChange}
        onOpenDoc={setOpenDoc}
      />

      {modalOpen && (
        <div
          className={s.consentOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onCloseModal();
          }}
        >
          <div
            ref={dialogRef}
            className={s.consentDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={MODAL_TITLE_ID}
          >
            <p className={s.consentDialogTitle} id={MODAL_TITLE_ID}>
              {t.modalTitle}
            </p>
            <p className={s.consentDialogBody}>{t.modalBody}</p>
            {/* The same row as the page's, bound to the same state. */}
            <ConsentRow
              locale={locale}
              boxId={MODAL_BOX_ID}
              className={s.consentDialogRow}
              accepted={accepted}
              onChange={onChange}
              onOpenDoc={setOpenDoc}
              boxRef={modalBoxRef}
            />
            <div className={s.consentDialogBtns}>
              <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={onCloseModal}>
                {t.modalClose}
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.btnPrimary}`}
                onClick={onAccept}
                disabled={!accepted}
              >
                {ctaLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {openDoc && (
        <LegalDocModal
          locale={locale}
          docId={openDoc}
          onClose={() => setOpenDoc(null)}
          onSwitch={setOpenDoc}
        />
      )}
    </>
  );
}
