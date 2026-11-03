// The app's one entry point to packages/crawl-rules. A relative re-export
// rather than a tsconfig path alias: tsconfig.json is echorank-owned and an
// edit as deploy flips its owner (CLAUDE.md, Deploy). The package is
// dependency-free, so this is safe to import from Client Components.
export * from "../../packages/crawl-rules/src/index";
