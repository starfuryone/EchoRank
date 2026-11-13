// Industry prompt setup guides — /[locale]/prompt-guides and /[locale]/prompt-guides/[slug].
//
// ONE CONFIG, EVERY SURFACE. The hub, the ten guide pages, their JSON-LD, the
// sitemap, every chart and table, and tests/prompt-guides.test.ts all read this
// module; nothing paraphrases it. The per-guide data was extracted by a one-off
// parser from the editorial package (the prompt setup guides redelivery
// tarball, 2026-11-13) and hand-reviewed — the 120 prompts were not retyped.
//
// Corrections applied to the package on the way in, and nothing else:
//   - brand casing (the package's camel-case wordmark becomes "Echorank");
//   - "Build an retail …" and eight more meta descriptions take the right article;
//   - "b2b software" is "B2B software";
//   - the package's own CTAs, domain links and source-attribution line are
//     not carried over at all: the pages link to /free-audit and /pricing.
// The *Short fields, sourceRows' claim types and FIX_BUILD's "why" are the only
// copy written here rather than extracted; each is a condensation of package
// text on the same page and states nothing the package does not.
//
// BODY COPY IS ENGLISH under all five locales, the same first-pass rule as
// /learn: the pages canonical to /en, and the nav, footer and CTA chrome
// translate as they do everywhere else.
//
// The prompts are synthetic examples for designing a monitoring program. They
// are not search-volume data, and the pages say so where the prompts appear.

import { PROMPT_GUIDES_BASE, PROMPT_GUIDE_SLUGS, type PromptGuideSlug } from "./prompt-guide-routes";

export { PROMPT_GUIDES_BASE, PROMPT_GUIDE_SLUGS, type PromptGuideSlug };

/** The package's date. Feeds the "Updated …" chip and Article.dateModified. */
export const PROMPT_GUIDES_UPDATED_AT = "2026-11-13";

/** "Updated November 2026", from PROMPT_GUIDES_UPDATED_AT. */
export function updatedLabel(): string {
  const d = new Date(`${PROMPT_GUIDES_UPDATED_AT}T00:00:00Z`);
  const month = d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `Updated ${month} ${d.getUTCFullYear()}`;
}

/**
 * What a prompt is for, as the package labels it. A closed set, in the order
 * every chart, legend and table column uses.
 */
export const PROMPT_USES = [
  "Discovery",
  "Education",
  "Evaluation",
  "Comparison",
  "Validation",
  "Fact check",
  "Local",
] as const;
export type PromptUse = (typeof PROMPT_USES)[number];

export interface GuidePrompt {
  topic: string;
  text: string;
  use: PromptUse;
}

export interface TagRow {
  dimension: string;
  labels: readonly string[];
}

/** One row of the "Source of truth" table: a slice of the guide's sourceOfTruth sentence. */
export interface SourceRow {
  /** What kind of claim this source settles. Written here, ≤ 4 words. */
  claim: string;
  /** Verbatim from sourceOfTruth (first letter capitalised). */
  source: string;
}

export type IconShape =
  | { el: "path"; d: string }
  | { el: "rect"; x: number; y: number; width: number; height: number; rx?: number }
  | { el: "circle"; cx: number; cy: number; r: number };

/**
 * The package's 24 × 24 stroke icons (stroke-width 1.7, round caps and joins),
 * one per guide.
 */
export const PROMPT_GUIDE_ICONS = {
  car: [{ el: "path", d: "m5 17-1 2v2m15-4 1 2v2M4 17h16l-2-7H6l-2 7Zm3-7 2-5h6l2 5M5 17v-4m14 4v-4M7 17h.01M17 17h.01" }],
  code: [
    { el: "rect", x: 4, y: 4, width: 16, height: 13, rx: 2 },
    { el: "path", d: "M2 20h20M9 8l-3 3 3 3m6-6 3 3-3 3" },
  ],
  package: [{ el: "path", d: "m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 19V12M3 8l9 4 9-4M7.5 5.5l9 4.5" }],
  bank: [{ el: "path", d: "M3 10h18M5 10v9m5-9v9m4-9v9m5-9v9M3 21h18M2 8l10-5 10 5M2 8h20" }],
  heartPulse: [
    { el: "path", d: "M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 6l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.3a5.5 5.5 0 0 0 0-7.8Z" },
    { el: "path", d: "M6 12h3l1.5-2.5 2.5 5 1.5-2.5H18" },
  ],
  flask: [{ el: "path", d: "M9 3h6m-5 0v7l-6.8 9.7A2 2 0 0 0 5 22h14a2 2 0 0 0 1.8-2.3L14 10V3M7 16h10" }],
  newspaper: [
    { el: "rect", x: 3, y: 3, width: 18, height: 18, rx: 2 },
    { el: "path", d: "M7 7h10M7 11h10M7 15h4m3 0h3M7 19h10" },
  ],
  cart: [
    { el: "circle", cx: 9, cy: 20, r: 1 },
    { el: "circle", cx: 19, cy: 20, r: 1 },
    { el: "path", d: "M2 3h2l3.2 13h12l2-9H5" },
  ],
  router: [
    { el: "rect", x: 3, y: 5, width: 18, height: 15, rx: 3 },
    { el: "path", d: "M8 11h8m-8 4h8M7 5l10-3" },
  ],
  plane: [{ el: "path", d: "m22 2-8 20-3.5-8.5L2 10l20-8Zm0 0L10.5 13.5" }],
} as const satisfies Record<string, readonly IconShape[]>;
export type PromptGuideIcon = keyof typeof PROMPT_GUIDE_ICONS;

export interface PromptGuide {
  slug: PromptGuideSlug;
  /** Short industry name: cards, tables, breadcrumbs. */
  name: string;
  /** The H1 and the Article headline. */
  title: string;
  eyebrow: string;
  /** The hub card's one-liner. */
  cardDescription: string;
  lead: string;
  /** ≤ 165 characters. */
  metaDescription: string;
  /** Lower-case sector phrase for "… purchase contexts for {sector}." */
  sector: string;
  /** The bolded phrase in §1. */
  focusAreas: string;
  persona: string;
  scenario: string;
  prompts: readonly GuidePrompt[];
  refinement: { before: string; after: string };
  tags: readonly TagRow[];
  safeguard: string;
  /** ≤ 12-word condensation of safeguard, for the hub's glance table. */
  safeguardShort: string;
  sourceOfTruth: string;
  sourceRows: readonly SourceRow[];
  actions: readonly string[];
  researchQuestions: readonly string[];
  /** The sector-specific cadence sentence; CADENCE_TAIL follows it on the page. */
  cadence: string;
  /** ≤ 12-word condensation of cadence, for the hub's glance table. */
  cadenceShort: string;
  icon: PromptGuideIcon;
}

