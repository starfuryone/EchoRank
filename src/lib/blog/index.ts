// The blog's public surface.
//
// Re-exports the SERVER-ONLY loader alongside the dependency-free constants, so
// a page writes one import. Anything that must not touch the filesystem — the
// SEO registry, the proxy, a Client Component — imports "@/lib/blog/constants"
// directly and gets no fs with it.
export * from "./constants";
export * from "./loader";
export type { BlogFrontmatter } from "./schema";
