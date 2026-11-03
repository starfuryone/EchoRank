// hreflang — <link rel="alternate" hreflang>. Page rules read the page's own
// annotations; site rules read what the aggregation found at the TARGETS
// (status, noindex, canonical, return links, the target's own lang).

import { ev, isOk, pageRule, siteRule } from "../engine";
import type { PageFacts, Rule } from "../types";
import { isValidHreflang } from "../util/lang";
import { comparable } from "./canonicals";

const F = "hreflang" as const;

const entries = (p: PageFacts) => p.html!.hreflang;

const target = (
  id: string,
  kind: Rule["kind"],
  priority: Rule["priority"],
  key: "non200" | "noindex" | "notCanonical" | "missingReturn" | "langMismatch" | "unlinked",
) =>
  siteRule({
    id: `hreflang.${id}`,
    family: F,
    kind,
    priority,
    detect: (_p, ctx) => {
      const h = ctx.site.hreflang;
      return h[key] > 0 ? ev({ count: h[key], targets: h.targets, sample: h.sample }) : null;
    },
  });

export const RULES: Rule[] = [
  target("missing_return_links", "issue", "medium", "missingReturn"),
  target("inconsistent_language", "warning", "low", "langMismatch"),
  target("target_not_200", "issue", "medium", "non200"),
  target("unlinked_target", "warning", "low", "unlinked"),
  pageRule({
    id: "hreflang.missing_self_reference",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) => {
      const list = entries(p);
      if (!list.length) return null;
      const self = comparable(p.finalUrl, p.finalUrl);
      return list.some((e) => comparable(e.href, p.finalUrl) === self) ? null : ev({ entries: list.length });
    },
  }),
  target("not_using_canonical", "warning", "medium", "notCanonical"),
  pageRule({
    id: "hreflang.invalid_code",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => {
      const bad = entries(p).filter((e) => !isValidHreflang(e.lang));
      return bad.length ? ev({ count: bad.length, value: bad[0]!.lang }) : null;
    },
  }),
  pageRule({
    id: "hreflang.multiple_entries_for_language",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) => {
      const byLang = new Map<string, Set<string>>();
      for (const e of entries(p)) {
        const set = byLang.get(e.lang) ?? new Set<string>();
        set.add(comparable(e.href, p.finalUrl) ?? e.href);
        byLang.set(e.lang, set);
      }
      const dup = [...byLang].find(([, urls]) => urls.size > 1);
      return dup ? ev({ value: dup[0], urls: dup[1].size }) : null;
    },
  }),
  pageRule({
    id: "hreflang.missing_x_default",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p) => {
      const list = entries(p);
      return list.length && !list.some((e) => e.lang === "x-default") ? ev({ entries: list.length }) : null;
    },
  }),
  pageRule({
    id: "hreflang.outside_head",
    family: F,
    kind: "issue",
    priority: "medium",
    applies: "html",
    detect: (p) => (p.html!.hreflangOutsideHead > 0 ? ev({ count: p.html!.hreflangOutsideHead }) : null),
  }),
  target("target_noindex", "issue", "medium", "noindex"),
  siteRule({
    id: "hreflang.missing_on_multilingual_site",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p, ctx) =>
      ctx.job.langsSeen >= 2 && p.hreflang.length === 0 && isOk(p.statusCode) && /html/i.test(p.contentType ?? "") && !p.noindex
        ? ev({ languages: ctx.job.langsSeen })
        : null,
  }),
];
