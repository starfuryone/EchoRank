// Shared demo-video asset paths. Kept out of the client component module so
// server components (metadata, JSON-LD) can import plain strings — importing
// from a "use client" module would hand them client-reference proxies.

/** Do not move/rename the mp4 — external links point at this exact path. */
export const DEMO_VIDEO_SRC = "/EchorankIntroVid.mp4";
export const DEMO_VIDEO_POSTER = "/demo-poster.png";
