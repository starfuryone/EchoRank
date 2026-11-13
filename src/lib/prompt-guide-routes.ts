// The industry prompt setup guides' URL space: /[locale]/prompt-guides and one
// page per slug. Everything else about the guides lives in prompt-guides.ts.
//
// SEPARATE ON PURPOSE. src/lib/seo/registry.ts imports this to register the
// routes, and the registry is imported by src/proxy.ts, which runs on the edge.
// The full config is ~50 KB of prompt copy; the proxy needs eleven paths. So the
// slugs live here, dependency-free, and prompt-guides.ts imports them —
// tests/prompt-guides.test.ts fails if the two ever disagree.

export const PROMPT_GUIDES_BASE = "/prompt-guides";

/** Display order: the hub grid, the prev/next chain and the sitemap. */
export const PROMPT_GUIDE_SLUGS = [
  "automotive",
  "b2b-software",
  "consumer-packaged-goods",
  "financial-services",
  "healthcare",
  "pharma-life-sciences",
  "publishing-media",
  "retail",
  "telecom",
  "travel-hospitality",
] as const;

export type PromptGuideSlug = (typeof PROMPT_GUIDE_SLUGS)[number];

/** The hub, then every guide, for the sitemap registry. */
export function promptGuideRoutes(): string[] {
  return [PROMPT_GUIDES_BASE, ...PROMPT_GUIDE_SLUGS.map((s) => `${PROMPT_GUIDES_BASE}/${s}`)];
}
