// Shared demo-video asset paths. Kept out of the client component module so
// server components (metadata, JSON-LD) can import plain strings — importing
// from a "use client" module would hand them client-reference proxies.
//
// IN public/ ROOT, NOT public/videos/. That directory is gitignored in full
// (.gitignore), and this box has been rebuilt from git before — an asset the
// homepage's primary CTA depends on cannot live somewhere a rebuild would not
// restore. The videos/ directory is fine for section clips, which degrade to a
// poster; this one is the thing the button promises.
//
// The previous asset (/EchorankIntroVid.mp4 + /demo-poster.png) is deliberately
// LEFT IN PLACE rather than replaced: its old comment recorded that external
// links point at that exact path, and a new filename also sidesteps whatever
// Cloudflare is still holding for the old one.
//
// Captions are burned into the video itself, so there is no <track> to ship.

/** 1080p h264, ~57s, moov atom first (faststart) so playback starts on load. */
export const DEMO_VIDEO_SRC = "/echorank-product-explainer.mp4";
export const DEMO_VIDEO_POSTER = "/echorank-product-explainer-poster.jpg";