export const PROMPT_GUIDES: readonly PromptGuide[] = [
  {
    slug: "automotive",
    name: "Automotive",
    title: "Automotive AI Search Prompt Guide",
    eyebrow: "Mobility & vehicle shopping",
    cardDescription: "Vehicle research, ownership costs, EV decisions, dealer discovery and product accuracy.",
    lead: "Vehicle buyers increasingly ask assistants to turn a long shortlist into a practical choice. For Echorank, the most valuable prompts reveal where a manufacturer, dealer group or automotive marketplace enters that shortlist—and which features or facts determine the recommendation.",
    metaDescription: "Build an automotive AI search prompt library with 12 examples, industry tags, measurement methods, accuracy checks, and GEO recommendations.",
    sector: "automotive",
    focusAreas: "vehicle suitability, competitive positioning, price transparency and local availability",
    persona: "A household comparing practical vehicles for a specific commute, budget and lifestyle.",
    scenario: "A parent needs a winter-capable family SUV, drives 55 miles a day and wants to keep the out-the-door price under $48,000.",
    prompts: [
      { topic: "Segment discovery", text: "Which compact crossovers are a sensible choice for a small family that mostly drives in a city?", use: "Discovery" },
      { topic: "Trim decisions", text: "For a buyer planning to keep a vehicle for eight years, which features justify moving up a trim level?", use: "Evaluation" },
      { topic: "Ownership economics", text: "Which hybrid sedans tend to have manageable five-year ownership costs for a commuter?", use: "Discovery" },
      { topic: "Head-to-head", text: "Compare [model A] and [model B] for two adults, two car seats and frequent highway trips.", use: "Comparison" },
      { topic: "EV fit", text: "Which electric SUVs work well for drivers who cannot install a home charger?", use: "Discovery" },
      { topic: "Weather performance", text: "What should I check before buying an EV for cold-weather commuting?", use: "Education" },
      { topic: "Finance choices", text: "How should a buyer compare a three-year lease with financing the same SUV?", use: "Evaluation" },
      { topic: "Resale value", text: "Which factors affect resale value most when choosing a midsize pickup?", use: "Education" },
      { topic: "Dealer discovery", text: "Which certified pre-owned SUV dealerships serve [city] and explain their inspection process clearly?", use: "Local" },
      { topic: "Parts compatibility", text: "What information do I need to confirm that replacement brake pads fit a [year] [model]?", use: "Validation" },
      { topic: "Service & recalls", text: "Where should an owner verify a safety recall for a [year] [model]?", use: "Fact check" },
      { topic: "Launch monitoring", text: "What changed between the [model] 2026 and 2027 model years?", use: "Validation" },
    ],
    refinement: {
      before: "What are good SUVs?",
      after: "We have two children and drive 55 miles daily in a snowy region. Which family SUVs under $48,000 offer comfortable second-row access, winter traction and manageable fuel costs?",
    },
    tags: [
      { dimension: "Journey", labels: ["explore", "compare", "purchase", "ownership"] },
      { dimension: "Vehicle", labels: ["SUV", "sedan", "pickup", "EV"] },
      { dimension: "Need", labels: ["commuter", "family", "towing", "first-time buyer"] },
      { dimension: "Powertrain", labels: ["gas", "hybrid", "plug-in hybrid", "electric"] },
      { dimension: "Market", labels: ["national", "metro", "dealer territory"] },
      { dimension: "Verification", labels: ["specifications", "recalls", "pricing", "warranty"] },
    ],
    safeguard: "Vehicle specifications, current prices, safety results, battery range and recall status may be model-year-specific; verify before publishing or reporting.",
    safeguardShort: "Specs, prices, safety results, range and recalls vary by model year.",
    sourceOfTruth: "Manufacturer model-year specifications, official safety testing, current dealer inventory and official recall databases.",
    sourceRows: [
      { claim: "Specifications", source: "Manufacturer model-year specifications" },
      { claim: "Safety results", source: "Official safety testing" },
      { claim: "Inventory", source: "Current dealer inventory" },
      { claim: "Recalls", source: "Official recall databases" },
    ],
    actions: [
      "Publish comparison pages organized around buyer use cases rather than only specifications.",
      "Keep vehicle year, trim, and package details explicit in headings and tables.",
      "Make recall, warranty and inventory information attributable to authoritative sources.",
      "Connect regional dealership pages to accurate service-area and inventory information.",
    ],
    researchQuestions: [
      "Which vehicle segment has the highest unbranded recommendation gap?",
      "Where do competing models win on safety, comfort or total cost of ownership?",
      "Which vehicle details in AI answers are outdated or unsupported?",
      "Do recommendations vary between urban, suburban and winter-weather buyer profiles?",
    ],
    cadence: "Refresh model-year questions before launches; revisit financing and local inventory prompts as offers change.",
    cadenceShort: "Before model-year launches; financing and inventory prompts as offers change.",
    icon: "car",
  },
  {
    slug: "b2b-software",
    name: "B2B Software",
    title: "B2B Software AI Search Prompt Guide",
    eyebrow: "SaaS & enterprise technology",
    cardDescription: "Use-case discovery, integrations, procurement, security, alternatives and pricing models.",
    lead: "Software buyers ask AI systems to compress weeks of vendor evaluation into a shortlist. A useful prompt library should reflect the people involved in the decision: end users, operations leads, finance, security and procurement—not only product keywords.",
    metaDescription: "Build a B2B software AI search prompt library with 12 examples, industry tags, measurement methods, accuracy checks, and GEO recommendations.",
    sector: "B2B software",
    focusAreas: "fit by use case, integration compatibility, vendor differentiation and proof of trust",
    persona: "An operations leader evaluating a tool for a team with existing systems and a firm budget.",
    scenario: "A revenue-operations manager at a 75-person company needs pipeline reporting that connects to the company CRM without adding a full-time administrator.",
    prompts: [
      { topic: "Problem discovery", text: "What software helps a small customer-success team identify at-risk accounts before renewals?", use: "Discovery" },
      { topic: "Buyer role", text: "Which workflow tools are most practical for a finance team that does not have a dedicated administrator?", use: "Discovery" },
      { topic: "Integration fit", text: "Which reporting platforms connect to [CRM] and [data warehouse] without a custom connector?", use: "Evaluation" },
      { topic: "Security review", text: "What questions should an IT lead ask vendors about SSO, audit logs and data retention?", use: "Education" },
      { topic: "Competitor alternative", text: "What alternatives to [competitor] suit a 75-person company with limited implementation support?", use: "Comparison" },
      { topic: "Feature depth", text: "Which customer-support platforms can route tickets based on account-level service tiers?", use: "Discovery" },
      { topic: "Total cost", text: "How should we estimate the full first-year cost of a 60-seat analytics tool?", use: "Evaluation" },
      { topic: "Implementation", text: "Which project management tools can a distributed team adopt in under a month?", use: "Discovery" },
      { topic: "Procurement", text: "How can buyers compare annual contracts, minimum seats and renewal clauses across SaaS vendors?", use: "Education" },
      { topic: "Migration", text: "What should a team plan before moving historical support tickets from [tool A] to [tool B]?", use: "Evaluation" },
      { topic: "Brand validation", text: "Does [brand] document its [integration] and supported data fields publicly?", use: "Validation" },
      { topic: "Fact check", text: "Where does [brand] publish its latest compliance certifications and subprocessors?", use: "Fact check" },
    ],
    refinement: {
      before: "What is the best CRM tool?",
      after: "We have 75 employees, use [CRM] and need pipeline reports for finance every Monday. Which reporting platforms integrate with our stack, have transparent per-seat pricing and require little admin overhead?",
    },
    tags: [
      { dimension: "Intent", labels: ["discovery", "comparison", "security-review", "validation"] },
      { dimension: "Buyer role", labels: ["operations", "IT", "finance", "procurement"] },
      { dimension: "Organization", labels: ["startup", "SMB", "mid-market", "enterprise"] },
      { dimension: "Stack", labels: ["CRM", "helpdesk", "data platform", "SSO"] },
      { dimension: "Lifecycle", labels: ["selection", "pilot", "migration", "renewal"] },
      { dimension: "Verification", labels: ["pricing", "integrations", "security", "data residency"] },
    ],
    safeguard: "Pricing tiers, data-processing terms, certifications and integration availability change; validate all claims against current vendor documents.",
    safeguardShort: "Pricing, data terms, certifications and integrations change; check current vendor documents.",
    sourceOfTruth: "Current product documentation, public pricing pages, integration directories, independent security attestations and verified product reviews.",
    sourceRows: [
      { claim: "Capabilities", source: "Current product documentation" },
      { claim: "Pricing", source: "Public pricing pages" },
      { claim: "Integrations", source: "Integration directories" },
      { claim: "Security and compliance", source: "Independent security attestations" },
      { claim: "Customer experience", source: "Verified product reviews" },
    ],
    actions: [
      "Write solution pages for a specific team, problem and technology environment.",
      "Show integrations with supported functionality, limitations and update dates.",
      "Make security documentation, implementation details and pricing mechanics accessible.",
      "Publish comparison guides that explain trade-offs without inventing competitor defects.",
    ],
    researchQuestions: [
      "Which product modules are absent from role-specific recommendations?",
      "Which competing tools are suggested for our most profitable use case?",
      "Are integration and security claims represented accurately?",
      "Does visibility change for companies with different sizes and tech stacks?",
    ],
    cadence: "Add budget-cycle and conference-launch prompts only when they correspond to an active commercial moment.",
    cadenceShort: "Budget-cycle and conference-launch prompts only during an active commercial moment.",
    icon: "code",
  },
  {
    slug: "consumer-packaged-goods",
    name: "Consumer Packaged Goods",
    title: "Consumer Packaged Goods AI Search Prompt Guide",
    eyebrow: "CPG & everyday products",
    cardDescription: "Occasions, product lines, ingredients, household needs, packaging and retail availability.",
    lead: "People often ask AI assistants what to make, pack, clean or bring to an occasion rather than naming a product category directly. CPG prompt strategy should connect everyday jobs and constraints to the products a brand can genuinely serve.",
    metaDescription: "Build a consumer packaged goods AI search prompt library with 12 examples, industry tags, measurement methods, accuracy checks, and GEO recommendations.",
    sector: "consumer packaged goods",
    focusAreas: "occasion-led discovery, ingredient accuracy, retailer presence and product relevance",
    persona: "A shopper balancing convenience, diet, budget and store availability.",
    scenario: "A caregiver is planning five nut-aware school lunches with limited prep time and a fixed grocery budget.",
    prompts: [
      { topic: "Routine shopping", text: "Which pantry staples make weekday breakfasts faster for two working parents?", use: "Discovery" },
      { topic: "Usage occasion", text: "What drinks work well for an outdoor birthday picnic without needing refrigeration?", use: "Discovery" },
      { topic: "Dietary needs", text: "How can I compare dairy-free coffee creamers for sweetness and ingredient preferences?", use: "Education" },
      { topic: "Product comparison", text: "How should shoppers compare store-brand dish soap with premium options?", use: "Comparison" },
      { topic: "Launch awareness", text: "What should consumers compare when trying a newly released sparkling beverage line?", use: "Discovery" },
      { topic: "Ingredient accuracy", text: "Where can I confirm whether [product] contains [ingredient or allergen]?", use: "Fact check" },
      { topic: "Household constraint", text: "Which laundry products are suitable for people who prefer fragrance-free options?", use: "Discovery" },
      { topic: "Value proposition", text: "What is a fair way to compare cost per serving across breakfast cereals?", use: "Education" },
      { topic: "Packaging", text: "What evidence supports a claim that [product] packaging is recyclable in [region]?", use: "Fact check" },
      { topic: "Retail discovery", text: "Which stores around [city] commonly stock [product category]?", use: "Local" },
      { topic: "Seasonal shopping", text: "What shelf-stable snacks work for a summer road trip with children?", use: "Discovery" },
      { topic: "Brand validation", text: "What are the published ingredients and serving size for [brand] [product]?", use: "Validation" },
    ],
    refinement: {
      before: "Best snacks?",
      after: "I need five easy school-lunch snacks for a nut-aware classroom, prefer individually packaged options and shop at [retailer]. Which types of snacks should I compare and what label information should I check?",
    },
    tags: [
      { dimension: "Occasion", labels: ["breakfast", "school lunch", "party", "travel"] },
      { dimension: "Category", labels: ["snacks", "beverages", "cleaning", "personal care"] },
      { dimension: "Need", labels: ["allergen-aware", "low-sugar", "convenience", "budget"] },
      { dimension: "Retail context", labels: ["grocery", "club", "online", "regional store"] },
      { dimension: "Season", labels: ["back-to-school", "summer", "holiday", "everyday"] },
      { dimension: "Verification", labels: ["ingredients", "nutrition", "packaging", "availability"] },
    ],
    safeguard: "Never infer allergen safety, nutritional properties or sustainability credentials from branding alone; product labels and applicable certifications take precedence.",
    safeguardShort: "Labels and certifications, not branding, settle allergen, nutrition and sustainability claims.",
    sourceOfTruth: "Current product labels, ingredient and allergen statements, retailer listings, packaging specifications and approved claim documentation.",
    sourceRows: [
      { claim: "Product facts", source: "Current product labels" },
      { claim: "Ingredients and allergens", source: "Ingredient and allergen statements" },
      { claim: "Availability", source: "Retailer listings" },
      { claim: "Packaging", source: "Packaging specifications" },
      { claim: "Marketing claims", source: "Approved claim documentation" },
    ],
    actions: [
      "Create helpful occasion pages that explain shopping considerations, not only product slogans.",
      "Expose ingredients, allergens and serving information as readable HTML.",
      "Keep retailer and product availability data current and region-specific.",
      "Substantiate environmental and wellness claims with clear, accessible evidence.",
    ],
    researchQuestions: [
      "Which occasions produce competitor recommendations but omit our category?",
      "Are our product claims being summarized in ways the packaging does not support?",
      "Which retailer pages are cited for our products rather than owned pages?",
      "Where do customer needs differ between value, convenience and dietary segments?",
    ],
    cadence: "Build temporary prompt groups for school calendars, entertaining periods and seasonal product launches.",
    cadenceShort: "Temporary groups for school calendars, entertaining periods and seasonal launches.",
    icon: "package",
  },
  {
    slug: "financial-services",
    name: "Financial Services",
    title: "Financial Services AI Search Prompt Guide",
    eyebrow: "Banking, insurance & investing",
    cardDescription: "Cards, deposits, lending, small business, eligibility, fees and changing offers.",
    lead: "Money decisions are sensitive to personal circumstances, jurisdiction and product terms. A financial-services prompt library should distinguish useful brand discovery from factual checks of rates, eligibility, fees and disclosures.",
    metaDescription: "Build a financial services AI search prompt library with 12 examples, industry tags, measurement methods, accuracy checks, and GEO recommendations.",
    sector: "financial services",
    focusAreas: "product suitability, transparent terms, trust and jurisdiction-specific correctness",
    persona: "A consumer comparing products while trying to avoid fees and understand eligibility.",
    scenario: "A new small-business owner needs a checking account and a simple way to receive customer payments without unexpected transaction charges.",
    prompts: [
      { topic: "Checking discovery", text: "Which checking account features matter most to someone who receives income from multiple employers?", use: "Education" },
      { topic: "Savings comparison", text: "How should I compare savings accounts with different balance tiers and withdrawal rules?", use: "Evaluation" },
      { topic: "Beginner credit", text: "What should a first-time credit-card applicant compare besides rewards?", use: "Education" },
      { topic: "Travel cards", text: "Which no-foreign-transaction-fee card features are valuable for occasional international travel?", use: "Discovery" },
      { topic: "Small business", text: "What banking features matter to a freelancer who invoices international clients?", use: "Discovery" },
      { topic: "Mortgage readiness", text: "What expenses should a first-time homebuyer budget for beyond the monthly mortgage payment?", use: "Education" },
      { topic: "Loan trade-offs", text: "How do loan term, origination fee and APR change the total borrowing cost?", use: "Education" },
      { topic: "Insurance needs", text: "What coverage questions should renters ask when comparing insurance providers?", use: "Discovery" },
      { topic: "Promo verification", text: "Where can I verify the eligibility rules and expiry date of [brand] [offer]?", use: "Fact check" },
      { topic: "Service availability", text: "Which banking providers offer live support outside standard business hours?", use: "Discovery" },
      { topic: "Rate validation", text: "What is the current published APY and account eligibility for [brand] [product]?", use: "Validation" },
      { topic: "Seasonal needs", text: "What accounts should a small business revisit before year-end tax preparation?", use: "Education" },
    ],
    refinement: {
      before: "Which bank is best?",
      after: "I run a new service business with roughly 35 monthly customer payments and prefer low fees. Which business checking options should I compare, and what deposit, transaction and transfer limits matter?",
    },
    tags: [
      { dimension: "Product", labels: ["checking", "savings", "card", "mortgage", "insurance"] },
      { dimension: "Customer", labels: ["student", "first-time buyer", "family", "small business"] },
      { dimension: "Intent", labels: ["learn", "compare", "apply", "verify"] },
      { dimension: "Jurisdiction", labels: ["country", "state", "market"] },
      { dimension: "Timing", labels: ["tax season", "homebuying", "year-end", "evergreen"] },
      { dimension: "Review", labels: ["rate", "fees", "eligibility", "disclosures"] },
    ],
    safeguard: "Financial terms and eligibility can change quickly. Do not present illustrative comparisons as personalized investment, lending or tax advice.",
    safeguardShort: "Terms and eligibility change fast; illustrative comparisons are not personal advice.",
    sourceOfTruth: "Current provider fee schedules, product disclosures, rate sheets, eligibility requirements and regulator guidance.",
    sourceRows: [
      { claim: "Fees", source: "Current provider fee schedules" },
      { claim: "Product terms", source: "Product disclosures" },
      { claim: "Rates", source: "Rate sheets" },
      { claim: "Eligibility", source: "Eligibility requirements" },
      { claim: "Regulatory rules", source: "Regulator guidance" },
    ],
    actions: [
      "Publish comparison-ready pages showing definitions, eligibility and fees in context.",
      "Date sensitive promotional pages and archive expired offers rather than silently reusing them.",
      "Provide plain-language educational guides alongside official disclosures.",
      "Make local and jurisdictional restrictions clear wherever product terms differ.",
    ],
    researchQuestions: [
      "Which segments are missing from unbranded recommendations for our products?",
      "Are current fees or promotional terms misstated in generated answers?",
      "Which third-party comparison sources shape citations most often?",
      "Does the assistant distinguish education from personalized financial guidance?",
    ],
    cadence: "Review promotion and rate prompts at each product update; use separate seasonal sets for taxes and homebuying.",
    cadenceShort: "Promotion and rate prompts each product update; seasonal tax and homebuying sets.",
    icon: "bank",
  },
  {
    slug: "healthcare",
    name: "Healthcare",
    title: "Healthcare AI Search Prompt Guide",
    eyebrow: "Care delivery & patient access",
    cardDescription: "Specialties, insurance acceptance, appointment access, telehealth and local care.",
    lead: "People searching for care often have urgent practical questions: which service is appropriate, whether it is available, where to go and what insurance is accepted. Healthcare prompt monitoring must put patient safety and independently verified access information first.",
    metaDescription: "Build a healthcare AI search prompt library with 12 examples, industry tags, measurement methods, accuracy checks, and GEO recommendations.",
    sector: "healthcare",
    focusAreas: "care navigation, availability, access, clinical accuracy and patient trust",
    persona: "A patient trying to choose an appropriate care setting and appointment option.",
    scenario: "An adult wants a non-emergency evening appointment with a local clinician who accepts a specific health plan.",
    prompts: [
      { topic: "Specialty discovery", text: "How do I find a primary-care practice that offers preventive visits for working adults?", use: "Discovery" },
      { topic: "Service comparison", text: "When is a walk-in clinic more appropriate than a scheduled primary-care visit for a non-emergency concern?", use: "Education" },
      { topic: "Virtual care", text: "What questions should I ask before choosing a telehealth provider for a routine follow-up?", use: "Education" },
      { topic: "Insurance access", text: "How can I confirm that a clinic in [city] accepts my exact insurance plan?", use: "Validation" },
      { topic: "Hours and location", text: "Which urgent-care centers in [city] publish evening and weekend hours?", use: "Local" },
      { topic: "Caregiver needs", text: "Where can families compare pediatric practices offering school physicals?", use: "Discovery" },
      { topic: "New facility", text: "How can I verify the services and opening date of a new clinic in [neighborhood]?", use: "Fact check" },
      { topic: "Care coordination", text: "What features help patients choose a specialist practice for a referral?", use: "Education" },
      { topic: "Scheduling", text: "Which local providers explain how to book same-week routine appointments?", use: "Local" },
      { topic: "Service accuracy", text: "Does [clinic] publish verified hours, telehealth eligibility and contact details?", use: "Fact check" },
      { topic: "Seasonal care", text: "Where can I find official information about seasonal vaccination availability near [city]?", use: "Local" },
      { topic: "Accessibility", text: "Which clinics provide clear information on language support and accessible facilities?", use: "Discovery" },
    ],
    refinement: {
      before: "Best doctors near me?",
      after: "I need a routine primary-care appointment after 6 p.m. in [city], and I have [insurance plan]. What should I check when comparing local clinics, including appointment availability and in-network status?",
    },
    tags: [
      { dimension: "Service", labels: ["primary care", "specialist", "urgent care", "virtual care"] },
      { dimension: "Patient need", labels: ["routine", "follow-up", "caregiver", "accessibility"] },
      { dimension: "Location", labels: ["metro", "neighborhood", "region"] },
      { dimension: "Access", labels: ["insurance", "hours", "appointment type", "language"] },
      { dimension: "Season", labels: ["open enrollment", "winter", "back-to-school", "evergreen"] },
      { dimension: "Governance", labels: ["clinical review", "directory verified", "privacy reviewed"] },
    ],
    safeguard: "Clinical advice and triage content require qualified review. Do not imply that AI answers can determine whether an emergency needs immediate care.",
    safeguardShort: "Clinical and triage content needs qualified review; AI cannot judge emergencies.",
    sourceOfTruth: "Provider directory, scheduling system, current insurance contracts, validated service pages and licensed clinician review.",
    sourceRows: [
      { claim: "Clinicians and locations", source: "Provider directory" },
      { claim: "Appointment availability", source: "Scheduling system" },
      { claim: "Insurance accepted", source: "Current insurance contracts" },
      { claim: "Services offered", source: "Validated service pages" },
      { claim: "Clinical content", source: "Licensed clinician review" },
    ],
    actions: [
      "Keep provider directories, hours, contact details and insurance acceptance synchronized.",
      "Write service pages for patients in plain language and identify when an in-person evaluation may be needed.",
      "Add transparent appointment and accessibility information for each relevant location.",
      "Route medical content, promotional claims and scheduling assertions through clinical and compliance review.",
    ],
    researchQuestions: [
      "Which service lines are omitted from city-specific care navigation?",
      "What insurance or scheduling claims in answers are not supported by current directories?",
      "Which hospitals or clinics are recommended for non-emergency care and why?",
      "Do different language or accessibility requirements change results?",
    ],
    cadence: "Review flu-season, open-enrollment and school-physical prompts before the relevant public scheduling window.",
    cadenceShort: "Flu-season, open-enrollment and school-physical prompts before each scheduling window.",
    icon: "heartPulse",
  },
  {
    slug: "pharma-life-sciences",
    name: "Pharma & Life Sciences",
    title: "Pharma & Life Sciences AI Search Prompt Guide",
    eyebrow: "Biopharma, research & treatment education",
    cardDescription: "Condition education, treatment classes, evidence, safety, patient support and HCP information.",
    lead: "Questions about a condition, a treatment class and a named therapy are not interchangeable. A strong life-sciences AI monitoring program segments the audience, protects scientific accuracy and applies formal medical, legal and regulatory governance.",
    metaDescription: "Build a pharma & life sciences AI search prompt library with 12 examples, industry tags, measurement methods, accuracy checks, and GEO recommendations.",
    sector: "pharma & life sciences",
    focusAreas: "unbranded education, evidence integrity, label consistency and audience separation",
    persona: "A patient or caregiver researching general treatment pathways, separate from a clinician reviewing evidence.",
    scenario: "A patient with a chronic condition wants to understand the categories of treatment available and which questions to discuss with a licensed specialist.",
    prompts: [
      { topic: "Condition literacy", text: "What reliable sources explain the symptoms and typical diagnostic pathway for [condition]?", use: "Education" },
      { topic: "Care journey", text: "What questions can patients prepare before a specialist visit about [condition]?", use: "Education" },
      { topic: "Treatment classes", text: "How do clinicians generally categorize treatment approaches used for [condition]?", use: "Education" },
      { topic: "Evidence quality", text: "What distinguishes a randomized clinical trial from an observational study?", use: "Education" },
      { topic: "HCP research", text: "Where can a prescriber review the latest approved labeling for [treatment class]?", use: "Validation" },
      { topic: "Patient resources", text: "What types of patient education support exist after a diagnosis of [condition]?", use: "Discovery" },
      { topic: "Access and coverage", text: "What information should patients verify with their insurer about a prescribed treatment?", use: "Education" },
      { topic: "Safety source", text: "Where can readers find official safety communications for [therapy]?", use: "Fact check" },
      { topic: "Branded validation", text: "What is the current approved indication for [brand] in [jurisdiction]?", use: "Fact check" },
      { topic: "Scientific congress", text: "Where can professionals locate abstracts from [conference] about [condition]?", use: "Discovery" },
      { topic: "Clinical trial navigation", text: "How can patients find eligibility information for registered studies of [condition]?", use: "Education" },
      { topic: "Caregiver lens", text: "What practical questions can caregivers ask about treatment monitoring for [condition]?", use: "Education" },
    ],
    refinement: {
      before: "What medicine works for [condition]?",
      after: "I have recently been diagnosed with [condition]. What treatment approaches are commonly discussed for adults, what trade-offs should I ask a specialist about, and where can I read reliable patient information?",
    },
    tags: [
      { dimension: "Audience", labels: ["patient", "caregiver", "HCP", "researcher"] },
      { dimension: "Scope", labels: ["condition", "treatment class", "brand", "competitor"] },
      { dimension: "Evidence", labels: ["label", "trial", "guideline", "safety alert"] },
      { dimension: "Lifecycle", labels: ["diagnosis", "treatment planning", "monitoring", "support"] },
      { dimension: "Geography", labels: ["US", "EU", "other approved market"] },
      { dimension: "Review", labels: ["MLR approved", "safety", "indication", "dated"] },
    ],
    safeguard: "All indication, contraindication, dosing, efficacy and safety content requires qualified medical/legal/regulatory review. Prompts here are for research and monitoring, not treatment recommendations.",
    safeguardShort: "Indication, dosing, efficacy and safety content needs medical, legal and regulatory review.",
    sourceOfTruth: "Current approved labeling, regulatory safety communications, peer-reviewed evidence, trial registries and approved patient materials.",
    sourceRows: [
      { claim: "Indications and dosing", source: "Current approved labeling" },
      { claim: "Safety", source: "Regulatory safety communications" },
      { claim: "Efficacy evidence", source: "Peer-reviewed evidence" },
      { claim: "Clinical trials", source: "Trial registries" },
      { claim: "Patient information", source: "Approved patient materials" },
    ],
    actions: [
      "Clearly separate disease education from branded product content and claims.",
      "Show publication, review and evidence dates on scientific summaries.",
      "Keep approved labeling and safety information accessible and market-specific.",
      "Create documented medical, legal and regulatory approval paths for monitored and public content.",
    ],
    researchQuestions: [
      "Which condition questions generate unsupported treatment claims?",
      "Are branded indications being confused with class-level information?",
      "Which authoritative guideline and regulatory sources appear as citations?",
      "How do patient and prescriber answers differ in scientific depth and accuracy?",
    ],
    cadence: "Introduce prompts for approved label updates, safety notices and scientific meetings only after formal content review.",
    cadenceShort: "Label updates, safety notices and scientific meetings, only after formal review.",
    icon: "flask",
  },
  {
    slug: "publishing-media",
    name: "Publishing & Media",
    title: "Publishing & Media AI Search Prompt Guide",
    eyebrow: "News, newsletters & subscriptions",
    cardDescription: "Editorial beats, audience needs, newsletters, podcasts, membership value and news cycles.",
    lead: "Media brands compete for discovery at the moment a reader asks an AI assistant whom to trust or follow for a topic. The right prompt set measures editorial relevance, source attribution and subscription facts without treating every breaking story as an evergreen metric.",
    metaDescription: "Build a publishing & media AI search prompt library with 12 examples, industry tags, measurement methods, accuracy checks, and GEO recommendations.",
    sector: "publishing & media",
    focusAreas: "editorial authority, topic coverage, citations, creator discoverability and subscription details",
    persona: "A reader seeking reliable coverage in a preferred format and cadence.",
    scenario: "An industry analyst wants two concise weekly newsletters covering energy policy with primary-source links and clear analysis.",
    prompts: [
      { topic: "Beat discovery", text: "Which independent publications offer detailed reporting on local climate adaptation?", use: "Discovery" },
      { topic: "Newsletters", text: "What newsletters provide a short weekly briefing on enterprise cybersecurity policy?", use: "Discovery" },
      { topic: "Podcasts", text: "Which interview podcasts regularly feature researchers discussing energy infrastructure?", use: "Discovery" },
      { topic: "Deep reporting", text: "Where can I find long-form investigations into regional water policy?", use: "Discovery" },
      { topic: "Editorial comparison", text: "How do [publication A] and [publication B] differ in reporting style and audience?", use: "Comparison" },
      { topic: "Subscription value", text: "What should a reader compare before subscribing to a specialist business newsletter?", use: "Education" },
      { topic: "Price verification", text: "Where does [publication] list its current digital subscription and cancellation terms?", use: "Fact check" },
      { topic: "Breaking events", text: "Which outlets publish time-stamped live coverage of [event]?", use: "Discovery" },
      { topic: "Source attribution", text: "What primary sources support recent reporting on [policy topic]?", use: "Education" },
      { topic: "Media formats", text: "Which publications cover [beat] through both articles and podcasts?", use: "Discovery" },
      { topic: "Trust signal", text: "How can a reader verify a newsroom correction or editorial standards policy?", use: "Education" },
      { topic: "Audience fit", text: "Which technology publications are helpful for non-technical founders?", use: "Discovery" },
    ],
    refinement: {
      before: "Best newsletters?",
      after: "I work in energy strategy and want two weekly newsletters that explain new US energy regulation with source links and minimal opinion. Which publications or writers should I evaluate?",
    },
    tags: [
      { dimension: "Beat", labels: ["politics", "business", "climate", "technology"] },
      { dimension: "Format", labels: ["newsletter", "podcast", "article", "report"] },
      { dimension: "Audience", labels: ["executive", "specialist", "general", "student"] },
      { dimension: "Need", labels: ["briefing", "deep dive", "live updates", "analysis"] },
      { dimension: "Cycle", labels: ["evergreen", "election", "earnings", "conference"] },
      { dimension: "Validation", labels: ["pricing", "cadence", "byline", "corrections"] },
    ],
    safeguard: "News-driven facts expire rapidly; keep reporting dates visible, verify current subscription prices and distinguish reporting from commentary.",
    safeguardShort: "News facts expire fast; show dates, verify prices, separate commentary.",
    sourceOfTruth: "Publication archive, editorial masthead, podcast feed, subscription terms, publication schedule and correction policy.",
    sourceRows: [
      { claim: "Coverage history", source: "Publication archive" },
      { claim: "Editors and bylines", source: "Editorial masthead" },
      { claim: "Podcast episodes", source: "Podcast feed" },
      { claim: "Subscription details", source: "Subscription terms" },
      { claim: "Publishing cadence", source: "Publication schedule" },
      { claim: "Corrections", source: "Correction policy" },
    ],
    actions: [
      "Build durable topic hubs with clear reporting dates, bylines and source links.",
      "Give newsletters and podcasts indexable landing pages with representative editions.",
      "Clarify free versus paid features and current membership terms.",
      "Maintain corrections, editorial standards and primary-source links in a discoverable form.",
    ],
    researchQuestions: [
      "Which beats lead to competitor citations while our reporting is absent?",
      "Are assistants attributing original reporting to aggregators?",
      "Which formats are recommended for each audience segment?",
      "Are cadence, archive availability and subscription terms accurate?",
    ],
    cadence: "Use separate short-lived collections for elections, awards and major events, with expiry and archival rules.",
    cadenceShort: "Short-lived sets for elections, awards and major events, with expiry rules.",
    icon: "newspaper",
  },
  {
    slug: "retail",
    name: "Retail & E-commerce",
    title: "Retail & E-commerce AI Search Prompt Guide",
    eyebrow: "Commerce & product discovery",
    cardDescription: "Category shopping, gifts, value, private labels, delivery promises and campaigns.",
    lead: "Commerce prompts start with an outcome: a gift, a budget, an occasion or a product problem. An effective retail prompt library tests whether AI assistants connect those constraints to relevant brands, products and reliable fulfillment information.",
    metaDescription: "Build a retail & e-commerce AI search prompt library with 12 examples, industry tags, measurement methods, accuracy checks, and GEO recommendations.",
    sector: "retail & e-commerce",
    focusAreas: "product relevance, price and inventory accuracy, discoverability and fulfillment trust",
    persona: "A shopper comparing products within a budget and delivery constraint.",
    scenario: "A customer needs an affordable practical housewarming gift, wants delivery in four days and prefers easy returns.",
    prompts: [
      { topic: "Category discovery", text: "Which compact home-office accessories improve a desk setup without taking much space?", use: "Discovery" },
      { topic: "Budget filtering", text: "What are good gifts for a new apartment under $70?", use: "Discovery" },
      { topic: "Feature comparison", text: "What matters when comparing cordless vacuums for pet hair on hard floors?", use: "Evaluation" },
      { topic: "Private label", text: "How should shoppers compare a retailer-owned kitchen appliance with established brands?", use: "Comparison" },
      { topic: "Availability", text: "How can I check whether [product] is available for pickup near [city]?", use: "Validation" },
      { topic: "Delivery reliability", text: "What shipping and delivery details should I verify before a last-minute gift purchase?", use: "Education" },
      { topic: "Returns", text: "Where can I confirm the return window for [retailer] [category]?", use: "Fact check" },
      { topic: "New releases", text: "Which features have changed in the latest generation of [product type]?", use: "Discovery" },
      { topic: "Seasonal gifting", text: "What useful gifts work for a remote-working graduate under $100?", use: "Discovery" },
      { topic: "Promotions", text: "What is a reliable way to compare a sale price with recent everyday prices?", use: "Education" },
      { topic: "Material claims", text: "How can I verify that [product] uses [material] as described?", use: "Fact check" },
      { topic: "Buying channels", text: "What are the trade-offs between ordering [category] directly from a brand and from a marketplace?", use: "Evaluation" },
    ],
    refinement: {
      before: "Best gifts online?",
      after: "What practical housewarming gifts under $70 would suit a small apartment, can arrive in [city] within four days and are easy to return if duplicated?",
    },
    tags: [
      { dimension: "Category", labels: ["home", "beauty", "electronics", "fashion"] },
      { dimension: "Intent", labels: ["browse", "compare", "gift", "purchase"] },
      { dimension: "Budget", labels: ["under-50", "50-100", "premium"] },
      { dimension: "Retailer type", labels: ["direct", "marketplace", "store", "private label"] },
      { dimension: "Campaign", labels: ["launch", "holiday", "clearance", "evergreen"] },
      { dimension: "Validation", labels: ["inventory", "returns", "delivery", "materials"] },
    ],
    safeguard: "Prices, stock, delivery promises and returns may vary by location and date; verify before presenting them as live facts.",
    safeguardShort: "Prices, stock, delivery and returns vary by location and date.",
    sourceOfTruth: "Current product detail pages, catalog feeds, stock status, delivery estimates, return policies and product labeling.",
    sourceRows: [
      { claim: "Product details", source: "Current product detail pages" },
      { claim: "Catalog data", source: "Catalog feeds" },
      { claim: "Stock", source: "Stock status" },
      { claim: "Delivery times", source: "Delivery estimates" },
      { claim: "Returns", source: "Return policies" },
      { claim: "Labeling", source: "Product labeling" },
    ],
    actions: [
      "Structure category and product pages around selection criteria and use cases.",
      "Publish current shipping, returns, availability and product details as crawlable text.",
      "Add buying guides that help shoppers understand trade-offs, not only rankings.",
      "Clearly mark promotion dates and product variants to prevent stale AI summaries.",
    ],
    researchQuestions: [
      "Which competitors appear for high-intent gift and budget prompts?",
      "Does AI cite category guides, product pages or third-party marketplaces?",
      "Which fulfillment facts about the store are inaccurate?",
      "How does recommendation visibility change across budgets and buyer needs?",
    ],
    cadence: "Launch temporary tracking sets before major promotions, and remove them after the sale or season ends.",
    cadenceShort: "Temporary sets before major promotions, removed after the sale or season.",
    icon: "cart",
  },
  {
    slug: "telecom",
    name: "Telecom & Communications",
    title: "Telecom & Communications AI Search Prompt Guide",
    eyebrow: "Mobile, broadband & connectivity",
    cardDescription: "Plan comparisons, coverage geography, home internet, switching, bundles and device launches.",
    lead: "Connectivity decisions depend on location, household size, data usage and contract terms. For telecom brands, generic national recommendations can conceal important local gaps; Echorank prompts should test the combinations customers actually face.",
    metaDescription: "Build a telecom & communications AI search prompt library with 12 examples, industry tags, measurement methods, accuracy checks, and GEO recommendations.",
    sector: "telecom & communications",
    focusAreas: "location-specific coverage, transparent costs, plan suitability and switching friction",
    persona: "A household comparing mobile and home internet service in a particular area.",
    scenario: "Four people share a family plan; two use mobile hotspots regularly and the household needs stronger signal at home.",
    prompts: [
      { topic: "Family plan discovery", text: "What mobile plan features matter most for a household with four lines and heavy streaming?", use: "Discovery" },
      { topic: "Local coverage", text: "How can residents compare cellular coverage in [city] and nearby rural areas?", use: "Local" },
      { topic: "Home broadband", text: "What should renters compare when choosing fiber, cable or fixed wireless internet?", use: "Education" },
      { topic: "Speed needs", text: "How much download and upload capacity might a household with two remote workers need?", use: "Education" },
      { topic: "Switching", text: "What should a customer check before transferring numbers to a new carrier?", use: "Education" },
      { topic: "Bundle trade-offs", text: "When is combining home internet and mobile service worthwhile?", use: "Evaluation" },
      { topic: "Device financing", text: "How do device installment agreements affect the cost of switching plans?", use: "Evaluation" },
      { topic: "Business connectivity", text: "Which connectivity features matter to a small shop using cloud point-of-sale?", use: "Discovery" },
      { topic: "Promotion review", text: "Where can I verify the expiry and eligibility of [carrier] switching incentives?", use: "Fact check" },
      { topic: "Coverage accuracy", text: "What does [carrier] publish about coverage limitations in [city]?", use: "Validation" },
      { topic: "International use", text: "What roaming plan details should frequent travelers compare?", use: "Discovery" },
      { topic: "Accessibility", text: "Which telecom providers explain accessibility and customer-service support options?", use: "Discovery" },
    ],
    refinement: {
      before: "Best phone carrier?",
      after: "Our family of four lives in [city], uses two mobile hotspots and wants to spend under [budget] monthly. Which carriers and plan features should we compare, and how can we verify coverage at our address?",
    },
    tags: [
      { dimension: "Service", labels: ["mobile", "fiber", "cable", "fixed wireless"] },
      { dimension: "Segment", labels: ["family", "student", "business", "traveler"] },
      { dimension: "Geography", labels: ["city", "ZIP", "rural", "national"] },
      { dimension: "Decision", labels: ["new service", "switching", "upgrade", "renewal"] },
      { dimension: "Campaign", labels: ["device release", "bundle offer", "switcher promotion"] },
      { dimension: "Verification", labels: ["coverage", "price", "speed", "fees"] },
    ],
    safeguard: "Coverage maps and estimated speeds cannot guarantee performance at a specific address. Promotions and switching fees require date-specific verification.",
    safeguardShort: "Coverage maps cannot guarantee an address; date-check promotions and switching fees.",
    sourceOfTruth: "Current carrier coverage maps, plan terms, service addresses, speed disclosures, promotions and device financing agreements.",
    sourceRows: [
      { claim: "Coverage", source: "Current carrier coverage maps" },
      { claim: "Plan details", source: "Plan terms" },
      { claim: "Service at an address", source: "Service addresses" },
      { claim: "Speeds", source: "Speed disclosures" },
      { claim: "Offers", source: "Promotions" },
      { claim: "Device costs", source: "Device financing agreements" },
    ],
    actions: [
      "Write market-specific service pages with coverage caveats and useful alternatives.",
      "Make total monthly cost, taxes, fees and promotional expiry transparent.",
      "Explain switching, number portability and device-financing rules with scenarios.",
      "Keep plan comparison tables up to date and easy for crawlers to read.",
    ],
    researchQuestions: [
      "Which carriers dominate our priority ZIP codes in unbranded prompts?",
      "What coverage or speed claims are presented without qualifications?",
      "Are switching costs and promotional conditions described correctly?",
      "Which customer segments cause the recommended plan to change?",
    ],
    cadence: "Revisit device-launch and promotional prompts around major release periods while maintaining a stable evergreen plan set.",
    cadenceShort: "Device-launch and promotional prompts around releases; keep an evergreen plan set.",
    icon: "router",
  },
  {
    slug: "travel-hospitality",
    name: "Travel & Hospitality",
    title: "Travel & Hospitality AI Search Prompt Guide",
    eyebrow: "Destinations, hotels & travel planning",
    cardDescription: "Destination discovery, trip styles, loyalty, amenities, cancellation and event dates.",
    lead: "Travel prompts combine inspiration with real-world constraints: destination, trip purpose, dates, accessibility, budget and policies. A hospitality prompt set should reveal when AI recommends a destination or property—and whether the supporting details remain accurate.",
    metaDescription: "Build a travel & hospitality AI search prompt library with 12 examples, industry tags, measurement methods, accuracy checks, and GEO recommendations.",
    sector: "travel & hospitality",
    focusAreas: "destination relevance, property differentiation, booking confidence and source accuracy",
    persona: "A traveler planning a trip with specific dates, budget and accessibility needs.",
    scenario: "Two adults planning a four-night city break want a walkable neighborhood, late check-in and flexible cancellation.",
    prompts: [
      { topic: "Destination discovery", text: "Which neighborhoods in [destination] are convenient for a first-time visitor without a car?", use: "Discovery" },
      { topic: "Family travel", text: "What hotel amenities help a family traveling with a toddler in [destination]?", use: "Discovery" },
      { topic: "Business stays", text: "Which hotels near [venue] are practical for early-morning meetings and reliable Wi-Fi?", use: "Local" },
      { topic: "Romantic trips", text: "What should couples compare when choosing a quiet boutique hotel for an anniversary?", use: "Education" },
      { topic: "Budget fit", text: "Which types of accommodation suit a four-night stay in [destination] under [budget]?", use: "Discovery" },
      { topic: "Loyalty choice", text: "How should frequent travelers compare hotel loyalty benefits beyond points earning?", use: "Evaluation" },
      { topic: "Cancellation", text: "How do flexible and nonrefundable hotel rates differ in practical risk?", use: "Education" },
      { topic: "Property accuracy", text: "Where can I verify whether [hotel] provides accessible rooms and airport transfers?", use: "Fact check" },
      { topic: "Event season", text: "How does [festival or event] usually affect accommodation planning in [destination]?", use: "Education" },
      { topic: "Seasonality", text: "What trade-offs come with visiting [destination] in the shoulder season?", use: "Discovery" },
      { topic: "New opening", text: "What should guests verify about a newly opened property before booking?", use: "Validation" },
      { topic: "Group travel", text: "What lodging options work for a group needing separate rooms and a shared meeting space?", use: "Discovery" },
    ],
    refinement: {
      before: "Best hotels in [destination]?",
      after: "We are visiting [destination] for four nights in [month]. Which walkable neighborhoods and hotel types fit a [budget] nightly cap, late arrival and flexible cancellation?",
    },
    tags: [
      { dimension: "Destination", labels: ["city", "region", "resort", "venue"] },
      { dimension: "Trip type", labels: ["business", "family", "romantic", "group"] },
      { dimension: "Booking stage", labels: ["inspiration", "comparison", "booking", "pre-arrival"] },
      { dimension: "Constraint", labels: ["budget", "accessibility", "cancellation", "transport"] },
      { dimension: "Season", labels: ["summer", "holiday", "festival", "shoulder"] },
      { dimension: "Verification", labels: ["amenities", "fees", "rate terms", "availability"] },
    ],
    safeguard: "Room rates, availability, events and cancellation terms vary by date and booking channel; verify before calling offers current.",
    safeguardShort: "Rates, availability, events and cancellation terms vary by date and channel.",
    sourceOfTruth: "Official hotel amenities, property and destination pages, booking conditions, rate disclosures, local event calendars and accessibility statements.",
    sourceRows: [
      { claim: "Amenities", source: "Official hotel amenities" },
      { claim: "Property and destination", source: "Property and destination pages" },
      { claim: "Booking and cancellation", source: "Booking conditions" },
      { claim: "Rates", source: "Rate disclosures" },
      { claim: "Event dates", source: "Local event calendars" },
      { claim: "Accessibility", source: "Accessibility statements" },
    ],
    actions: [
      "Create destination and property pages that answer concrete traveler questions.",
      "Make room facilities, cancellation terms, fees and accessibility details prominent.",
      "Publish event-specific travel guides with dates and update timestamps.",
      "Use consistent property descriptions across owned pages and major booking channels.",
    ],
    researchQuestions: [
      "Which destinations and trip types lead to competitor recommendations?",
      "Where are amenities or cancellation terms misrepresented?",
      "Which travel guides or OTAs receive citations instead of our property pages?",
      "How do results change by dates, budget and party composition?",
    ],
    cadence: "Create event and holiday prompt clusters ahead of booking windows, then retire or archive outdated date-bound questions.",
    cadenceShort: "Event and holiday clusters before booking windows; retire outdated date-bound questions.",
    icon: "plane",
  },
];

