// Shared types for the EchoRank browser extension.
// These intentionally mirror the server-side zod schema in
// src/monitoring/import/extension-schema.ts. Keep them in sync.

export type ExtensionPlatform = "GOOGLE" | "FACEBOOK" | "TRUSTPILOT";

/** The canonical scraped-review shape every content script emits. */
export interface ScrapedReview {
  platform: ExtensionPlatform;
  reviewerName?: string | null;
  rating?: number | null; // 1–5 (Google/Trustpilot); omitted for Facebook
  recommendationStatus?: "recommended" | "not_recommended" | null; // Facebook
  reviewText?: string | null;
  reviewDate?: string | null; // raw, as scraped
  ownerResponse?: string | null;
  sourceUrl?: string | null;
  externalId?: string | null; // native id if the page exposes one
}

export interface ImportPayload {
  platform: ExtensionPlatform;
  pageUrl: string;
  businessName?: string | null;
  reviews: ScrapedReview[];
  batchId?: string | null;
}

export interface ImportResult {
  ok: boolean;
  status: number;
  received?: number;
  importId?: string;
  error?: string;
}

// ── Message contracts (content ↔ popup ↔ service worker) ────────────────────

export type Message =
  | { type: "SCRAPE_ACTIVE_TAB" }
  | { type: "SCRAPE_RESULT"; reviews: ScrapedReview[]; pageUrl: string; businessName?: string | null; platform: ExtensionPlatform | null }
  | { type: "IMPORT"; payload: ImportPayload }
  | { type: "IMPORT_RESULT"; result: ImportResult }
  | { type: "GET_STATUS" }
  | {
      type: "STATUS";
      loggedIn: boolean;
      tokenPrefix: string | null;
      siteSupported: boolean;
      platform: ExtensionPlatform | null;
    };

export interface StoredConfig {
  token?: string;
  apiBase?: string; // default https://echorank360.com
}
