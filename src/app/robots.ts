import type { MetadataRoute } from "next";

// AI crawlers were already permitted via the wildcard group, but only
// implicitly. Naming them makes the policy auditable and is what our own AI
// visibility guide tells customers to do.
//
// Important: a crawler that matches its own group ignores the "*" group
// entirely, so each named group repeats the same disallow list. Changing the
// exclusions below means changing them in DISALLOW, not per group.
const AI_CRAWLERS = [
  "GPTBot",           // OpenAI training/crawl
  "OAI-SearchBot",    // ChatGPT search
  "ChatGPT-User",     // ChatGPT live browsing
  "ClaudeBot",        // Anthropic crawl
  "Claude-User",      // Claude live browsing
  "PerplexityBot",    // Perplexity index
  "Google-Extended",  // Gemini / Vertex grounding opt-in
  "Bingbot",          // Bing index — backs Copilot answers
  "Applebot-Extended",
  "CCBot",            // Common Crawl — feeds several model corpora
];

const DISALLOW = ["/api/", "/dashboard/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOW,
      })),
    ],
    sitemap: "https://echorank360.com/sitemap.xml",
    host: "https://echorank360.com",
  };
}
