// src/lib/site-crawler/compare-csv.ts — CSV columns per comparison bucket (Phase 4c).
// "A" is this crawl, "B" the baseline. Dependency-free besides the rule copy.

import type { CsvColumn } from "@/lib/csv-export";
import { RULE_COPY } from "@/lib/crawl-rules-meta";
import type { BucketRow, ChangedRow, CompareBucket, IssueDeltaRow } from "./compare";

const url: CsvColumn<string>[] = [{ header: "URL", value: (u) => u }];

const changed: CsvColumn<ChangedRow>[] = [
  { header: "URL", value: (r) => r.url },
  { header: "Changed", value: (r) => r.fields.join(", ") },
  { header: "Status (baseline)", value: (r) => r.b.status },
  { header: "Status (this crawl)", value: (r) => r.a.status },
  { header: "Title (baseline)", value: (r) => r.b.title },
  { header: "Title (this crawl)", value: (r) => r.a.title },
  { header: "Canonical (baseline)", value: (r) => r.b.canonical },
  { header: "Canonical (this crawl)", value: (r) => r.a.canonical },
  { header: "Indexable (baseline)", value: (r) => (r.b.indexable ? "yes" : "no") },
  { header: "Indexable (this crawl)", value: (r) => (r.a.indexable ? "yes" : "no") },
];

const issues: CsvColumn<IssueDeltaRow>[] = [
  { header: "URL", value: (r) => r.url },
  { header: "Rule", value: (r) => r.ruleId },
  { header: "Issue", value: (r) => RULE_COPY[r.ruleId]?.name ?? r.ruleId },
];

export function compareColumns(bucket: CompareBucket): CsvColumn<BucketRow>[] {
  if (bucket === "added" || bucket === "removed") return url as CsvColumn<BucketRow>[];
  if (bucket === "changed") return changed as CsvColumn<BucketRow>[];
  return issues as CsvColumn<BucketRow>[];
}
