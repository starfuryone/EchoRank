"use client";

// The Enterprise sub-nav: a second sticky bar under PublicNav, the shape of a
// product page's section bar. Title on the left (back to the top of
// /enterprise), the page's sections in the middle, "Talk to us" on the right.
//
// On /enterprise the section links are in-page anchors and the one for the
// section being read is marked aria-current. On /enterprise/contact they lead
// back to /enterprise#<section>, and the CTA is left out: that page is where
// it goes.
//
// The section ids live in sections.ts, which the server page also reads, so
// a link and its target cannot drift apart.

import Link from "next/link";
import { useEffect, useState } from "react";
import { SALES_COPY, salesLocale } from "@/lib/sales/inquiry-copy";
import { salesContactHref } from "@/lib/sales/inquiry-options";
import s from "../home2.module.css";
import n from "./subnav.module.css";
import { ENTERPRISE_SECTION_IDS, ENTERPRISE_SUBNAV_COPY, type EnterpriseSectionId } from "./sections";

/** PublicNav (64px) + this bar (48px): where a section's top counts as reached. */
const STICKY_OFFSET = 112;

/**
 * The section being read: the last one whose top has scrolled up to the
 * bottom of the two bars. A section between two named ones (the AI row after
 * Features) keeps the one above it lit, and nothing is lit above the first.
 */
export function currentSection(tops: Array<[EnterpriseSectionId, number]>, offset = STICKY_OFFSET): EnterpriseSectionId | null {
  let cur: EnterpriseSectionId | null = null;
  for (const [id, top] of tops) if (top <= offset + 1) cur = id;
  return cur;
}

export function EnterpriseSubnav({ locale, page }: { locale: string; page: "overview" | "contact" }) {
  const sl = salesLocale(locale);
  const c = ENTERPRISE_SUBNAV_COPY[sl];
  const overview = page === "overview";
  const [active, setActive] = useState<EnterpriseSectionId | null>(null);

  useEffect(() => {
    if (!overview) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const tops: Array<[EnterpriseSectionId, number]> = [];
      for (const id of ENTERPRISE_SECTION_IDS) {
        const el = document.getElementById(id);
        if (el) tops.push([id, el.getBoundingClientRect().top]);
      }
      setActive(currentSection(tops));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [overview]);

  const base = `/${locale}/enterprise`;
  return (
    <nav className={`${n.bar} ${overview ? n.smooth : ""}`} aria-label={c.aria}>
      <div className={`${s.container} ${n.in}`}>
        <Link href={base} className={n.title}>
          {c.title}
        </Link>
        <div className={n.links}>
          {ENTERPRISE_SECTION_IDS.map((id) =>
            overview ? (
              <a key={id} href={`#${id}`} aria-current={active === id ? "true" : undefined}>
                {c.sections[id]}
              </a>
            ) : (
              <Link key={id} href={`${base}#${id}`}>
                {c.sections[id]}
              </Link>
            ),
          )}
        </div>
        {overview && (
          <Link href={salesContactHref(locale, "enterprise-nav")} className={n.cta}>
            {SALES_COPY[sl].links.talk}
          </Link>
        )}
      </div>
    </nav>
  );
}
