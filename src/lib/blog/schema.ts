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

/** The meta description ceiling for any article, and the agent's tighter one. */
export const META_DESCRIPTION_MAX = 190;
export const AGENT_META_DESCRIPTION_MAX = 165;

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
    /**
     * Google truncates around 160; under 120 wastes the slot. The schema
     * allows up to META_DESCRIPTION_MAX because hand-written series ship with
     * descriptions whose copy is final (the 2026-11-11 AI Visibility series
     * runs to 184); the agent is still held to AGENT_META_DESCRIPTION_MAX by
     * agentFrontmatterSchema below.
     */
    metaDescription: z.string().min(70).max(META_DESCRIPTION_MAX),
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
     * OPTIONAL. A raster og:image / twitter:image / JSON-LD image (1200x630),
     * for an article whose hero is an SVG: social cards do not render SVG.
     * Absent, the hero is used, as before. Existence is checked by the loader.
     */
    ogImage: z.string().regex(/^\/blog\/[a-z0-9/-]+\.(png|jpg)$/).optional(),
    /**
     * Required, not optional. A hero with no alt is the single most common
     * accessibility regression in a content system, and the only way to stop
     * it is to make the file unparseable without one.
     */
    featuredImageAlt: z.string().min(10),
    /**
     * The accent-bordered summary box. Three to five bullets, by design.
     * OPTIONAL for a hand-written article whose copy is final and carries its
     * own "Key takeaways" (no box is drawn without it); REQUIRED for the agent
     * (agentFrontmatterSchema), whose prompt asks for it.
     */
    tldr: z.array(z.string().min(20)).min(3).max(5).optional(),
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

/**
 * The blog agent's stricter contract: the same schema, plus the two rules the
 * hand-written schema relaxed. Its prompt says "70 to 165" and asks for a
 * TL;DR, so its drafts are judged by exactly that.
 */
export const agentFrontmatterSchema = blogFrontmatterSchema.superRefine((fm, ctx) => {
  if (fm.metaDescription.length > AGENT_META_DESCRIPTION_MAX) {
    ctx.addIssue({
      code: "custom",
      path: ["metaDescription"],
      message: `over ${AGENT_META_DESCRIPTION_MAX} characters (${fm.metaDescription.length})`,
    });
  }
  if (!fm.tldr) {
    ctx.addIssue({ code: "custom", path: ["tldr"], message: "required: 3 to 5 bullets" });
  }
});
