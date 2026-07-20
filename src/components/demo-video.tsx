"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./demo-video.module.css";
import { DEMO_VIDEO, type DemoVideoCopy } from "@/lib/i18n/content";
import { isSupportedLocale, type Locale } from "@/lib/i18n/config";

import { DEMO_VIDEO_POSTER, DEMO_VIDEO_SRC } from "@/lib/demo-video";

function copyFor(locale: string): DemoVideoCopy {
  return DEMO_VIDEO[isSupportedLocale(locale) ? (locale as Locale) : "en"];
}

/**
 * Native <video> player with the funnel CTAs: a persistent CTA row below the
 * player and a prominent overlay on the player once the video ends.
 */
export function DemoVideoPlayer({
  locale,
  pricingHref,
  onNavigate,
}: {
  locale: string;
  /** Where "See pricing" points ("#pricing" on the homepage, "/{l}#pricing" elsewhere). */
  pricingHref: string;
  /** Called when a CTA is followed (the modal closes itself through this). */
  onNavigate?: () => void;
}) {
  const t = copyFor(locale);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ended, setEnded] = useState(false);

  const replay = () => {
    setEnded(false);
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  };

  return (
    <div>
      <div className={s.playerWrap}>
        {/* Captions are omitted because no caption track exists for this
            asset; the surrounding page copy summarizes the content. */}
        <video
          ref={videoRef}
          className={s.video}
          src={DEMO_VIDEO_SRC}
          poster={DEMO_VIDEO_POSTER}
          controls
          preload="metadata"
          playsInline
          aria-label={t.videoLabel}
          onEnded={() => setEnded(true)}
          onPlay={() => setEnded(false)}
        />
        {ended && (
          <div className={s.endOverlay}>
            <p className={s.endHeadline}>{t.endHeadline}</p>
            <p className={s.endSub}>{t.endSub}</p>
            <div className={s.ctaRow}>
              <a className={s.btnPrimary} href="/register" onClick={onNavigate}>
                {t.ctaPrimary}
              </a>
              <a className={s.btnGhost} href={pricingHref} onClick={onNavigate}>
                {t.ctaSecondary}
              </a>
            </div>
            <button type="button" className={s.replayBtn} onClick={replay}>
              {t.replay}
            </button>
          </div>
        )}
      </div>

      <div className={s.belowCtas}>
        <a className={s.btnPrimary} href="/register" onClick={onNavigate}>
          {t.ctaPrimary}
        </a>
        <a className={s.btnGhost} href={pricingHref} onClick={onNavigate}>
          {t.ctaSecondary}
        </a>
      </div>
    </div>
  );
}

/**
 * Accessible in-page modal around the demo video: Esc / overlay click / X to
 * close, focus trapped inside, focus restored and scroll position untouched
 * on close.
 */
export function DemoVideoModal({
  locale,
  open,
  onClose,
}: {
  locale: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = copyFor(locale);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Minimal focus trap: cycle Tab within the dialog's focusables.
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), video, [tabindex]:not([tabindex="-1"])',
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
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    // Lock background scrolling without losing the scroll position.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className={s.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t.dialogLabel}
        tabIndex={-1}
        data-demo-video-modal
      >
        <button
          type="button"
          className={s.closeBtn}
          onClick={onClose}
          aria-label={t.close}
        >
          ×
        </button>
        <DemoVideoPlayer locale={locale} pricingHref="#pricing" onNavigate={onClose} />
      </div>
    </div>
  );
}
