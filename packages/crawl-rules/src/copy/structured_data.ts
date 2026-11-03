import type { RuleCopy } from "../types";
import { TYPE_SPECS } from "../data/structured_data";

/** Display names for the type specs, as schema.org spells them. */
const TYPE_NAME: Record<string, string> = {
  organization: "Organization",
  local_business: "LocalBusiness",
  product: "Product",
  article: "Article",
  faq_page: "FAQPage",
  breadcrumb_list: "BreadcrumbList",
  website: "WebSite",
  event: "Event",
  recipe: "Recipe",
  video_object: "VideoObject",
  job_posting: "JobPosting",
  review: "Review",
  how_to: "HowTo",
};

const list = (reqs: readonly (string | readonly string[])[]) =>
  reqs.map((r) => (typeof r === "string" ? r : r.join(" or "))).join(", ");

/** HowTo rich results were retired in 2023; its copy must not promise one. */
const RETIRED = new Set(["how_to"]);

function typeCopy(): Record<string, RuleCopy> {
  const out: Record<string, RuleCopy> = {};
  for (const s of TYPE_SPECS) {
    const name = TYPE_NAME[s.id]!;
    const payoff = RETIRED.has(s.id)
      ? "Google no longer shows HowTo rich results, but other consumers still read valid markup."
      : `Without them the item is not eligible for ${name} rich results.`;
    out[`structured_data.${s.id}.missing_required`] = {
      name: `${name}: missing required properties`,
      description: `A ${name} item lacks properties it must have (${list(s.required)}). ${payoff}`,
      howToFix: `Add the missing properties to the ${name} markup. Google's structured data documentation for ${name} lists them; test the page with the Rich Results Test.`,
    };
    if (s.recommended.length) {
      out[`structured_data.${s.id}.missing_recommended`] = {
        name: `${name}: missing recommended properties`,
        description: `A ${name} item lacks properties that are optional but recommended (${list(s.recommended)}). They make the item more complete for search engines and AI assistants.`,
        howToFix: `Add the recommended properties you can fill truthfully. Google's structured data documentation for ${name} describes each one.`,
      };
    }
  }
  return out;
}

export const COPY: Record<string, RuleCopy> = {
  "structured_data.jsonld_parse_error": {
    name: "JSON-LD parse error",
    description: "A <script type=\"application/ld+json\"> block is not valid JSON, so search engines ignore all of it. The usual culprits: a trailing comma, an unescaped quote, a template variable left empty.",
    howToFix: "Validate the block with a JSON linter or the Rich Results Test, and fix the template that produces it.",
  },
  "structured_data.microdata_unparsable": {
    name: "Incomplete microdata",
    description: "The page has microdata that cannot be read as items: an itemscope with no itemtype, or itemprop attributes outside any itemscope.",
    howToFix: "Give every itemscope an itemtype from schema.org and keep each itemprop inside its item's itemscope. Or switch to JSON-LD.",
  },
  "structured_data.none": {
    name: "No structured data",
    description: "The page has no JSON-LD or microdata. Structured data helps search engines and AI assistants understand what the page describes, such as a business, product, article or event.",
    howToFix: "Add JSON-LD for the page's main entity. At minimum, Organization or LocalBusiness on the homepage and the matching type on content pages.",
  },
  "structured_data.non_schema_org": {
    name: "Non-schema.org vocabulary",
    description: "An item uses a vocabulary other than schema.org (e.g. the retired data-vocabulary.org). Search engines only support schema.org.",
    howToFix: "Rewrite the markup with schema.org types and a \"@context\": \"https://schema.org\".",
  },
  "structured_data.duplicate_blocks": {
    name: "Duplicate JSON-LD blocks",
    description: "Two or more JSON-LD blocks on the page are identical, usually a theme and a plugin both emitting the same markup.",
    howToFix: "Output each block once; disable the duplicate source.",
  },
  ...typeCopy(),
};
