// images — <img> elements on the page. Broken and oversize images come from
// the consumer's bounded same-host HEAD checks (imageChecks); everything else
// is read from the markup. Vector and inline images (SVG, data: URIs) are
// exempt from the size, srcset and format rules: none of them apply.

import { ev, pageRule } from "../engine";
import type { ImageFact, PageFacts, Rule } from "../types";

const F = "images" as const;

export const ALT_MAX = 100;
export const IMAGE_COUNT_MAX = 50;
/** Images before this index are treated as possibly above the fold. */
export const EAGER_IMAGES = 3;
export const SRCSET_MIN_WIDTH = 400;

const isRaster = (img: ImageFact) => !/^data:/i.test(img.src) && !/\.svg(\?|$)/i.test(img.src);
const legacyFormat = (img: ImageFact) => /\.(jpe?g|png|gif)(\?|$)/i.test(img.src);

/** Rule over the page's images: fires with a count and the first offender. */
const each = (
  id: string,
  kind: Rule["kind"],
  priority: Rule["priority"],
  match: (img: ImageFact, i: number) => boolean,
) =>
  pageRule({
    id: `images.${id}`,
    family: F,
    kind,
    priority,
    detect: (p: PageFacts) => {
      const hits = p.html!.images.filter(match);
      return hits.length ? ev({ count: hits.length, sample: hits[0]!.src }) : null;
    },
  });

function filenameStem(src: string): string {
  const last = src.split(/[?#]/)[0]!.split("/").pop() ?? "";
  return last.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim().toLowerCase();
}

export const RULES: Rule[] = [
  each("missing_alt", "issue", "medium", (img) => img.alt === null),
  each("alt_over_100_chars", "warning", "low", (img) => (img.alt ?? "").length > ALT_MAX),
  each("missing_size_attributes", "opportunity", "low", (img) => isRaster(img) && (!img.hasWidth || !img.hasHeight)),
  pageRule({
    id: "images.broken",
    family: F,
    kind: "issue",
    priority: "high",
    detect: (p) =>
      p.imageChecks && p.imageChecks.broken > 0
        ? ev({ count: p.imageChecks.broken, checked: p.imageChecks.checked, sample: p.imageChecks.sample })
        : null,
  }),
  pageRule({
    id: "images.over_100kb",
    family: F,
    kind: "opportunity",
    priority: "medium",
    detect: (p) =>
      p.imageChecks && p.imageChecks.oversize > 0
        ? ev({ count: p.imageChecks.oversize, checked: p.imageChecks.checked, sample: p.imageChecks.sample })
        : null,
  }),
  each("alt_equals_filename", "warning", "low", (img) => {
    const alt = (img.alt ?? "").trim().toLowerCase().replace(/[-_]+/g, " ");
    return alt !== "" && alt === filenameStem(img.src);
  }),
  pageRule({
    id: "images.over_50_images",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p) => (p.html!.images.length > IMAGE_COUNT_MAX ? ev({ count: p.html!.images.length }) : null),
  }),
  each("not_lazy_loaded", "warning", "low", (img, i) => i >= EAGER_IMAGES && isRaster(img) && img.loading !== "lazy"),
  pageRule({
    id: "images.first_image_lazy",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => {
      const first = p.html!.images[0];
      return first && first.loading === "lazy" ? ev({ src: first.src }) : null;
    },
  }),
  each(
    "missing_srcset",
    "opportunity",
    "low",
    (img) => isRaster(img) && !img.hasSrcset && (img.width === null || img.width >= SRCSET_MIN_WIDTH),
  ),
  each("not_next_gen_format", "opportunity", "low", (img) => isRaster(img) && legacyFormat(img) && !img.modernSource),
];