// ── Shared guide copy: identical on all ten guides in the package, stored once ──

export interface GuideSection {
  id: "strategy" | "topics" | "refinement" | "categories" | "tags" | "measurement" | "actions" | "research" | "plan" | "faq";
  toc: string;
  h2: string;
}

/** The ten sections, in page order. The TOC and the headings both read this. */
export const GUIDE_SECTIONS: readonly GuideSection[] = [
  { id: "strategy", toc: "Strategy", h2: "1. Start with the decisions customers make" },
  { id: "topics", toc: "Prompt examples", h2: "2. Copy and adapt the core prompt library" },
  { id: "refinement", toc: "Better questions", h2: "3. Make a broad prompt decision-ready" },
  { id: "categories", toc: "Prompt types", h2: "4. Use different prompts for different questions" },
  { id: "tags", toc: "Tags & segments", h2: "5. Organize the library with reusable tags" },
  { id: "measurement", toc: "Measurement", h2: "6. Evaluate answers, citations and factual quality" },
  { id: "actions", toc: "SEO / GEO actions", h2: "7. Turn findings into SEO and GEO improvements" },
  { id: "research", toc: "Research questions", h2: "8. Ask better questions during your visibility review" },
  { id: "plan", toc: "30-day plan", h2: "9. A practical 30-day rollout" },
  { id: "faq", toc: "FAQ", h2: "10. Common questions" },
];

