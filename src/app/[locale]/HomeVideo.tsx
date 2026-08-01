"use client";

/**
 * Click-to-toggle video player with custom chrome.
 *
 * Replaces the hover-to-play behaviour that had been patched onto the overview
 * video. Hover-play was wrong for a 57-second narrated clip: it started on a
 * mouse that was only passing through, and it could not carry sound.
 *
 * PLAYS UNMUTED. There is no `muted` attribute and none is set programmatically.
 * That is safe here only because playback never begins without a click —
 * autoplay policy is never involved, so the browser has no reason to refuse.
 * Adding autoplay to this component later would break that and force a mute.
 *
 * Native controls are off (`controls={false}`); play/pause is the whole surface
 * and mute is the chip. A visitor who wants a scrub bar is not served by this
 * component — see the note in ClassicSeoTools.tsx about the other videos.
 */

import { useCallback, useRef, useState } from "react";
import v from "./HomeVideo.module.css";

export interface HomeVideoLabels {
  play: string;
  pause: string;
  mute: string;
  unmute: string;
}

export interface HomeVideoProps {
  src: string;
  poster: string;
  /** Applied to the <video>; callers keep their existing sizing class. */
  className?: string;
  /** Applied to the positioning wrapper. */
  wrapClassName?: string;
  /** Accessible name for the video itself. */
  ariaLabel: string;
  /** Localised control labels — see HOME_TOOLS.player. */
  labels: HomeVideoLabels;
}

export function HomeVideo({
  src,
  poster,
  className,
  wrapClassName,
  ariaLabel,
  labels,
}: HomeVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.paused || el.ended) {
      void el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, []);

  // Enter/Space on the wrapper. role="button" makes it announce as a button;
  // without this it would announce as one and then not behave like one.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  const toggleMute = useCallback((e: React.MouseEvent) => {
    // Without this the click bubbles to the wrapper and pauses the video —
    // the chip sits on top of the play/pause surface.
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }, []);

  return (
    <div className={wrapClassName ? `${v.wrap} ${wrapClassName}` : v.wrap}>
      <div
        className={v.hit}
        onClick={toggle}
        // Only a button while playing: when paused, the overlay below is the
        // real button and two overlapping buttons would be announced twice.
        {...(playing
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": labels.pause,
              onKeyDown,
            }
          : {})}
      >
        <video
          ref={ref}
          className={className}
          src={src}
          poster={poster}
          controls={false}
          playsInline
          preload="none"
          aria-label={ariaLabel}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            const el = ref.current;
            setPlaying(false);
            if (el) el.currentTime = 0;
          }}
        />
        {!playing && (
          <button type="button" className={v.overlay} aria-label={labels.play}>
            <span className={v.circle}>
              <span className={v.triangle} />
            </span>
          </button>
        )}
      </div>

      {/* Sibling of .hit, not a child: a <button> inside a role="button" is
          invalid nesting and screen readers handle it inconsistently. */}
      {playing && (
        <button
          type="button"
          className={v.chip}
          onClick={toggleMute}
          aria-label={muted ? labels.unmute : labels.mute}
        >
          {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
        </button>
      )}
    </div>
  );
}

/* Inline SVG rather than a glyph or an icon package: these sit at 18px inside a
   38px chip, where emoji substitution and font fallback both show. */

function SpeakerOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M4 9v6h4l5 4V5L8 9H4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M4 9v6h4l5 4V5L8 9H4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M17 9.5l4 5m0-5l-4 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
