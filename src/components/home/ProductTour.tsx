"use client";

import { useEffect, useRef, useState } from "react";
import s from "./ProductTour.module.css";

const SHOTS = [
  { slug: "dashboard",        title: "Dashboard",        desc: "Setup checklist, response metrics and quick actions in one view.", w: 1400, h: 735 },
  { slug: "reputation-tools", title: "Reputation Tools", desc: "Feedback, campaigns, recovery and monitoring, grouped by job.", w: 1400, h: 709 },
  { slug: "ai-visibility",    title: "AI Visibility",    desc: "Audit any domain, then re-audit on schedule with drop alerts.", w: 1400, h: 726 },
  { slug: "seo-tools",        title: "SEO Tools",        desc: "Search, performance and content tooling in one place.", w: 1400, h: 714 },
  { slug: "marketing-studio", title: "Marketing Studio", desc: "Twelve briefs that turn business facts into finished assets.", w: 1400, h: 701 },
  { slug: "team",             title: "Team",             desc: "Roles and invitations for the whole workspace.", w: 1400, h: 725 },
  { slug: "account",          title: "Account",          desc: "Profile, plan and workspace details.", w: 1400, h: 723 },
  { slug: "billing",          title: "Billing",          desc: "Usage this month, and every plan from $29 to $499.", w: 1400, h: 729 },
  { slug: "help",             title: "Help",             desc: "The full knowledge base, indexed inside the product.", w: 1400, h: 719 },
] as const;

const DELAY = 5000;

export default function ProductTour() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  // Autoplay only while the section is on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !visible) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % SHOTS.length), DELAY);
    return () => clearTimeout(t);
  }, [index, paused, visible]);

  const shot = SHOTS[index];

  return (
    <section
      ref={rootRef}
      className={s.tour}
      aria-roledescription="carousel"
      aria-label="Inside Echorank360"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={s.head}>
        <h2 className={s.title}>Inside the product</h2>
        <p className={s.sub}>
          Nine screens, one workspace — reputation, AI visibility, SEO and
          marketing under the same roof.
        </p>
      </div>

      <div className={s.stage}>
        <div
          className={s.track}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SHOTS.map((sh, i) => (
            <figure key={sh.slug} className={s.slide} aria-hidden={i === index ? "false" : "true"}>
              <img
                src={`/tour/${sh.slug}.webp`}
                alt={`${sh.title} screen of Echorank360`}
                width={sh.w}
                height={sh.h}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            </figure>
          ))}
        </div>
        <div className={s.cap} aria-live="polite">
          <strong>{shot.title}</strong>
          <span>{shot.desc}</span>
        </div>
        <button
          type="button"
          className={`${s.arrow} ${s.prev}`}
          aria-label="Previous screen"
          onClick={() => setIndex((index - 1 + SHOTS.length) % SHOTS.length)}
        >
          &#8249;
        </button>
        <button
          type="button"
          className={`${s.arrow} ${s.next}`}
          aria-label="Next screen"
          onClick={() => setIndex((index + 1) % SHOTS.length)}
        >
          &#8250;
        </button>
      </div>

      <div className={s.strip} role="tablist" aria-label="Choose screen">
        {SHOTS.map((sh, i) => (
          <button
            key={sh.slug}
            type="button"
            role="tab"
            aria-selected={i === index}
            className={i === index ? `${s.thumb} ${s.thumbActive}` : s.thumb}
            onClick={() => setIndex(i)}
          >
            <img src={`/tour/${sh.slug}.webp`} alt="" width={140} height={74} loading="lazy" decoding="async" />
            <span>{sh.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