/** §4: one role per question, defined before it runs. */
export const PROMPT_ROLES: readonly { role: string; howToWrite: string; whatToMeasure: string }[] = [
  { role: "Unbranded discovery", howToWrite: "Describe the need without naming your organization.", whatToMeasure: "Spontaneous brand inclusion and recommendation context." },
  { role: "Head-to-head comparison", howToWrite: "Name options and give a fair, specific buying situation.", whatToMeasure: "Trade-offs, preferred options and competitor framing." },
  { role: "Branded validation", howToWrite: "Ask whether a named product, provider or publisher meets a requirement.", whatToMeasure: "Completeness and correctness of brand-specific answers." },
  { role: "Factual verification", howToWrite: "Test a precise, externally verifiable claim.", whatToMeasure: "Whether facts match dated authoritative records." },
];

/** §6: the scorecard. Definitions only; the pages state no measured value. */
export const SCORECARD: readonly { measure: string; definition: string; note: string }[] = [
  { measure: "Unaided mention rate", definition: "Unbranded runs that name your brand ÷ eligible unbranded runs.", note: "Exclude branded validation questions." },
  { measure: "Recommendation rate", definition: "Eligible runs that explicitly suggest your brand ÷ eligible runs.", note: "A passing mention does not count as a recommendation." },
  { measure: "Owned-site citation rate", definition: "Runs with a linked owned-domain source ÷ runs where sources are available.", note: "Preserve exact URLs where shown." },
  { measure: "Claim accuracy", definition: "Verified claims divided by claims selected for independent review.", note: "Report uncertain and unverified claims separately." },
  { measure: "Competitor presence", definition: "Frequency of other brands in comparable prompt groups.", note: "Record use case and context, not just name counts." },
];

