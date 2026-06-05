import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExtensionReviews, parseScrapedDate } from "../extension-ingest";
import type { ScrapedReviewInput } from "@/monitoring/import/extension-schema";

const TENANT = "tenant_1";
const SOURCE = "source_1";

function google(overrides: Partial<ScrapedReviewInput> = {}): ScrapedReviewInput {
  return {
    platform: "GOOGLE",
    reviewerName: "Jane D",
    rating: 5,
    reviewText: "Amazing service, highly recommend",
    reviewDate: "2026-01-04",
    sourceUrl: "https://www.google.com/maps/place/x",
    ...overrides,
  } as ScrapedReviewInput;
}

test("parseScrapedDate handles ISO, absolute, and relative dates", () => {
  assert.equal(parseScrapedDate("2026-01-04")?.getUTCFullYear(), 2026);
  const now = Date.UTC(2026, 5, 1);
  const threeWeeks = parseScrapedDate("3 weeks ago", now);
  assert.ok(threeWeeks);
  assert.equal(threeWeeks!.getTime(), now - 3 * 604_800_000);
  assert.equal(parseScrapedDate("nonsense"), undefined);
  assert.equal(parseScrapedDate(null), undefined);
});

test("buildExtensionReviews maps Google reviews and builds platform-scoped dedup keys", () => {
  const { reviews, skipped } = buildExtensionReviews(TENANT, SOURCE, "GOOGLE", [google()]);
  assert.equal(skipped, 0);
  assert.equal(reviews.length, 1);
  const r = reviews[0];
  assert.equal(r.tenantId, TENANT);
  assert.equal(r.sourceId, SOURCE);
  assert.equal(r.platform, "GOOGLE");
  assert.equal(r.rating, 5);
  assert.ok(r.deduplicationKey.startsWith("GOOGLE:"));
  assert.equal(r.content, "Amazing service, highly recommend");
});

test("Facebook recommendation maps to a synthetic rating", () => {
  const rec = buildExtensionReviews(TENANT, SOURCE, "FACEBOOK", [
    { platform: "FACEBOOK", recommendationStatus: "recommended", reviewText: "Great place" } as ScrapedReviewInput,
  ]);
  assert.equal(rec.reviews[0].rating, 5);
  const not = buildExtensionReviews(TENANT, SOURCE, "FACEBOOK", [
    { platform: "FACEBOOK", recommendationStatus: "not_recommended", reviewText: "Avoid" } as ScrapedReviewInput,
  ]);
  assert.equal(not.reviews[0].rating, 1);
});

test("identical content yields identical dedup key (idempotent re-scrape)", () => {
  const a = buildExtensionReviews(TENANT, SOURCE, "GOOGLE", [google({ externalId: null })]);
  const b = buildExtensionReviews(TENANT, SOURCE, "GOOGLE", [google({ externalId: null })]);
  assert.equal(a.reviews[0].deduplicationKey, b.reviews[0].deduplicationKey);
});

test("native externalId is preferred over content fingerprint", () => {
  const { reviews } = buildExtensionReviews(TENANT, SOURCE, "GOOGLE", [
    google({ externalId: "ChdDSUhNMG9n" }),
  ]);
  assert.equal(reviews[0].deduplicationKey, "GOOGLE:ChdDSUhNMG9n");
});

test("rows with neither text nor rating are skipped", () => {
  const { reviews, skipped } = buildExtensionReviews(TENANT, SOURCE, "GOOGLE", [
    { platform: "GOOGLE", reviewText: null, rating: null } as ScrapedReviewInput,
    google(),
  ]);
  assert.equal(skipped, 1);
  assert.equal(reviews.length, 1);
});

test("ratings are clamped to 1-5", () => {
  const { reviews } = buildExtensionReviews(TENANT, SOURCE, "TRUSTPILOT", [
    { platform: "TRUSTPILOT", rating: 9, reviewText: "x" } as ScrapedReviewInput,
  ]);
  assert.equal(reviews[0].rating, 5);
});

test("control characters and null bytes are stripped from content", () => {
  const { reviews } = buildExtensionReviews(TENANT, SOURCE, "GOOGLE", [
    google({ reviewText: "Good\u0000 service\u0007 here", externalId: null }),
  ]);
  assert.equal(reviews[0].content, "Good service here");
});

test("unsafe client externalId is rejected in favor of a content fingerprint", () => {
  const { reviews } = buildExtensionReviews(TENANT, SOURCE, "GOOGLE", [
    google({ externalId: "../../etc/passwd <script>" }),
  ]);
  assert.ok(reviews[0].deduplicationKey.startsWith("GOOGLE:ext-"));
});

test("non-https review url is dropped", () => {
  const { reviews } = buildExtensionReviews(TENANT, SOURCE, "GOOGLE", [
    google({ sourceUrl: "javascript:alert(1)", externalId: null }),
  ]);
  assert.equal(reviews[0].url, undefined);
});
