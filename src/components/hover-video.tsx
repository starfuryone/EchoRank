"use client";

/**
 * A poster-at-rest <video> that previews on hover.
 *
 * Replaces the inline onMouseEnter/onMouseLeave handlers that were being
 * patched into the homepage video tags one sed at a time. The behaviour is
 * identical for every caller, which is the point: three copies of it drifted.
 *
 * NOT for autoplaying videos. Section /05 loops muted on its own and must keep
 * using a plain <video> — hover-pausing a decorative loop is worse than
 * leaving it alone.
 */

import { useCallback, useRef, useState } from "react";
import v from "./hover-video.module.css";

export interface HoverVideoProps {
  src: string;
  poster: string;
  /** Applied to the <video>, so callers keep their existing sizing class. */
  className?: string;
  /** Applied to the positioning wrapper. */
  wrapClassName?: string;
  /** Accessible name. Required — these carry meaning, not decoration. */
  ariaLabel: string;
  loop?: boolean;
}

export function HoverVideo({
  src,
  poster,
  className,
  wrapClassName,
  ariaLabel,
  loop = false,
}: HoverVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  /**
   * Whether THIS hover started playback. If a visitor pressed the native play
   * button, moving the mouse away must not pause them — that is their session,
   * not our preview. Only a hover-started preview is hover-stopped.
   */
  const startedByHover = useRef(false);

  const onEnter = useCallback(() => {
    const el = ref.current;
    if (!el || !el.paused) return;
    // Muted so the browser's autoplay policy permits a programmatic play().
    // Only set on OUR play: if the visitor unmuted via the controls, a later
    // hover must not silently re-mute them.
    el.muted = true;
    startedByHover.current = true;
    setPlaying(true);
    void el.play().catch(() => {
      // Policy or decode refusal — fall back to the poster and the overlay
      // rather than leaving a frozen frame with no affordance.
      startedByHover.current = false;
      setPlaying(false);
    });
  }, []);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el || !startedByHover.current) return;
    el.pause();
    startedByHover.current = false;
    setPlaying(false);
  }, []);

  return (
    <div
      className={wrapClassName ? `${v.wrap} ${wrapClassName}` : v.wrap}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <video
        ref={ref}
        className={className}
        src={src}
        poster={poster}
        controls
        playsInline
        loop={loop}
        preload="none"
        aria-label={ariaLabel}
        // A deliberate press on the native controls hands the session over, so
        // mouse-out stops interfering from that point on.
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div
        className={playing ? `${v.overlay} ${v.overlayHidden}` : v.overlay}
        aria-hidden="true"
      >
        <div className={v.button}>
          <div className={v.triangle} />
        </div>
      </div>
    </div>
  );
}
