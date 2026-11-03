import type { RuleCopy } from "../types";

// Lighthouse audits (PageSpeed Insights). Descriptions say what Lighthouse
// measured; none promises a ranking change.

export const COPY: Record<string, RuleCopy> = {
  "performance.render_blocking_resources": {
    name: "Render-blocking resources",
    description: "Stylesheets or scripts in the <head> hold up the first paint until they have downloaded and run. From the page's Lighthouse run.",
    howToFix: "Inline the CSS the first screen needs and load the rest asynchronously; add defer or async to scripts that do not have to run before the page shows.",
  },
  "performance.unused_css": {
    name: "Unused CSS",
    description: "The page downloads CSS rules it never applies, which delays rendering and wastes bytes. From the page's Lighthouse run.",
    howToFix: "Remove unused rules or split stylesheets per page or component, and load non-critical CSS later.",
  },
  "performance.unused_javascript": {
    name: "Unused JavaScript",
    description: "The page downloads JavaScript that never runs during the load, which costs bytes and main-thread time. From the page's Lighthouse run.",
    howToFix: "Split bundles so each page loads only its own code, and defer code that is not needed until a user interacts.",
  },
  "performance.unminified_css": {
    name: "Unminified CSS",
    description: "Stylesheets are served with whitespace and comments a minifier would remove. From the page's Lighthouse run.",
    howToFix: "Minify CSS in the build step (most bundlers do it in production mode).",
  },
  "performance.unminified_javascript": {
    name: "Unminified JavaScript",
    description: "Scripts are served with whitespace and comments a minifier would remove. From the page's Lighthouse run.",
    howToFix: "Minify JavaScript in the build step and check that production builds are what the server sends.",
  },
  "performance.unsized_images": {
    name: "Images without explicit width and height",
    description: "Images without width and height attributes make the layout jump as they load, which counts against Cumulative Layout Shift. From the page's Lighthouse run.",
    howToFix: "Give every <img> width and height attributes (or a CSS aspect-ratio) matching its intrinsic size.",
  },
  "performance.offscreen_images": {
    name: "Offscreen images loaded up front",
    description: "Images below the fold are downloaded during the initial load, competing with what the visitor sees first. Lighthouse 13 no longer reports this audit; the rule fires only on runs that include it. From the page's Lighthouse run.",
    howToFix: "Add loading=\"lazy\" to images below the fold, and never to the main image at the top.",
  },
  "performance.efficiently_encode_images": {
    name: "Images not efficiently encoded",
    description: "Images could be compressed further without visible loss of quality. On Lighthouse 13 this reads the image delivery insight, which also covers sizing and format. From the page's Lighthouse run.",
    howToFix: "Re-encode images at a sensible quality (around 80 for JPEG and WebP) or serve them through an image CDN that does it for you.",
  },
  "performance.properly_size_images": {
    name: "Images larger than displayed",
    description: "Images are downloaded at a larger size than the page displays them, wasting bytes on phones in particular. From the page's Lighthouse run.",
    howToFix: "Serve responsive images with srcset and sizes so each screen downloads the size it shows.",
  },
  "performance.next_gen_image_formats": {
    name: "Images not in a next-gen format",
    description: "JPEG and PNG images that would be smaller as WebP or AVIF. From the page's Lighthouse run.",
    howToFix: "Serve WebP or AVIF, with a <picture> fallback for older browsers, or let an image CDN negotiate the format.",
  },
  "performance.text_compression": {
    name: "Text not compressed",
    description: "HTML, CSS or JavaScript is served without gzip or Brotli compression. From the page's Lighthouse run.",
    howToFix: "Turn on Brotli (or gzip) for text responses at the server or CDN.",
  },
  "performance.efficient_cache_policy": {
    name: "Short cache lifetimes for static assets",
    description: "Static files are served with a short or missing Cache-Control lifetime, so repeat visitors download them again. From the page's Lighthouse run.",
    howToFix: "Serve fingerprinted static assets with Cache-Control: max-age=31536000, immutable.",
  },
  "performance.multiple_redirects": {
    name: "Multiple page redirects",
    description: "The page is reached through redirects, each adding a round trip before anything loads. From the page's Lighthouse run.",
    howToFix: "Link directly to the final URL and collapse redirect chains into a single hop.",
  },
  "performance.server_response_over_600ms": {
    name: "Server response over 600 ms",
    description: "The document took more than 600 ms to start arriving (time to first byte), which delays everything after it. From the page's Lighthouse run.",
    howToFix: "Cache rendered pages at the server or CDN, speed up slow database or API calls, and check hosting capacity.",
  },
  "performance.preconnect_required_origins": {
    name: "Missing preconnect to required origins",
    description: "The page fetches critical resources from other origins without opening those connections early. From the page's Lighthouse run.",
    howToFix: "Add <link rel=\"preconnect\"> for the one or two third-party origins the first screen depends on.",
  },
  "performance.excessive_dom_size": {
    name: "Excessive DOM size",
    description: "The page has a very large number of elements, which slows style calculation, layout and every interaction. From the page's Lighthouse run.",
    howToFix: "Paginate or virtualise long lists, remove hidden markup, and flatten deeply nested wrappers.",
  },
  "performance.javascript_execution_time": {
    name: "Long JavaScript execution time",
    description: "Parsing, compiling and running scripts takes a long time on a mid-range phone. From the page's Lighthouse run.",
    howToFix: "Ship less JavaScript, defer non-critical scripts, and audit third-party tags.",
  },
  "performance.main_thread_work": {
    name: "Too much main-thread work",
    description: "The browser's main thread is busy for a long time during load, so the page responds late to input. From the page's Lighthouse run.",
    howToFix: "Reduce JavaScript, break long tasks up, and move heavy work off the main thread.",
  },
  "performance.large_network_payload": {
    name: "Large network payload",
    description: "The page downloads a large total number of bytes, which is slow and costly on mobile connections. From the page's Lighthouse run.",
    howToFix: "Compress and resize images, drop unused code and fonts, and lazy-load what is below the fold.",
  },
  "performance.lcp_over_2_5s": {
    name: "Largest Contentful Paint over 2.5 s",
    description: "The main content element took more than 2.5 seconds to render in the lab run. Google's \"good\" threshold is 2.5 s. From the page's Lighthouse run.",
    howToFix: "Speed up the server response, preload the LCP image, and remove render-blocking resources in front of it.",
  },
  "performance.cls_over_0_1": {
    name: "Cumulative Layout Shift over 0.1",
    description: "Content moved around while the page loaded. Google's \"good\" threshold is 0.1. From the page's Lighthouse run.",
    howToFix: "Reserve space for images, ads and embeds, and avoid inserting content above what is already on screen.",
  },
  "performance.inp_over_200ms": {
    name: "Interaction to Next Paint over 200 ms",
    description: "Real visitors (Chrome UX Report field data) waited more than 200 ms for the page to respond to their input. Only reported when PSI returns field data for the page. From the page's Lighthouse run.",
    howToFix: "Break up long JavaScript tasks, defer work that runs on input, and keep event handlers small.",
  },
  "performance.fcp_over_1_8s": {
    name: "First Contentful Paint over 1.8 s",
    description: "The first text or image took more than 1.8 seconds to appear in the lab run. Google's \"good\" threshold is 1.8 s. From the page's Lighthouse run.",
    howToFix: "Cut server response time and remove render-blocking CSS and scripts.",
  },
  "performance.tbt_over_200ms": {
    name: "Total Blocking Time over 200 ms",
    description: "Long main-thread tasks blocked input for more than 200 ms in total during load. From the page's Lighthouse run.",
    howToFix: "Split long tasks, defer non-critical JavaScript, and remove unused third-party scripts.",
  },
  "performance.speed_index_over_3_4s": {
    name: "Speed Index over 3.4 s",
    description: "The page's visible content filled in slowly in the lab run. Lighthouse's \"good\" threshold on mobile is 3.4 s. From the page's Lighthouse run.",
    howToFix: "Improve the first render: server response, render-blocking resources and the size of what loads first.",
  },
};
