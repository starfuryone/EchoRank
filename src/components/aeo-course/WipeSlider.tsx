"use client";

// Lesson 6: "what you see" over "what a crawler gets", with a wipe slider.
// The slider is a native range input, so it is keyboard operable (arrows,
// Home/End, Page Up/Down) and announced by screen readers. Without JS it sits
// at the halfway point, which already shows both views.

import { useState, type CSSProperties, type ReactNode } from "react";
import css from "./aeo.module.css";

export function WipeSlider({ under, over, label, leftLabel, rightLabel }: { under: ReactNode; over: ReactNode; label: string; leftLabel: string; rightLabel: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className={css.wipe}>
      <div style={{ position: "relative" }}>
        <div className={css.wipeLayer}>{under}</div>
        <div className={css.wipeTop} style={{ ["--wipe" as string]: `${pos}%` } as CSSProperties} aria-hidden="true">
          {over}
        </div>
      </div>
      <div className={css.wipeLabels} aria-hidden="true">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <label htmlFor="aeo-wipe">{label}</label>
      <input
        id="aeo-wipe"
        type="range"
        min={0}
        max={100}
        step={1}
        value={pos}
        aria-valuetext={`${pos}% showing what you see`}
        onChange={(e) => setPos(Number(e.target.value))}
      />
    </div>
  );
}
