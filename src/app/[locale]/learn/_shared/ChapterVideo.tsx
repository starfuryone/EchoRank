// A chapter's own video: a 16:9 block with the browser's native controls.
//
// NOT HomeVideo. That player is deliberately chrome-light — click-to-toggle, a
// mute chip, no scrub bar — which suits a short autoplayed-muted marketing clip
// and does not suit a four-minute chapter someone may want to seek through or
// slow down. The note in ClassicSeoTools.tsx makes the same distinction.
//
// Server component: native controls need no JavaScript, so this stays out of
// the client bundle entirely.
//
// NO LAYOUT SHIFT: the frame reserves its height with aspect-ratio before the
// poster or any metadata loads, so nothing below it moves. preload="none" keeps
// a ~96 MB file off the initial page load — the poster is the only byte cost
// until someone presses play.
//
// Also the AEO course's lesson player (src/app/[locale]/learn/aeo/[lesson]),
// which asks for preload="metadata" (a ~27 MB file, so the duration shows on
// the scrub bar without fetching the video), a <figcaption>, and a class to
// hide it in print.

import type { ReactNode } from "react";
import type { ChapterVideo as ChapterVideoData } from "@/lib/learn-content";
import c from "./learn.module.css";

export function ChapterVideo({
  video,
  preload = "none",
  caption,
  className,
}: {
  video: Pick<ChapterVideoData, "src" | "poster" | "title">;
  preload?: "none" | "metadata";
  caption?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={className ? `${c.chapterVideo} ${className}` : c.chapterVideo}>
      <div className={c.chapterVideoFrame}>
        <video
          className={c.chapterVideoEl}
          src={video.src}
          poster={video.poster}
          controls
          preload={preload}
          playsInline
          aria-label={video.title}
        />
      </div>
      {/* Styled by the caller's class (the course's `.figure figcaption`). */}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
