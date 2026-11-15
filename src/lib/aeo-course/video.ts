// A lesson's video, resolved from the one line the lesson declares
// (`video: { file, uploadDate }`). Dependency-free: no fs, no ffprobe at
// runtime; the measured numbers live in AEO_VIDEO_PROBE below.
//
// ADDING A LESSON VIDEO (lesson N, file aeo-NN-<slug>):
//
// 1. The HeyGen export goes to public/videos/aeo-NN-<slug>.mp4. It is kept as
//    the original and never served.
// 2. The web copy, which the page plays (H.264/AAC, 1080p at most, moov first):
//      ffmpeg -n -i aeo-NN-<slug>.mp4 -map 0:v:0 -map 0:a:0 -c:v libx264 \
//        -preset veryfast -crf 23 -pix_fmt yuv420p -vf "scale=-2:'min(1080,ih)'" \
//        -c:a aac -b:a 128k -movflags +faststart aeo-NN-<slug>-web.mp4
// 3. The poster, the frame at about 2 s:
//      ffmpeg -n -ss 2 -i aeo-NN-<slug>-web.mp4 -frames:v 1 -q:v 3 aeo-NN-<slug>-poster.jpg
//    Commit it: the nightly media backup to Spaces copies mp4 and pdf files
//    only, so a gitignored poster would have no copy. .gitignore lets
//    public/videos/aeo-*-poster.jpg through for that reason.
// 4. Add the web copy's ffprobe numbers to AEO_VIDEO_PROBE:
//      ffprobe -v error -select_streams v:0 -show_entries stream=width,height:format=duration \
//        -of csv=p=0 public/videos/aeo-NN-<slug>-web.mp4
//    tests/aeo-course-pages.test.ts re-runs ffprobe on every lesson video and
//    fails on a missing or stale entry, printing the line to paste.
// 5. In the lesson: `video: { file: "aeo-NN-<slug>", uploadDate: "YYYY-MM-DD" },`
//
// public/videos/ is otherwise gitignored: the two mp4 files are covered by the
// 04:30 UTC media backup (root's crontab, /var/log/media-backup.log).

import type { AeoLesson, AeoLessonVideo } from "./types";

/**
 * ffprobe of each web copy (`<file>-web.mp4`), keyed by `file`: the container
 * duration in seconds, as printed, and the video stream's frame size.
 */
export const AEO_VIDEO_PROBE: Readonly<Record<string, { duration: number; width: number; height: number }>> = {
  "aeo-what-is-aeo": { duration: 103.594, width: 1920, height: 1080 },
  "aeo-02-how-ai-answers-are-built": { duration: 154.16, width: 1920, height: 1080 },
  "aeo-03-engines-compared": { duration: 151.92, width: 1920, height: 1080 },
};

export const aeoVideoSrc = (file: string) => `/videos/${file}-web.mp4`;
export const aeoVideoPoster = (file: string) => `/videos/${file}-poster.jpg`;

/** The lesson's video, or undefined when it has none. Throws on a file with no probe line. */
export function aeoLessonVideo(lesson: Pick<AeoLesson, "slug" | "title" | "summary" | "video">): AeoLessonVideo | undefined {
  const ref = lesson.video;
  if (!ref) return undefined;
  const probe = AEO_VIDEO_PROBE[ref.file];
  if (!probe) throw new Error(`AEO lesson "${lesson.slug}": no AEO_VIDEO_PROBE entry for "${ref.file}" (src/lib/aeo-course/video.ts)`);
  return {
    src: aeoVideoSrc(ref.file),
    poster: aeoVideoPoster(ref.file),
    title: lesson.title,
    description: lesson.summary,
    uploadDate: ref.uploadDate,
    // Floored, so the VideoObject never claims a second the file does not have.
    durationSeconds: Math.floor(probe.duration),
    width: probe.width,
    height: probe.height,
  };
}
