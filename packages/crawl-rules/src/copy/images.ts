import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "images.missing_alt": {
    name: "Image missing alt attribute",
    description: "An <img> has no alt attribute at all. Screen readers then read out the file name, and search engines lose the image's description. An empty alt=\"\" is fine for decorative images; a missing one is not.",
    howToFix: "Add alt text that says what the image shows or does. Use alt=\"\" only for purely decorative images.",
  },
  "images.alt_over_100_chars": {
    name: "Alt text over 100 characters",
    description: "An image's alt text is longer than 100 characters. Long alt text is tedious to listen to and often stuffed with keywords.",
    howToFix: "Describe the image in one short phrase. Put longer explanations in a caption or the surrounding text.",
  },
  "images.missing_size_attributes": {
    name: "Image missing width or height",
    description: "An image has no width or height attribute, so the browser cannot reserve its space and the layout jumps when it loads (Cumulative Layout Shift).",
    howToFix: "Add width and height attributes with the image's intrinsic size; CSS can still scale it responsively.",
  },
  "images.broken": {
    name: "Broken image",
    description: "An image on the page answers with an error status, so visitors see a broken-image icon or an empty gap.",
    howToFix: "Fix the image's path, restore the file, or remove the reference.",
  },
  "images.over_100kb": {
    name: "Image over 100 KB",
    description: "An image on the page weighs more than 100 KB. Heavy images are the most common reason pages load slowly on mobile.",
    howToFix: "Resize the image to the size it is displayed at, compress it, and serve WebP or AVIF.",
  },
  "images.alt_equals_filename": {
    name: "Alt text is the file name",
    description: "An image's alt text just repeats its file name (e.g. \"IMG 0423\" or \"hero banner\"), which describes nothing to a screen-reader user.",
    howToFix: "Write alt text that describes what the image shows.",
  },
  "images.over_50_images": {
    name: "Over 50 images on the page",
    description: "The page loads more than 50 images. Even lazy-loaded, that is a lot of requests and decoding work, especially on mobile.",
    howToFix: "Paginate long galleries, use thumbnails, and check for repeated decorative images that could be CSS.",
  },
  "images.not_lazy_loaded": {
    name: "Offscreen images not lazy-loaded",
    description: "Images further down the page (after the first three) load immediately instead of when the visitor scrolls to them, competing with the content on screen.",
    howToFix: "Add loading=\"lazy\" to images below the fold.",
  },
  "images.first_image_lazy": {
    name: "First image is lazy-loaded",
    description: "The first image on the page has loading=\"lazy\". If it is the hero or main image, lazy-loading delays the Largest Contentful Paint.",
    howToFix: "Remove loading=\"lazy\" from images visible on first load; consider fetchpriority=\"high\" on the main image.",
  },
  "images.missing_srcset": {
    name: "Large image without srcset",
    description: "An image 400 pixels or wider (or with no declared width) offers a single file for every screen, so phones download the desktop-size image.",
    howToFix: "Provide srcset with several widths and a sizes attribute, or use your framework's responsive image component.",
  },
  "images.not_next_gen_format": {
    name: "Image not in a next-gen format",
    description: "A JPEG, PNG or GIF is served with no WebP or AVIF alternative. Modern formats are typically 25–50% smaller at the same quality.",
    howToFix: "Serve WebP or AVIF, either directly or through a <picture> element with a JPEG/PNG fallback.",
  },
};
