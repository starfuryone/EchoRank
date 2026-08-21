// The byline block under every article.
//
// Reads BLOG_AUTHOR, which is one constant. Per-article authors are deliberately
// not supported: two articles disagreeing about how to spell the same person is
// the failure this avoids, and a second author is a one-line change to the
// constant when there actually is one.

import { BLOG_AUTHOR, type BlogBase } from "@/lib/blog/constants";
import s from "./blog.module.css";

/** Initials for the mark. "Frederic Desjardins" -> "FD". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function AuthorCard({ base }: { base: BlogBase }) {
  return (
    <aside className={s.author}>
      <span className={s.authorMark} aria-hidden="true">
        {initials(BLOG_AUTHOR.name)}
      </span>
      <div>
        <p className={s.authorName}>{BLOG_AUTHOR.name}</p>
        <p className={s.authorRole}>{BLOG_AUTHOR.role[base]}</p>
        <p className={s.authorBio}>
          {BLOG_AUTHOR.bio[base]}{" "}
          <a href={`mailto:${BLOG_AUTHOR.email}`}>{BLOG_AUTHOR.email}</a>
        </p>
      </div>
    </aside>
  );
}
