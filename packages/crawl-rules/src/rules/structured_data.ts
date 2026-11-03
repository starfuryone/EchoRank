// structured_data — JSON-LD and microdata: does it parse, is it schema.org,
// and does each item carry the properties its type needs.
//
// One rule per type for required properties and one for recommended ones
// (structured_data.<type>.missing_required / .missing_recommended), so the
// Issues tab says "Product: missing offers", not "some item is incomplete".
// Properties are checked at the item's top level only; a nested shape
// (Review.reviewRating.ratingValue) is the consumer's parse to deepen later.
// Type matching is by name, with the common Article subtypes folded in;
// rarer subtypes (Restaurant for LocalBusiness…) are not chased.
//
// Scope stays parse / required / recommended: a type on a page where it
// "never makes sense" is not flagged (spec).

import { ev, pageRule } from "../engine";
import type { PageFacts, Rule, StructuredItem } from "../types";
import { TYPE_SPECS, type Req, type TypeSpec } from "../data/structured_data";

export { TYPE_SPECS };

const F = "structured_data" as const;

const SCHEMA_ORG = /^https?:\/\/(www\.)?schema\.org\/?/i;

/** "https://schema.org/Product" → "Product". */
const bareType = (t: string) => t.replace(SCHEMA_ORG, "").trim();

/** Every typed item on the page, JSON-LD and microdata alike. */
export function itemsOf(p: PageFacts): StructuredItem[] {
  const h = p.html!;
  return [
    ...h.jsonLd.flatMap((b) => b.items),
    ...h.microdata
      .filter((m) => m.itemtype)
      .map((m) => ({ type: m.itemtype!, vocabulary: m.itemtype!, props: m.props })),
  ];
}

const label = (r: Req) => (typeof r === "string" ? r : r.join(" or "));
const missing = (item: StructuredItem, reqs: readonly Req[]) =>
  reqs.filter((r) => !(typeof r === "string" ? [r] : r).some((k) => item.props.includes(k))).map(label);

function propertyRule(spec: TypeSpec, which: "required" | "recommended"): Rule {
  return pageRule({
    id: `structured_data.${spec.id}.missing_${which}`,
    family: F,
    kind: which === "required" ? "issue" : "opportunity",
    priority: which === "required" ? "medium" : "low",
    detect: (p) => {
      for (const item of itemsOf(p)) {
        if (!spec.types.includes(bareType(item.type))) continue;
        const gone = missing(item, spec[which]);
        if (gone.length) return ev({ type: bareType(item.type), missing: gone.join(", ") });
      }
      return null;
    },
  });
}

export const RULES: Rule[] = [
  pageRule({
    id: "structured_data.jsonld_parse_error",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => {
      const bad = p.html!.jsonLd.filter((b) => !b.ok).length;
      return bad ? ev({ blocks: bad }) : null;
    },
  }),
  pageRule({
    id: "structured_data.microdata_unparsable",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => {
      const untyped = p.html!.microdata.filter((m) => !m.itemtype).length;
      const orphans = p.html!.orphanItemprops;
      return untyped || orphans ? ev({ untypedItems: untyped, orphanProps: orphans }) : null;
    },
  }),
  pageRule({
    id: "structured_data.none",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p) => (p.html!.jsonLd.length === 0 && p.html!.microdata.length === 0 ? ev() : null),
  }),
  pageRule({
    id: "structured_data.non_schema_org",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => {
      const odd = itemsOf(p).find((i) => {
        const absolute = /^https?:\/\//i.test(i.type);
        if (absolute) return !SCHEMA_ORG.test(i.type);
        return i.vocabulary !== null && !SCHEMA_ORG.test(i.vocabulary);
      });
      return odd ? ev({ type: odd.type, vocabulary: odd.vocabulary }) : null;
    },
  }),
  pageRule({
    id: "structured_data.duplicate_blocks",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => {
      const prints = p.html!.jsonLd.map((b) => b.fingerprint).filter((f): f is string => f !== null);
      const dupes = prints.length - new Set(prints).size;
      return dupes > 0 ? ev({ duplicates: dupes }) : null;
    },
  }),
  ...TYPE_SPECS.flatMap((s) => [
    propertyRule(s, "required"),
    // A type with no recommended properties gets no recommended rule: a rule
    // that can never fire is noise in the registry and the public library.
    ...(s.recommended.length ? [propertyRule(s, "recommended")] : []),
  ]),
];
