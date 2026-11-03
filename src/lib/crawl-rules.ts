// The app's entry point to packages/crawl-rules: the full registry, with the
// evaluators. A relative re-export rather than a tsconfig path alias:
// tsconfig.json is echorank-owned and an edit as deploy flips its owner
// (CLAUDE.md, Deploy).
//
// Client Components import @/lib/crawl-rules-meta instead (ids and copy
// only). This module pulls every rule and the hreflang code-list packages;
// tests/crawl-rules/registry.test.ts fails a "use client" file importing it.
export * from "../../packages/crawl-rules/src/index";
