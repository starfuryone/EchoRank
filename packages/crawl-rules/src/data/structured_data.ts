// The schema.org types structured_data checks, and each one's required and
// recommended properties. Data only: the rules (rules/structured_data.ts) and
// the copy (copy/structured_data.ts) both read it, and the copy is part of the
// client-safe half of the registry (meta.ts), which must not pull rule logic.

/** A requirement is one property, or several of which any one will do. */
export type Req = string | readonly string[];

export interface TypeSpec {
  id: string;
  types: readonly string[];
  required: readonly Req[];
  recommended: readonly Req[];
}

export const TYPE_SPECS: readonly TypeSpec[] = [
  { id: "organization", types: ["Organization"], required: ["name", "url"], recommended: ["logo", "sameAs", "contactPoint"] },
  { id: "local_business", types: ["LocalBusiness"], required: ["name", "address"], recommended: ["telephone", "openingHoursSpecification", "geo", "url", "image"] },
  { id: "product", types: ["Product"], required: ["name", "offers"], recommended: ["image", "description", "brand", "sku", "aggregateRating"] },
  { id: "article", types: ["Article", "NewsArticle", "BlogPosting"], required: ["headline", "author", "datePublished"], recommended: ["image", "dateModified", "publisher"] },
  { id: "faq_page", types: ["FAQPage"], required: ["mainEntity"], recommended: [] },
  { id: "breadcrumb_list", types: ["BreadcrumbList"], required: ["itemListElement"], recommended: [] },
  { id: "website", types: ["WebSite"], required: ["name", "url"], recommended: ["alternateName"] },
  { id: "event", types: ["Event"], required: ["name", "startDate", "location"], recommended: ["description", "endDate", "image", "offers", "organizer", "eventStatus"] },
  { id: "recipe", types: ["Recipe"], required: ["name", "image"], recommended: ["author", "recipeIngredient", "recipeInstructions", "totalTime", "nutrition", "aggregateRating"] },
  { id: "video_object", types: ["VideoObject"], required: ["name", "thumbnailUrl", "uploadDate"], recommended: ["description", "duration", ["contentUrl", "embedUrl"]] },
  {
    id: "job_posting",
    types: ["JobPosting"],
    required: ["title", "description", "datePosted", "hiringOrganization", ["jobLocation", "applicantLocationRequirements"]],
    recommended: ["validThrough", "baseSalary", "employmentType", "identifier"],
  },
  { id: "review", types: ["Review"], required: ["itemReviewed", "author", "reviewRating"], recommended: ["datePublished", "reviewBody", "name"] },
  { id: "how_to", types: ["HowTo"], required: ["name", "step"], recommended: ["totalTime", "supply", "tool", "image"] },
];
