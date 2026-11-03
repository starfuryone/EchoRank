import { TYPE_SPECS } from "../../../packages/crawl-rules/src/rules/structured_data";
import { doc, page, pc, type RuleCase } from "../harness";

const ld = (...blocks: string[]) =>
  page(doc(`<title>t</title>${blocks.map((b) => `<script type="application/ld+json">${b}</script>`).join("")}`, "<h1>x</h1>"));
const item = (type: string, props: string[]) =>
  JSON.stringify({ "@context": "https://schema.org", "@type": type, ...Object.fromEntries(props.map((k) => [k, "x"])) });
const first = (r: string | readonly string[]) => (typeof r === "string" ? r : r[0]!);

// Per type: a complete item fires nothing; drop one required (or one
// recommended) property and exactly that rule fires.
const perType: RuleCase[] = TYPE_SPECS.flatMap((s) => {
  const type = s.types[0]!;
  const all = [...s.required, ...s.recommended].map(first);
  const req = `structured_data.${s.id}.missing_required`;
  const rec = `structured_data.${s.id}.missing_recommended`;
  const out: RuleCase[] = [
    pc(req, `${type} complete`, false, ld(item(type, all))),
    pc(req, `${type} without ${first(s.required[0]!)}`, true, ld(item(type, all.filter((k) => k !== first(s.required[0]!))))),
  ];
  if (s.recommended.length) {
    const drop = first(s.recommended[0]!);
    out.push(
      pc(rec, `${type} complete`, false, ld(item(type, all))),
      pc(rec, `${type} without ${drop}`, true, ld(item(type, all.filter((k) => k !== drop)))),
    );
  }
  return out;
});

const cases: RuleCase[] = [
  pc("structured_data.jsonld_parse_error", "trailing comma", true, ld('{"@type":"Thing",}')),
  pc("structured_data.jsonld_parse_error", "valid", false, ld(item("Thing", ["name"]))),
  pc("structured_data.microdata_unparsable", "itemscope without itemtype", true, page(doc("", '<div itemscope><span itemprop="name">x</span></div>'))),
  pc("structured_data.microdata_unparsable", "stray itemprop", true, page(doc("", '<span itemprop="name">x</span>'))),
  pc("structured_data.microdata_unparsable", "well-formed", false, page(doc("", '<div itemscope itemtype="https://schema.org/Thing"><span itemprop="name">x</span></div>'))),
  pc("structured_data.none", "nothing", true, page(doc("<title>t</title>", "<p>x</p>"))),
  pc("structured_data.none", "has JSON-LD", false, ld(item("Thing", ["name"]))),
  pc("structured_data.non_schema_org", "data-vocabulary", true, ld('{"@context":"http://data-vocabulary.org","@type":"Breadcrumb"}')),
  pc("structured_data.non_schema_org", "microdata from elsewhere", true, page(doc("", '<div itemscope itemtype="http://data-vocabulary.org/Breadcrumb"></div>'))),
  pc("structured_data.non_schema_org", "schema.org", false, ld(item("Thing", ["name"]))),
  pc("structured_data.duplicate_blocks", "same block twice, keys reordered", true, ld('{"@type":"Thing","name":"a"}', '{"name":"a","@type":"Thing"}')),
  pc("structured_data.duplicate_blocks", "distinct", false, ld(item("Thing", ["name"]), item("Thing", ["url"]))),
  // Matching details the generated cases do not reach.
  pc("structured_data.article.missing_required", "BlogPosting counts as Article", true, ld(item("BlogPosting", ["headline"]))),
  pc("structured_data.product.missing_required", "microdata Product, no offers", true, page(doc("", '<div itemscope itemtype="https://schema.org/Product"><span itemprop="name">P</span></div>'))),
  pc("structured_data.video_object.missing_recommended", "embedUrl satisfies contentUrl-or-embedUrl", false, ld(item("VideoObject", ["name", "thumbnailUrl", "uploadDate", "description", "duration", "embedUrl"]))),
  pc("structured_data.job_posting.missing_required", "remote job via applicantLocationRequirements", false, ld(item("JobPosting", ["title", "description", "datePosted", "hiringOrganization", "applicantLocationRequirements"]))),
  pc("structured_data.organization.missing_required", "@graph item found", true, ld('{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"A"}]}')),
  ...perType,
];

export default cases;
