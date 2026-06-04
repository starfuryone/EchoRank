import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePreview, buildReviews } from "../csv-parser";
import { detectFormat, suggestMapping } from "../source-presets";
import type { ColumnMapping } from "../source-presets";

const GOOGLE_CSV = `Star Rating,Review Text,Reviewer Name,Review Date
5,Amazing service highly recommend,Jane D,2026-01-04
1,Terrible experience never again,Bob K,2026-01-05
3,It was okay nothing special,Sam P,2026-01-06`;

const TRUSTPILOT_CSV = `Review Title,Stars,Review,Name
Great,5,Loved every minute,Alice
Bad,2,Slow and overpriced,Mark`;

test("parsePreview detects headers and counts data rows", () => {
  const p = parsePreview(GOOGLE_CSV, true);
  assert.deepEqual(p.columns, ["Star Rating", "Review Text", "Reviewer Name", "Review Date"]);
  assert.equal(p.totalRows, 3);
  assert.equal(p.sampleRows[0]["Review Text"], "Amazing service highly recommend");
});

test("parsePreview handles headerless files with positional columns", () => {
  const p = parsePreview("5,Good,Jane\n1,Bad,Bob", false);
  assert.deepEqual(p.columns, ["column_1", "column_2", "column_3"]);
  assert.equal(p.totalRows, 2);
});

test("detectFormat recognises Google and Trustpilot exports", () => {
  assert.equal(detectFormat(["Star Rating", "Review Text"]).format, "GOOGLE_CSV");
  assert.equal(detectFormat(["Review Title", "Stars"]).format, "TRUSTPILOT_CSV");
  assert.equal(detectFormat(["foo", "bar"]).format, "GENERIC_CSV");
});

test("suggestMapping auto-maps common column names", () => {
  const m = suggestMapping(["Star Rating", "Review Text", "Reviewer Name", "Review Date"]);
  assert.equal(m.rating, "Star Rating");
  assert.equal(m.content, "Review Text");
  assert.equal(m.author, "Reviewer Name");
  assert.equal(m.publishedAt, "Review Date");
});

test("buildReviews normalizes rows and clamps ratings", () => {
  const mapping: ColumnMapping = {
    rating: "Star Rating",
    content: "Review Text",
    author: "Reviewer Name",
    publishedAt: "Review Date",
  };
  const { reviews, errors, totalRows } = buildReviews(
    GOOGLE_CSV,
    true,
    mapping,
    "GOOGLE",
    "tenant-1",
    "source-1",
  );
  assert.equal(totalRows, 3);
  assert.equal(errors.length, 0);
  assert.equal(reviews.length, 3);
  assert.equal(reviews[0].rating, 5);
  assert.equal(reviews[1].rating, 1);
  assert.equal(reviews[0].platform, "GOOGLE");
  // deduplicationKey is namespaced by platform
  assert.ok(reviews[0].deduplicationKey.startsWith("GOOGLE:"));
});

test("synthesized externalId is stable for identical rows (idempotent re-import)", () => {
  const mapping: ColumnMapping = { rating: "Star Rating", content: "Review Text", author: "Reviewer Name", publishedAt: "Review Date" };
  const a = buildReviews(GOOGLE_CSV, true, mapping, "GOOGLE", "tenant-1", "source-1");
  const b = buildReviews(GOOGLE_CSV, true, mapping, "GOOGLE", "tenant-1", "source-1");
  assert.deepEqual(
    a.reviews.map((r) => r.deduplicationKey),
    b.reviews.map((r) => r.deduplicationKey),
  );
});

test("rating coercion handles fractions and recommendation text", () => {
  const csv = `rating,review\n4/5,good\nrecommends,loved it\ndoesn't recommend,bad`;
  const mapping: ColumnMapping = { rating: "rating", content: "review" };
  const { reviews } = buildReviews(csv, true, mapping, "FACEBOOK", "t", "s");
  assert.equal(reviews[0].rating, 4); // 4/5 -> 4
  assert.equal(reviews[1].rating, 5); // recommends -> 5
  assert.equal(reviews[2].rating, 1); // doesn't recommend -> 1
});

test("rows with neither content nor rating are recorded as errors, not inserted", () => {
  const csv = `rating,review,name\n,,Empty Row\n5,Great,Jane`;
  const mapping: ColumnMapping = { rating: "rating", content: "review", author: "name" };
  const { reviews, errors } = buildReviews(csv, true, mapping, "CUSTOM", "t", "s");
  assert.equal(reviews.length, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].row, 1);
});
