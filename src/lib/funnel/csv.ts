// src/lib/funnel/csv.ts
//
// The column set for a lead export. Pure, no Prisma, so the tests can call it.
//
// EVERY CELL HERE CAME FROM A STRANGER. The email and the domain were typed
// into a form on a public page by someone we have never authenticated, which
// makes this the highest-risk export in the app for spreadsheet formula
// injection — the exact threat the guard in csv-export.ts exists for. Nothing
// below opts out of it: no column defines a `format` that would bypass
// guardFormula, and `score` is left as a real number so the guard's
// number-exemption applies and the column stays sortable.

import type { CsvColumn } from "@/lib/csv-export";

export interface LeadCsvRow {
  email: string;
  domain: string;
  score: number | null;
  createdAt: Date;
}

export const LEAD_CSV_COLUMNS: readonly CsvColumn<LeadCsvRow>[] = [
  { header: "Email", value: (r) => r.email },
  { header: "Website", value: (r) => r.domain },
  // Null renders as an empty cell rather than a 0. A lead whose audit never
  // completed has no score, and a zero would read as "scored zero" — the
  // difference between "we could not reach the site" and "the site is terrible"
  // is the whole reason an agency picks up the phone.
  { header: "Score", value: (r) => r.score },
  // ISO 8601 via the default formatter, so two people in different timezones
  // exporting the same funnel get the same file. See formatValue in csv-export.
  { header: "Captured", value: (r) => r.createdAt },
];
