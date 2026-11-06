// src/lib/brand/wordmark-tm.ts
//
// The ™ on the ECHORANK wordmark (diamond + ECHORANK), wherever the wordmark
// is HTML text. One class, `er-tm`, on a span placed right after the K:
//
//   <span class="er-tm" aria-hidden="true">™</span>     (React: <WordmarkTm />)
//
// - size: 0.35em of the wordmark, never under 7px;
// - its top on the capitals' top: the wordmark's cap height and em are read on
//   the wordmark element itself (the ™'s parent, via :has) into registered
//   length properties, which compute there and inherit as absolute lengths, so
//   the ™ is raised by (wordmark cap height − its own cap height);
// - a ~0.05em gap after the K: the K's trailing letter-spacing is taken back
//   (--er-wm-ls, set to the wordmark's letter-spacing where it has one);
// - currentColor, so it follows the wordmark on dark and light;
// - line-height 0, so it never makes the line taller and the wordmark does not
//   move in its bar;
// - aria-hidden: the accessible name stays the wordmark's ("Echorank").
//
// Everything else about the wordmark (icon, size, colours, font, spacing) is
// untouched. Not in running text, titles, metadata or icon-only uses.
//
// WORDMARK_TM_CSS is the one copy of the rules. src/app/globals.css carries it
// for every React surface; the standalone route-handler pages and the
// extension pages have no shared stylesheet, so each embeds the same text.
// tests/wordmark-tm.test.ts checks every copy is this string, verbatim.

export const WORDMARK_TM_CSS =
  '@property --er-wm-em{syntax:"<length>";inherits:true;initial-value:0px}' +
  '@property --er-wm-cap{syntax:"<length>";inherits:true;initial-value:0px}' +
  '@property --er-wm-ls{syntax:"<length>";inherits:true;initial-value:0px}' +
  ":where(:has(> .er-tm)){--er-wm-em:1em;--er-wm-cap:1cap}" +
  ".er-tm{font-size:max(7px,.35em);line-height:0;letter-spacing:0;font-style:normal;color:currentColor;" +
  "margin-left:calc(var(--er-wm-em)*.05 - var(--er-wm-ls));vertical-align:calc(var(--er-wm-cap) - 1cap)}";

/** The span, as HTML, for the payload pages and the tests. */
export const WORDMARK_TM_HTML = '<span class="er-tm" aria-hidden="true">™</span>';
