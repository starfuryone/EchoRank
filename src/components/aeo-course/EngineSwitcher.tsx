"use client";

// Lesson 3's engine switcher: one tab per engine, panels crossfading. Keyboard:
// arrow keys move between tabs, Home/End jump, Tab moves into the panel (WAI
// tabs pattern). Before hydration, and without JS, every panel is shown
// stacked: nothing is hidden until the switcher can show it again.

import { useRef, useState, type KeyboardEvent } from "react";
import { useHydrated } from "./store";
import css from "./aeo.module.css";

export interface EnginePanel {
  name: string;
  /** Index into the neutral glyph set (no logos). */
  glyph: number;
  rows: { label: string; value: string }[];
}

export function Glyph({ i, size = 22 }: { i: number; size?: number }) {
  const shapes = [
    <circle key="c" cx="12" cy="12" r="8" />,
    <rect key="s" x="4.5" y="4.5" width="15" height="15" rx="2" />,
    <path key="t" d="M12 4 20 19H4Z" />,
    <path key="d" d="M12 3 21 12 12 21 3 12Z" />,
    <path key="h" d="M7.5 4h9l4.5 8-4.5 8h-9L3 12Z" />,
    <g key="r">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
    </g>,
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true" focusable="false">
      {shapes[i % shapes.length]}
    </svg>
  );
}

function Panel({ p }: { p: EnginePanel }) {
  return (
    <div>
      <div className={css.tool} style={{ marginTop: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Glyph i={p.glyph} />
          {p.name}
        </span>
        <dl style={{ margin: 0, display: "grid", gap: 6 }}>
          {p.rows.map((r) => (
            <div key={r.label} style={{ display: "grid", gap: 2 }}>
              <dt style={{ fontSize: 13, color: "var(--faint)" }}>{r.label}</dt>
              <dd style={{ margin: 0, fontSize: 15, color: "var(--text)" }}>{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function EngineSwitcher({ panels, label }: { panels: EnginePanel[]; label: string }) {
  const hydrated = useHydrated();
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  if (!hydrated) {
    return (
      <div className={css.stackAll}>
        {panels.map((p) => (
          <Panel key={p.name} p={p} />
        ))}
      </div>
    );
  }

  const focus = (i: number) => {
    const n = (i + panels.length) % panels.length;
    setActive(n);
    tabs.current[n]?.focus();
  };
  const target: Record<string, number> = {
    ArrowRight: active + 1,
    ArrowDown: active + 1,
    ArrowLeft: active - 1,
    ArrowUp: active - 1,
    Home: 0,
    End: panels.length - 1,
  };
  const onKey = (e: KeyboardEvent) => {
    if (!(e.key in target)) return;
    e.preventDefault();
    focus(target[e.key]);
  };

  return (
    <div className={css.tabs}>
      <div role="tablist" aria-label={label} className={css.tablist} onKeyDown={onKey}>
        {panels.map((p, i) => (
          <button
            key={p.name}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`engine-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`engine-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            className={css.tab}
            onClick={() => setActive(i)}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className={css.panels}>
        {panels.map((p, i) => (
          <div
            key={p.name}
            role="tabpanel"
            id={`engine-panel-${i}`}
            aria-labelledby={`engine-tab-${i}`}
            aria-hidden={i !== active}
            tabIndex={i === active ? 0 : -1}
            className={i === active ? css.panel : `${css.panel} ${css.panelOff}`}
          >
            <Panel p={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
