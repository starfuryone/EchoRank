// meta_description — <meta name="description">. Search engines rewrite it
// freely, so nothing here is above "medium": the description is a pitch, not
// a ranking factor.

import { ev, pageRule, siteRule } from "../engine";
import type { PageFacts, Rule } from "../types";
import { DESCRIPTION_FONT_PX, pixelWidth } from "../util/pixels";

const F = "meta_description" as const;

const descOf = (p: PageFacts): string | null => p.html!.metaDescriptions.find((d) => d !== "") ?? null;

const withDesc = (test: (d: string) => ReturnType<typeof ev> | null) => (p: PageFacts) => {
  const d = descOf(p);
  return d === null ? null : test(d);
};

export const RULES: Rule[] = [
  pageRule({
    id: "meta_description.missing",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) => (descOf(p) === null ? ev({ tags: p.html!.metaDescriptions.length }) : null),
  }),
  siteRule({
    id: "meta_description.duplicate",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p, ctx) =>
      p.metaDescription && ctx.site.duplicateMetaCount > 1
        ? ev({ pages: ctx.site.duplicateMetaCount, description: p.metaDescription })
        : null,
  }),
  pageRule({
    id: "meta_description.over_155_chars",
    family: F,
    kind: "warning",
    priority: "low",
    detect: withDesc((d) => (d.length > 155 ? ev({ length: d.length }) : null)),
  }),
  pageRule({
    id: "meta_description.under_70_chars",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: withDesc((d) => (d.length < 70 ? ev({ length: d.length, description: d }) : null)),
  }),
  pageRule({
    id: "meta_description.over_985_px",
    family: F,
    kind: "warning",
    priority: "low",
    detect: withDesc((d) => {
      const px = pixelWidth(d, DESCRIPTION_FONT_PX);
      return px > 985 ? ev({ pixels: px }) : null;
    }),
  }),
  pageRule({
    id: "meta_description.multiple",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) => (p.html!.metaDescriptions.length > 1 ? ev({ count: p.html!.metaDescriptions.length }) : null),
  }),
  pageRule({
    id: "meta_description.outside_head",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) =>
      p.html!.metaDescriptionsOutsideHead > 0 ? ev({ count: p.html!.metaDescriptionsOutsideHead }) : null,
  }),
];
