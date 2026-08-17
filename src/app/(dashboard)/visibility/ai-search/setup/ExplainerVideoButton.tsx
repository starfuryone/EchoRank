"use client";

// "Watch Explainer Video" — the one-minute walkthrough of AI Search tracking,
// played in place at the top of the setup wizard.
//
// REUSES components/ui/modal.tsx. That primitive already supplies role="dialog",
// aria-modal, aria-labelledby, the Tab focus trap (its focusable selector
// includes `video`), Escape, backdrop click, the visible X, body scroll lock and
// focus restore to the trigger. Nothing here re-implements any of it.
//
// NOT HomeVideo, the player the /help extension card uses. That component sets
// controls={false} on purpose — play/pause is its whole surface and there is no
// scrub bar. A 61-second explainer someone may want to skim needs native
// controls, so this is a plain <video controls>. It is also muted-by-default
// safe for a different reason: nothing here autoplays at all.

import { useCallback, useRef, useState } from "react";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { AI_SEARCH_EXPLAINER_COPY } from "@/lib/i18n/dashboard";
import type { DashLocale } from "@/lib/i18n/dashboard";

const SRC = "/videos/ai-search-tracking-explainer.mp4";
const POSTER = "/videos/ai-search-tracking-explainer-poster.jpg";

export function ExplainerVideoButton({ locale }: { locale: DashLocale }) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const copy = AI_SEARCH_EXPLAINER_COPY[locale];

  // Stop playback and rewind on the way out. Modal unmounts its children when
  // closed, which would discard the element anyway — but pausing FIRST means the
  // audio stops in the same tick as the click, rather than whenever the detached
  // element is collected, and it keeps this correct if the modal ever starts
  // keeping its children mounted.
  const close = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setOpen(false);
  }, []);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="mt-3 gap-1.5"
      >
        <PlayCircle className="h-4 w-4" aria-hidden="true" />
        {copy.watch}
      </Button>

      <Modal
        open={open}
        onClose={close}
        title={copy.modalTitle}
        closeLabel={copy.close}
        className="max-w-3xl"
      >
        {/* 16:9 box: the source is 1920x1080, so the frame never letterboxes.
            aspect-video keeps that ratio at every width, including mobile, where
            the modal's own mx-4 is what stops it touching the edges. */}
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            className="h-full w-full"
            src={SRC}
            poster={POSTER}
            controls
            playsInline
            preload="metadata"
            aria-label={copy.modalTitle}
          />
        </div>
        <p className="mt-3 text-xs text-gray-500">{copy.caption}</p>
      </Modal>
    </>
  );
}
