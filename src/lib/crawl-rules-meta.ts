// The client-safe half of packages/crawl-rules: rule ids and copy, no rule
// logic, no dependencies (packages/crawl-rules/src/meta.ts). What Client
// Components import; everything else may use @/lib/crawl-rules.
export * from "../../packages/crawl-rules/src/meta";
