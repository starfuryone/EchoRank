// src/lib/blog/schema.ts
//
// The frontmatter contract, as zod. Validation happens at LOAD time, which on
// every route here is BUILD time — so a malformed .md file is a red build, not
// a page that renders "undefined" into a meta description.
//
// Two fields the brief's draft carried are deliberately absent:
//
//   readingTime — computed by readingTime() from the body. An authored number
//                 is a number nobody updates when the article is edited.
//   author      — one constant, BLOG_AUTHOR. Per-file authors would let two
//                 articles disagree about how to spell the same person.

import { z } from "zod";
import {
  BLOG_CATEGORIES,
  BLOG_STATUSES,
  BLOG_TOOLS,
  RESERVED_BLOG_SLUGS,
  SEARCH_INTENTS,
} from "./constants";

/** YYYY-MM-DD, and a real date — "2026-02-31" parses as March 3rd elsewhere. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "not a real calendar date");

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase words joined by single hyphens")
  .refine((s) => !RESERVED_BLOG_SLUGS.includes(s), {
    message: `reserved: /blog/${RESERVED_BLOG_SLUGS.join(", /blog/")} are routes, not articles`,
  });

export const blogFrontmatterSchema = z
  .object({
    slug,
    title: z.string().min(10).max(120),
    /**
     * The <title>. Separate from `title` because an h1 that reads well on the
     * page ("Measuring AI search visibility") and one that earns a click in a
     * SERP are different sentences. brandTitle() appends the brand.
     */
    seoTitle: z.string().min(10).max(75),
    /** Google truncates around 160; under 120 wastes the slot. */
    metaDescription: z.string().min(70).max(165),
    /** The card blurb AND the on-page lede. One string, both jobs. */
    excerpt: z.string().min(60).max(320),
    category: z.enum(BLOG_CATEGORIES),
    tags: z.array(z.string().min(2)).min(1).max(8),
    searchIntent: z.enum(SEARCH_INTENTS),
    primaryKeyword: z.string().min(3),
    secondaryKeywords: z.array(z.string().min(3)).max(10).default([]),
    publishedAt: isoDate,
    updatedAt: isoDate.optional(),
    /** Site-relative, under public/. Existence is checked by the loader. */
    featuredImage: z.string().regex(/^\/blog\/[a-z0-9/-]+\.(svg|webp|png|jpg)$/),
    /**
     * Required, not optional. A hero with no alt is the single most common
     * accessibility regression in a content system, and the only way to stop
     * it is to make the file unparseable without one.
     */
    featuredImageAlt: z.string().min(10),
    /** The accent-bordered summary box. Three to five bullets, by design. */
    tldr: z.array(z.string().min(20)).min(3).max(5),
    /**
     * Optional. An article without it renders no FAQ section AND emits no
     * FAQPage node — the guard is in one place because those two facts must
     * never come apart.
     */
    faq: z
      .array(z.object({ q: z.string().min(10), a: z.string().min(30) }))
      .min(2)
      .optional(),
    relatedTool: z.enum(BLOG_TOOLS),
    relatedSlugs: z.array(slug).max(6).default([]),
    status: z.enum(BLOG_STATUSES),
    featured: z.boolean().default(false),
  })
  .strict() // an unknown key is a typo, and a typo'd key is a missing field
  .refine((fm) => !fm.updatedAt || fm.updatedAt >= fm.publishedAt, {
    message: "updatedAt is before publishedAt",
    path: ["updatedAt"],
  })
  .refine((fm) => !fm.relatedSlugs.includes(fm.slug), {
    message: "an article cannot be related to itself",
    path: ["relatedSlugs"],
  });

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;
