"use client";

// src/app/[locale]/ConsentGate.tsx
//
// The checkout consent gate: one checkbox spanning the pricing grid, plus the
// "agreement required" modal a plan CTA opens when it is unchecked.
//
// THE DOCUMENT LIST IS NEVER WRITTEN IN JSX. Both the sentence and the modal
// list are built by mapping CONSENT_DOCUMENTS, so adding a document to
// src/lib/consent-config.ts adds a link in both places and to what the server
// requires, in one edit. A hardcoded sentence would drift from the server's
// validation the first time that list changed, and the failure would be a
// checkout rejected for a document the user was never shown.
//
// THE CTAs ARE NOT DISABLED when consent is missing. A disabled button explains
// nothing — the visitor sees a dead control and no reason. Letting the click
// through and answering with a modal that names the documents and scrolls back
// to the checkbox tells them what to do.

import { useCallback, useEffect, useRef, useState } from "react";
import { CONSENT_DOCUMENTS, CONSENT_VERSION, type ConsentPayload } from "@/lib/consent-config";
import { CONSENT_COPY } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/config";
import s from "./home2.module.css";

/** Built fresh at click time so the timestamp is the moment of the action. */
export function consentPayload(): ConsentPayload {
  return {
    accepted: true,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
    documents: CONSENT_DOCUMENTS.map((d) => d.id),
  };
}

function docLink(locale: Locale, doc: (typeof CONSENT_DOCUMENTS)[number], label: string) {
  return (
    <a key={doc.id} href={`/${locale}${doc.href}`} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

export function ConsentGate({
  locale,
  accepted,
  onChange,
  modalOpen,
  onCloseModal,
}: {
  locale: Locale;
  accepted: boolean;
  onChange: (next: boolean) => void;
  modalOpen: boolean;
  onCloseModal: () => void;
}) {
  const t = CONSENT_COPY[locale];
  const boxRef = useRef<HTMLInputElement>(null);

  const label = (doc: (typeof CONSENT_DOCUMENTS)[number]) => t[doc.labelKey];

  /** Close the modal, then scroll the checkbox into view and focus it. */
  const goToCheckbox = useCallback(() => {
    onCloseModal();
    const box = boxRef.current;
    if (!box) return;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    // Focus after the scroll starts; focusing first would jump the page and
    // undo the smooth scroll.
    window.setTimeout(() => box.focus(), 300);
  }, [onCloseModal]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen, onCloseModal]);

  return (
    <>
      <div className={s.consentCard}>
        <input
          ref={boxRef}
          id="checkout-consent"
          type="checkbox"
          className={s.consentBox}
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label htmlFor="checkout-consent" className={s.consentText}>
          {t.agreePrefix}{" "}
          {CONSENT_DOCUMENTS.map((doc, i) => (
            <span key={doc.id}>
              {i > 0 && (i === CONSENT_DOCUMENTS.length - 1 ? t.lastSeparator : t.separator)}
              {docLink(locale, doc, label(doc))}
            </span>
          ))}
          .
        </label>
      </div>

      {modalOpen && (
        <div
          className={s.consentOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onCloseModal();
          }}
        >
          <div className={s.consentDialog} role="dialog" aria-modal="true" aria-label={t.modalTitle}>
            <p className={s.consentDialogTitle}>{t.modalTitle}</p>
            <p className={s.consentDialogBody}>{t.modalBody}</p>
            <ul className={s.consentDialogList}>
              {CONSENT_DOCUMENTS.map((doc) => (
                <li key={doc.id}>{docLink(locale, doc, label(doc))}</li>
              ))}
            </ul>
            <div className={s.consentDialogBtns}>
              <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={onCloseModal}>
                {t.modalClose}
              </button>
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={goToCheckbox}>
                {t.modalCta}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
