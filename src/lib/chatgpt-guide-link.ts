// src/lib/chatgpt-guide-link.ts — where the guide "How to get your website
// cited by ChatGPT" lives, and its menu label, for the Client Components that
// link to it (PublicNav). Dependency-free on purpose: the guide module itself
// reads plan config, which a Client Component must not pull into the browser.
// The pattern of src/lib/crawler-guides-link.ts.

export const CHATGPT_GUIDE_SLUG = "how-to-get-cited-by-chatgpt";

/** Site-relative; the nav locale-prefixes it. */
export const CHATGPT_GUIDE_HREF = `/learn/guides/${CHATGPT_GUIDE_SLUG}`;

/** The Resources menu label (en, fr, de-CH). */
export const CHATGPT_GUIDE_LABEL = {
  en: "Get cited by ChatGPT",
  fr: "Être cité par ChatGPT",
  de: "Von ChatGPT zitiert werden",
} as const;

/** Anchors other pages link to (identical in every language). */
export const CHATGPT_GUIDE_ANCHORS = {
  access: "can-chatgpt-get-into-your-website",
  check: "how-do-you-check-whether-chatgpt-cites-you",
} as const;
