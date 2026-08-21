// The single contextual CTA an article carries, placed once mid-body.
//
// ONE COMPONENT, ONE COPY MAP. An article names a `relatedTool` in its
// frontmatter and gets the wording for it; nothing is written per article. That
// is what stops a CTA outliving the page it points at — the tool set is a
// closed union of real routes (BLOG_TOOLS), so a target that stops existing is
// a type error rather than a link to a 404.

import Link from "next/link";
import type { BlogBase, BlogTool } from "@/lib/blog/constants";
import { BLOG_TOOL_HREF } from "@/lib/blog/constants";
import { BLOG_TOOL_COPY } from "./copy";
import s from "./blog.module.css";
import h from "@/app/[locale]/home2.module.css";

export function BlogToolCta({
  tool,
  locale,
  base,
}: {
  tool: BlogTool;
  locale: string;
  base: BlogBase;
}) {
  const c = BLOG_TOOL_COPY[base][tool];
  return (
    <aside className={s.toolCta}>
      <div className={s.toolCtaCopy}>
        <p className={s.toolCtaH}>{c.h}</p>
        <p className={s.toolCtaP}>{c.p}</p>
      </div>
      <Link className={`${h.btn} ${h.btnPrimary}`} href={`/${locale}${BLOG_TOOL_HREF[tool]}`}>
        {c.cta}
      </Link>
    </aside>
  );
}