/** §6 graphic: the stages the scorecard separates. Labels only — there is no data behind them. */
export const MEASUREMENT_STAGES: readonly string[] = ["Mentioned", "Recommended", "Cited (owned site)", "Accurate"];

/** §9: the four-week rollout. */
export const ROLLOUT_PLAN: readonly { when: string; focus: string; deliverable: string }[] = [
  { when: "Week 1", focus: "Choose priority products, customer decisions and prompt types. Agree on segment tags.", deliverable: "Reviewed prompt inventory and baseline definition." },
  { when: "Week 2", focus: "Run comparable queries, capture full responses and URLs, and flag factual claims.", deliverable: "Segmented observation log." },
  { when: "Week 3", focus: "Review facts against primary sources and identify page-level information gaps.", deliverable: "Risk-ranked content and technical backlog." },
  { when: "Week 4", focus: "Implement initial fixes; rerun stable prompts and document differences.", deliverable: "First monitoring memo and next-quarter plan." },
];

/**
 * §7 "Prioritize the work". The issues are the package's two lists, verbatim;
 * `why` (≤ 10 words) is written here and restates the package's own reasoning
 * on the same page.
 */
export const FIX_BUILD: readonly { priority: "Fix now" | "Build next"; issue: string; why: string }[] = [
  { priority: "Fix now", issue: "Unsupported high-risk facts in AI answers", why: "High-risk claims need evidence before anyone relies on them." },
  { priority: "Fix now", issue: "Wrong live policy, availability or specification data", why: "Buyers act on live details; stale ones mislead decisions." },
  { priority: "Fix now", issue: "Core information hidden behind inaccessible scripts", why: "Crawlers and assistants cannot use what they cannot read." },
  { priority: "Build next", issue: "Helpful answer-focused pages for missed customer needs", why: "Covers the customer needs that answers currently miss." },
  { priority: "Build next", issue: "Clear comparison tables and product or service details", why: "Gives assistants explicit, checkable facts to compare." },
  { priority: "Build next", issue: "Stronger authority, authorship and evidence signals", why: "Makes it clear who stands behind each claim." },
];

