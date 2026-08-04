"use client";

// The one Help card that does not navigate.
//
// The extension install is a two-minute video someone watches WHILE doing the
// thing. Sending them to another tab for it is the wrong trade, so this card
// opens the walkthrough in place, in the app's own modal.
//
// The player is HomeVideo — the same component the marketing site uses: starts
// muted, arrow overlay, mute chip, and the "tap the speaker icon to unmute"
// caption in the visitor's language. A raw <video> here would be a second
// player to keep correct.

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { HomeVideo } from "@/app/[locale]/HomeVideo";
import { HOME_TOOLS } from "@/lib/i18n/content";
import type { DashLocale } from "@/lib/i18n/dashboard";
import type { LearnVideo } from "@/lib/learn-content";

export interface HelpVideoCardProps {
  title: string;
  description: string;
  badge: string;
  closeLabel: string;
  locale: DashLocale;
  video: LearnVideo;
  /** The written version of the same walkthrough. */
  articleHref: string;
  articleLabel: string;
}

export function HelpVideoCard({
  title,
  description,
  badge,
  closeLabel,
  locale,
  video,
  articleHref,
  articleLabel,
}: HelpVideoCardProps) {
  const [open, setOpen] = useState(false);
  // All three DashLocales are valid marketing locales, so the player's
  // five-locale catalog is reachable directly — including real de-CH copy.
  const player = HOME_TOOLS[locale].player;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-full w-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-gray-300 hover:shadow-sm"
      >
        <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-gray-900">{title}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              {badge}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">{description}</p>
        </div>
      </button>

      {/* Modal supplies role="dialog", the focus trap, Escape and focus restore
          — see components/ui/modal.tsx. Nothing to re-implement here. */}
      <Modal open={open} onClose={() => setOpen(false)} title={title} closeLabel={closeLabel} className="max-w-3xl">
        <HomeVideo
          className="w-full rounded-lg bg-black"
          src={video.src}
          poster={video.poster}
          ariaLabel={video.title}
          labels={player}
        />
        <div className="mt-3 text-right">
          <a
            href={articleHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {articleLabel}
          </a>
        </div>
      </Modal>
    </>
  );
}
