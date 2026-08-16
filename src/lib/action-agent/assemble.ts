// src/lib/action-agent/assemble.ts
//
// Deterministic assembly of the schema and FAQ artifacts.
//
// THE MODEL WRITES FIELDS; THIS FILE WRITES MARKUP. That split is lifted from
// /opt/echorank/av-service/remediate.py, which has been drawing it in
// production since the /visibility Fixes card shipped, and the reason has not
// changed: a model asked for JSON-LD eventually returns JSON-LD that does not
// parse, or invents an `@type` schema.org has never heard of. Here the model
// returns a business type from a closed set, a name, a description and a list
// of Q/A pairs — and the `@graph`, the `@id` anchors, the FAQPage wiring and
// every HTML entity are produced by code that cannot hallucinate.
//
// WHY THIS IS A PORT AND NOT A CALL. The sidecar's /remediate is one Anthropic
// call inside a Python process that reports no token usage, and the Action
// Agent's whole metering contract is output tokens against the Marketing Studio
// budget. There is nothing to meter through that door. The sidecar endpoint is
// untouched and still powers the /visibility Fixes card; consolidating the two
// means teaching remediate.py to return a usage block, which is a change to a
// different service and a different deploy.

export const ALLOWED_BUSINESS_TYPES = [
  "Organization",
  "Corporation",
  "LocalBusiness",
  "ProfessionalService",
  "Store",
  "Restaurant",
  "MedicalBusiness",
  "HomeAndConstructionBusiness",
  "FinancialService",
  "LegalService",
  "EducationalOrganization",
  "SoftwareApplication",
  "OnlineBusiness",
] as const;

export type BusinessType = (typeof ALLOWED_BUSINESS_TYPES)[number];

/** Anything outside the closed set becomes Organization, the safe supertype. */
export function coerceBusinessType(value: unknown): BusinessType {
  return (ALLOWED_BUSINESS_TYPES as readonly string[]).includes(String(value))
    ? (value as BusinessType)
    : "Organization";
}

/** The fields half of the contract — what the model is asked to produce. */
export interface GeneratedFields {
  business_name?: unknown;
  business_type?: unknown;
  description?: unknown;
  services?: unknown;
  area_served?: unknown;
  same_as?: unknown;
  faqs?: unknown;
}

export interface FaqPair {
  q: string;
  a: string;
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Q/A pairs with both halves present.
 *
 * A pair missing either half is DROPPED rather than repaired. A question with
 * no answer is not a FAQ entry, and inventing the answer here would be this
 * file doing exactly the thing it exists to prevent.
 */
export function cleanFaqs(value: unknown): FaqPair[] {
  if (!Array.isArray(value)) return [];
  const out: FaqPair[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const q = cleanText((entry as { q?: unknown }).q);
    const a = cleanText((entry as { a?: unknown }).a);
    if (q && a) out.push({ q, a });
  }
  return out;
}

/** Which optional fields the page did not evidence. Shown to the reviewer so an
 *  absence reads as "the page never said" rather than "the model forgot". */
export function omittedFields(fields: GeneratedFields): string[] {
  const omitted: string[] = [];
  if (!cleanList(fields.same_as).length) omitted.push("sameAs");
  if (!cleanList(fields.area_served).length) omitted.push("areaServed");
  if (!cleanList(fields.services).length) omitted.push("knowsAbout");
  return omitted;
}

type JsonLdNode = Record<string, unknown>;

/**
 * Build the pasteable `<script type="application/ld+json">` block.
 *
 * NO address AND NO telephone, EVER — not even when the model returns them. The
 * prompt forbids them and this function has no branch that would emit them, so
 * the guarantee survives a prompt edit. They are the two fields a wrong answer
 * does real-world damage with: a hallucinated phone number in structured data
 * is a phone number Google will show to customers.
 */
export function assembleSchema(fields: GeneratedFields, url: string): string {
  const businessType = coerceBusinessType(fields.business_type);
  const name = cleanText(fields.business_name);
  const description = cleanText(fields.description);

  const org: JsonLdNode = { "@type": businessType, "@id": `${url}#org`, url };
  if (name) org.name = name;
  if (description) org.description = description;

  const sameAs = cleanList(fields.same_as);
  if (sameAs.length) org.sameAs = sameAs;
  const areaServed = cleanList(fields.area_served);
  if (areaServed.length) org.areaServed = areaServed;
  const services = cleanList(fields.services);
  if (services.length) org.knowsAbout = services;

  const website: JsonLdNode = {
    "@type": "WebSite",
    "@id": `${url}#website`,
    url,
    publisher: { "@id": `${url}#org` },
  };
  if (name) website.name = name;

  const graph: JsonLdNode[] = [org, website];

  const faqs = cleanFaqs(fields.faqs);
  if (faqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    });
  }

  const doc = { "@context": "https://schema.org", "@graph": graph };
  return `<script type="application/ld+json">\n${JSON.stringify(doc, null, 2)}\n</script>\n`;
}

/**
 * Where to paste it, in order.
 *
 * Steps, not prose, and specific enough to follow without knowing what JSON-LD
 * is — this is read by whoever owns the CMS, who is frequently not whoever
 * asked for the fix.
 */
export function schemaPlacement(url: string): string[] {
  return [
    `Open the page template that renders ${url}.`,
    "Paste the block immediately before the closing </head> tag. It is inert markup — it changes nothing a visitor sees.",
    "If the page already has a <script type=\"application/ld+json\"> block, replace it rather than adding a second one. Two blocks describing the same entity is worse than one.",
    "Publish, then confirm with Google's Rich Results Test that the page validates.",
  ];
}

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/** Escapes in the order remediate.py does — ampersand first, or the other
 *  replacements get double-escaped. A regex with a single pass makes that
 *  ordering bug unrepresentable. */
function esc(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ENTITIES[char]);
}

/**
 * Both renderings of the visible FAQ.
 *
 * VISIBLE, and that is the point of shipping it beside the schema: an FAQPage
 * block whose questions appear nowhere on the page is the exact pattern search
 * engines treat as structured-data spam. The two artifacts are generated
 * together from one list so they cannot drift apart.
 */
export function renderFaq(items: FaqPair[]): { html: string; markdown: string } {
  if (!items.length) return { html: "", markdown: "" };

  const rows = items
    .map(
      (item) =>
        `  <div class="faq-item">\n` +
        `    <h3 class="faq-q">${esc(item.q)}</h3>\n` +
        `    <p class="faq-a">${esc(item.a)}</p>\n` +
        `  </div>`,
    )
    .join("\n");

  const html = `<section class="faq" aria-label="Frequently asked questions">\n${rows}\n</section>\n`;
  const markdown =
    "## Frequently asked questions\n\n" +
    items.map((item) => `**${item.q}**\n\n${item.a}`).join("\n\n") +
    "\n";

  return { html, markdown };
}

/**
 * Pull the JSON object out of a model response.
 *
 * Tolerates a ```json fence and leading prose, because both happen occasionally
 * even under an explicit instruction, and a whole generation is too expensive
 * to throw away over a code fence. Anything that is not parseable JSON after
 * that is a real failure and throws.
 */
export function parseFieldsJson(text: string): GeneratedFields {
  const stripped = text.trim().replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("The generator did not return JSON.");
  }
  const parsed: unknown = JSON.parse(stripped.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The generator did not return a JSON object.");
  }
  return parsed as GeneratedFields;
}