/** §10. The FAQPage JSON-LD is built from this same array. */
export const GUIDE_FAQ: readonly { q: string; a: string }[] = [
  {
    q: "How many prompts should we begin with?",
    a: "Start with the 12 examples above as inspiration, but monitor only the topics your organization can act on. Add variants once you know which segments drive useful decisions. A small, well-labeled library is easier to interpret than hundreds of repetitive questions.",
  },
  {
    q: "Should our brand name appear in the prompt?",
    a: "Not when your goal is to measure unaided discovery. Use your name for product-specific verification, factual checks and fair comparisons. Report those prompt types separately.",
  },
  {
    q: "Can stronger website content guarantee an AI recommendation?",
    a: "No. Clear, accurate and crawlable pages help assistants and search engines interpret information, but provider behavior, retrieval, grounding and answer generation differ. Track observations over time and treat every recommendation as a measured outcome, not a promise.",
  },
];

/** Every other line of guide-page copy that is the same on all ten guides. */
export const GUIDE_COPY = {
  crumbHub: "Prompt setup guides",
  chips: (promptCount: number) => [`${promptCount} ready-to-adapt prompts`, "Industry playbook", "AI visibility + GEO"],
  print: "Print / Save PDF",
  tocTitle: "Contents",
  strategy: {
    focusPrefix: "The objective is to understand whether an AI assistant connects the right brand, product or service to a real decision. In this sector, start with",
    personaH: "Who is asking?",
    scenarioH: "A realistic situation",
    body: "Choose a manageable set of buyer problems rather than tracking hundreds of near-identical queries. Include questions for initial education, supplier discovery, evaluation and verification. Separate unbranded recommendations from prompts that already contain your product or company name.",
    calloutTitle: "Echorank perspective",
    calloutBody: "Use prompts to locate content and visibility gaps, not to manufacture flattering answers. If an assistant cannot support its recommendation with clear evidence, record that uncertainty as part of the result.",
  },
  topics: {
    introBefore: (sector: string) => `This starter library covers the most important research and purchase contexts for ${sector}. Replace terms in square brackets with real locations, products, use cases or current dates. Treat the prompts as`,
    introStrong: "examples for your research program",
    introAfter: ", not as observed user-search-volume data.",
    tools: (n: number) => `${n} distinct questions · Search and answer engines may respond differently.`,
    copyAll: (n: number) => `Copy all ${n} prompts`,
    head: ["Topic", "Natural-language prompt", "Use", "Copy"],
    mixTitle: "Prompt mix",
    copy: "Copy",
  },
  refinement: {
    intro: "A useful prompt contains enough context to make a recommendation meaningful. Instead of stacking keywords, describe the job to be done, the important constraints and the kind of answer a buyer actually needs.",
    beforeLabel: "Before · too general",
    afterLabel: "After · specific and testable",
    arrow: "Add a real situation",
    note: "This is a synthetic example created for monitoring design; it is not evidence that people use precisely this wording.",
    h3: "What to vary, and what to keep stable",
    varyBefore: "Run an initial prompt as written and keep that wording fixed when comparing historical results. Then create",
    varyStrong: "separate named variants",
    varyAfter: "for audience, region, price range, urgency or other constraints. Document the new variant rather than overwriting the original question.",
    additions: [
      { label: "Buyer", question: "Who needs the answer?" },
      { label: "Context", question: "What situation changes the fit?" },
      { label: "Constraint", question: "Which limit is non-negotiable?" },
      { label: "Outcome", question: "What decision must AI support?" },
    ],
  },
  categories: {
    intro: "Mixing prompt types into a single visibility number can make performance look stronger than it is. Define a role for each question before you run it.",
    head: ["Prompt role", "How to write it", "What to measure"],
    after: "Keep the platform, country or city, language and run date alongside each answer. An assistant's output can vary by context and repeated runs; one result should not be treated as an established ranking.",
  },
  tags: {
    intro: "Use topic names to describe the underlying need and tags to group experiments across teams and campaigns. A single prompt can carry several tags, but avoid adding overlapping labels that make reports hard to interpret.",
    head: ["Dimension", "Suggested labels"],
    after: "For a first test, choose two or three labels per question. Review the taxonomy after initial reporting so future trends can be compared without redefining the segment every month.",
  },
  measurement: {
    intro: "Use a consistent scorecard that distinguishes whether a brand appears from whether it is recommended and whether its claims are trustworthy. Interpret results by topic and platform; avoid implying that a citation is guaranteed merely because a page is crawlable.",
    head: ["Measure", "Working definition", "Review note"],
    safeguardTitle: "Industry verification safeguard",
    sotH3: "Source of truth",
    sotHead: ["Claim type", "Authoritative source", "What to log"],
    whatToLog: "URL or document version + verification date",
    sotTail: "Record the source URL or document version and verification date when an answer makes a material factual claim.",
  },
  actions: {
    intro: "After baseline testing, connect the missing answers to real website improvements. Echorank's technical SEO and GEO lens prioritizes content that is accessible to crawlers, easy for visitors to understand and supported by reliable evidence.",
    h3: "Prioritize the work",
    head: ["Priority", "Issue", "Why it matters"],
  },
  research: {
    introBefore: "Use these prompts in a research meeting or with an assistant that has access to your",
    introEm: "actual collected answers",
    introAfter: ". They are analysis prompts—not evidence that Echorank has automatically performed the analyses.",
    head: ["Question for the research team", "Copy"],
    after: "When requesting analysis, provide the underlying response exports, prompt definitions, dates and geographic scope. Without those inputs, a model should not invent visibility rates or competitor findings.",
  },
  plan: {
    head: ["When", "Focus", "Deliverable"],
    cadenceH3: "Cadence for this sector",
    cadenceTail: "Keep one evergreen panel of prompts stable so short-term campaigns do not erase your longer-term trend.",
  },
  cta: {
    h2: "Turn prompt research into a clearer search strategy.",
    body: "Run Echorank's free audit to find technical readiness issues, then use this guide to plan the questions worth monitoring.",
  },
  related: "Explore related guides",
  prev: "Previous industry",
  next: "Next industry",
  copied: "Copied to clipboard",
  copyFailed: "Copy failed — select the text instead",
} as const;

