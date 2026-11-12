// The crawler's intro video on /[locale]/site-crawler (#video). Plain strings,
// no React, so the page, its JSON-LD and the tests import them (the
// demo-video.ts pattern).
//
// The mp4 and poster live in public/videos/, which is gitignored in full:
// like the homepage's section clips they are restored from the off-box media
// list (scripts/untracked-media.txt), not from git, and the section degrades
// to its poster without them. The two caption files are force-added to git:
// they are text written for this page, not media.
//
// Captions: the video already has its spoken subtitles burned in, so the
// tracks carry one cue per scene — the scene's on-screen title — timed at the
// scene changes measured in the file (ffmpeg scene detection, 2026-11-05), in
// English and French. Neither track is on by default.
//
// The duration was read from the file with ffprobe (195.584 s) and is
// hardcoded here; rerun `ffprobe -show_entries format=duration` if the file is
// re-exported. uploadDate is the file's date (its mtime), per videoObject().

export const NB_INTRO_ANCHOR = "video";

export const NB_INTRO_VIDEO = {
  src: "/videos/nosy-bat-intro.mp4",
  poster: "/videos/nosy-bat-intro-poster.jpg",
  /** 195.584 s (ffprobe), rounded. */
  durationSeconds: 196,
  uploadDate: "2026-11-05",
  tracks: [
    { src: "/videos/nosy-bat-intro.en.vtt", srclang: "en", label: "English", kind: "captions" },
    { src: "/videos/nosy-bat-intro.fr.vtt", srclang: "fr", label: "Français", kind: "subtitles" },
  ],
} as const;

/**
 * The intro's length in whole minutes, as copy states it: the Product menu's
 * "Watch the N-minute intro" and the video section's H2 on /site-crawler both
 * read this, so neither can say a length the file does not have.
 */
export const NB_INTRO_MINUTES = Math.round(NB_INTRO_VIDEO.durationSeconds / 60);
