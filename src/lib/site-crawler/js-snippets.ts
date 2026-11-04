// src/lib/site-crawler/js-snippets.ts
//
// Custom JavaScript for render mode (Phase 4e): the presets and the code each
// one sends to the sidecar. Dependency-free, so the crawl form (a Client
// Component) can import the preset list. A snippet is the BODY of an async
// function, run in the page after it settles and before the DOM is read; its
// return value is stored JSON-serialised (≤ 5 KB) on the Extraction tab.

export const JS_PRESETS = ["scroll", "loadMore", "dataLayer", "nextData", "custom"] as const;
export type JsPreset = (typeof JS_PRESETS)[number];

export interface JsSnippet {
  name: string;
  preset: JsPreset;
  /** loadMore: the button or link to click. */
  selector: string | null;
  /** custom: the function body. */
  code: string | null;
}

export const JS_LIMITS = { nameChars: 60, selectorChars: 200, codeChars: 2000 } as const;

/** Scroll until the page stops growing (20 steps at most); returns the final height. */
const SCROLL = `let h = 0;
for (let i = 0; i < 20 && document.documentElement.scrollHeight !== h; i++) {
  h = document.documentElement.scrollHeight;
  window.scrollTo(0, h);
  await new Promise((r) => setTimeout(r, 250));
}
return document.documentElement.scrollHeight;`;

/** Click the selector while it is there and visible (10 clicks at most); returns the clicks made. */
const loadMore = (selector: string) => `const sel = ${JSON.stringify(selector)};
let clicks = 0;
for (; clicks < 10; clicks++) {
  const el = document.querySelector(sel);
  if (!el || !(el instanceof HTMLElement) || el.offsetParent === null) break;
  el.click();
  await new Promise((r) => setTimeout(r, 500));
}
return clicks;`;

const DATA_LAYER = `return Array.isArray(window.dataLayer) ? window.dataLayer.slice(0, 50) : null;`;

const NEXT_DATA = `const d = window.__NEXT_DATA__;
if (!d) return null;
const props = d.props || {};
return { page: d.page ?? null, buildId: d.buildId ?? null, props: Object.keys(props), pageProps: Object.keys(props.pageProps || {}) };`;

/** What the sidecar runs for one snippet. */
export function snippetCode(s: JsSnippet): string {
  switch (s.preset) {
    case "scroll":
      return SCROLL;
    case "loadMore":
      return loadMore(s.selector ?? "");
    case "dataLayer":
      return DATA_LAYER;
    case "nextData":
      return NEXT_DATA;
    case "custom":
      return s.code ?? "";
  }
}

/** A stored value that is the sidecar's error marker. */
export const isSnippetError = (v: string) => v.startsWith("error: ");