// ── Hub copy ──

/** The hub's four-step method (Map → Draft → Observe → Improve). */
export const METHOD_STEPS: readonly { num: string; verb: string; title: string; body: string }[] = [
  { num: "01", verb: "Map", title: "Choose decisions", body: "Start with product categories, high-value customer problems, service areas, and the audiences who ask." },
  { num: "02", verb: "Draft", title: "Write natural prompts", body: "Use everyday language, budgets and constraints. Keep discovery prompts free of your brand name." },
  { num: "03", verb: "Observe", title: "Collect responses", body: "Log the AI platform, locale, run date, brand mentions, recommendations, sources, and factual issues." },
  { num: "04", verb: "Improve", title: "Fix what matters", body: "Prioritize inaccurate facts, unavailable source pages, weak comparison content and missing user needs." },
];

/** The hub's three prompt modes; fact checking is the fourth, as a callout. */
export const PROMPT_MODES: readonly { num: string; title: string; body: string }[] = [
  { num: "01", title: "Discovery", body: "Ask who or what an assistant recommends without naming your brand. Useful for independent inclusion in a shortlist." },
  { num: "02", title: "Comparison", body: "Give the assistant realistic choices and a buyer situation. Examine which trade-offs influence its recommendation." },
  { num: "03", title: "Validation", body: "Use a named brand, product or location to check whether an answer describes its capabilities correctly." },
];

