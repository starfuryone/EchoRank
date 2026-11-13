"use client";

// The course's one animation trigger: useInView (IntersectionObserver, once)
// and <Reveal>, which wraps a server-rendered figure and sets data-motion.
//
//   no attribute  → the figure's resting CSS, which is its FINAL state. This is
//                   what no-JS visitors, reduced-motion visitors and print get.
//   "armed"       → the figure is off screen: animations sit paused on their
//                   first frame, so nothing pops when it scrolls in.
//   "run"         → in view: the animations play once.
//
// Nothing is hidden unless JS has armed it, and a browser without
// IntersectionObserver simply keeps the final state.

import { useEffect, useRef, useState, type ReactNode } from "react";
import css from "./aeo.module.css";

export type MotionState = "idle" | "armed" | "run";

export function useInView<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [state, setState] = useState<MotionState>("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let first = true;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible) {
          setState("run");
          io.disconnect();
        } else if (first) {
          setState("armed");
        }
        first = false;
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, state };
}

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, state } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={className ? `${css.motion} ${className}` : css.motion} data-motion={state === "idle" ? undefined : state}>
      {children}
    </div>
  );
}