/** The hub's measurement principles. */
export const MEASUREMENT_PRINCIPLES: readonly { signal: string; question: string; rule: string }[] = [
  { signal: "Unaided mention", question: "Is the brand named without a branded prompt?", rule: "Count only unbranded discovery and comparison questions." },
  { signal: "Recommendation", question: "Is the brand positively suggested for the need?", rule: "Distinguish a true recommendation from a passing mention." },
  { signal: "Owned-source citation", question: "Does the answer reference the brand's own website?", rule: "Capture the URL when the platform exposes citations." },
  { signal: "Accuracy", question: "Are price, policy, safety or capability claims supported?", rule: "Verify against a current source and log a review date." },
  { signal: "Competitive context", question: "Who appears instead and for what need?", rule: "Keep a stable competitor set and prompt wording." },
];

/**
 * Research frameworks the guides share: one. The hub's third stat; a constant
 * rather than a literal in JSX so all three stats are read from this module.
 */
export const PROMPT_GUIDE_FRAMEWORKS = 1;

export const HUB_COPY = {
  title: "Industry Prompt Setup Guides",
  metaDescription: (n: number) => `Discover ${n} original Echorank industry guides to designing AI search prompts, tagging topics, verifying answers, and improving GEO strategy.`,
  eyebrow: "Echorank resource library",
  h1: "Prompt setup guides",
  h1Em: "by industry.",
  lead: "Know which questions to track before you measure your AI search visibility. Choose an industry to build a focused prompt library, evaluate answer quality, and turn findings into better SEO and generative engine optimization (GEO).",
  browse: (n: number) => `Browse ${n} industry guides ↓`,
  seeMethod: "See the method →",
  eyeline: "Original editorial resources · Ready-to-adapt prompts · Practical measurement rules",
  stats: ["industry playbooks", "example prompts across guides", "repeatable research framework"],
  industries: {
    label: "Find your sector",
    h2: "Choose an industry guide",
    body: "Every guide includes topic coverage, an original sample prompt set, tagging recommendations, verification checks, and a practical improvement roadmap.",
    filterLabel: "Filter industries",
    placeholder: "Try healthcare, pricing, travel, local...",
    empty: "No matching guide. Try a broader industry or topic.",
    countOne: "guide",
    countMany: "guides",
    read: "Read industry guide",
  },
  glance: {
    label: "At a glance",
    h2: "Industries at a glance",
    body: "Who is asking, what they decide on, what to verify first and when to refresh — one row per guide, condensed from the guide itself.",
    head: ["Industry", "Who is asking", "Decision focus", "Verify first", "Refresh cadence"],
  },
  mix: {
    label: "Prompt mix",
    h2: "Prompt mix by industry",
    body: "How each guide's example prompts split by what they are for. The counts describe the example libraries, not search volume.",
    industry: "Industry",
    total: "Total",
    totals: "All guides",
  },
  method: {
    label: "A better way to design a prompt library",
    h2: "From buyer intent to measurable evidence",
    body: "Prompt tracking is research, not a ranking guarantee. Use the same questions repeatedly, observe what the engine actually says, and evaluate the evidence behind its answer.",
  },
  modes: {
    label: "Four core prompt modes",
    h2: "Separate the questions by purpose",
    factCheckTitle: "What about fact checking?",
    factCheckBody: "Treat important factual claims—especially regulated, safety-critical or frequently changing information—as a separate verification workstream. Compare the generated response against an authoritative dated source, and record uncertainty instead of guessing.",
  },
  principles: {
    label: "Measurement principles",
    h2: "What to record in every review",
    head: ["Signal", "Question it answers", "Recording rule"],
  },
  cta: {
    h2: "Turn research into search visibility.",
    body: "Explore Echorank tools for technical SEO and AI search readiness. Use the industry guides to decide what deserves monitoring.",
  },
} as const;

// ── Helpers ──

export function guideBySlug(slug: string): PromptGuide | undefined {
  return PROMPT_GUIDES.find((g) => g.slug === slug);
}

export function guidePath(slug: string): string {
  return `${PROMPT_GUIDES_BASE}/${slug}`;
}

/** Adjacent guides in display order, for the prev/next links. */
export function guideNeighbours(slug: string): { prev?: PromptGuide; next?: PromptGuide } {
  const i = PROMPT_GUIDES.findIndex((g) => g.slug === slug);
  return { prev: i > 0 ? PROMPT_GUIDES[i - 1] : undefined, next: i >= 0 ? PROMPT_GUIDES[i + 1] : undefined };
}

/**
 * Three related guides: the four-guide window around this one (clamped at the
 * ends of the list), minus the guide itself. The package's own lists.
 */
export function relatedGuides(slug: string): PromptGuide[] {
  const i = PROMPT_GUIDES.findIndex((g) => g.slug === slug);
  if (i < 0) return [];
  const start = Math.min(Math.max(i - 1, 0), PROMPT_GUIDES.length - 4);
  return PROMPT_GUIDES.slice(start, start + 4).filter((g) => g.slug !== slug);
}

/** Prompts per use for one guide, in PROMPT_USES order (zeros included). */
export function countsByUse(guide: PromptGuide): Record<PromptUse, number> {
  const out = Object.fromEntries(PROMPT_USES.map((u) => [u, 0])) as Record<PromptUse, number>;
  for (const p of guide.prompts) out[p.use] += 1;
  return out;
}

/** Prompts per use across every guide. */
export function totalsByUse(): Record<PromptUse, number> {
  const out = Object.fromEntries(PROMPT_USES.map((u) => [u, 0])) as Record<PromptUse, number>;
  for (const g of PROMPT_GUIDES) for (const p of g.prompts) out[p.use] += 1;
  return out;
}

export function totalPrompts(): number {
  return PROMPT_GUIDES.reduce((n, g) => n + g.prompts.length, 0);
}
