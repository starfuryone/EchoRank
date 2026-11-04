// Guide 3 — web-scraping-with-custom-extraction. Diagrams 3a, 3b, 3c
// (NOSY-BAT-GUIDES.md). Filter and segment wording follows the UI's own
// strings ("Author: empty", "Segment: …").

import { Arrow, Box, Chip, artStyles as a, type ArtBase, type ArtSpec } from "./frame";

/** 3a — one value, three ways to point at it. */
export const selectorToValue: ArtSpec = {
  title: { en: "Selector to value", fr: "Du sélecteur à la valeur" },
  caption: {
    en: "The same $49 reached three ways: a CSS selector, an XPath, or a regular expression over the raw HTML.",
    fr: "Le même 49 $ atteint de trois façons : un sélecteur CSS, un XPath ou une expression régulière sur le HTML brut.",
  },
  draw: (b: ArtBase) => {
    const regex = b === "fr" ? "Expr. rég." : "Regex";
    const chips = [
      { y: 92, label: "CSS", expr: ".price span" },
      { y: 162, label: "XPath", expr: '//div[@class="price"]/span' },
      { y: 232, label: regex, expr: "\\$\\d+" },
    ];
    return (
      <g>
        <Box x={20} y={110} w={190} h={140} r={12} />
        <text x={36} y={140} className={`${a.tXs} ${a.mono}`}>HTML</text>
        <text x={36} y={172} className={`${a.tSm} ${a.mono}`}>{'<div class="price">'}</text>
        <rect x={46} y={184} width={150} height={26} rx={5} className={a.accent} />
        <text x={54} y={202} className={`${a.tSm} ${a.mono}`}>{"<span>$49</span>"}</text>
        <text x={36} y={232} className={`${a.tSm} ${a.mono}`}>{"</div>"}</text>
        {chips.map((c) => (
          <g key={c.label}>
            <Arrow x1={212} y1={180} x2={232} y2={c.y + 20} />
            <rect x={236} y={c.y} width={290} height={40} rx={20} className={a.card} />
            <text x={254} y={c.y + 25} className={a.tB}>{c.label}</text>
            <text x={b === "fr" && c.label === regex ? 340 : 310} y={c.y + 25} className={`${a.tXs} ${a.mono}`} style={{ fill: "currentColor" }}>{c.expr}</text>
            <Arrow x1={528} y1={c.y + 20} x2={544} y2={180} tone="accent" />
          </g>
        ))}
        <Box x={548} y={150} w={76} h={60} r={12} cls={a.accent} />
        <text x={586} y={187} textAnchor="middle" className={a.tLg}>{b === "fr" ? "49 $" : "$49"}</text>
      </g>
    );
  },
};

/** 3b — URL plus one column per extractor; the empty filter finds the gap. */
export const extractionTable: ArtSpec = {
  title: { en: "The extraction table", fr: "Le tableau d'extraction" },
  caption: {
    en: "One row per page, one column per extractor. Filtering to Author: empty leaves exactly the page that is missing a byline.",
    fr: "Une ligne par page, une colonne par extracteur. Le filtre Author : vide ne garde que la page à laquelle il manque une signature.",
  },
  draw: (b: ArtBase) => {
    const cols = [30, 250, 350, 470, 610];
    const head = b === "fr" ? ["URL", "Price", "SKU", "Author"] : ["URL", "Price", "SKU", "Author"];
    const rows = [
      ["/shop/lamp", "$49", "LMP-01", "A. Roy"],
      ["/shop/chair", "$129", "CHR-07", "A. Roy"],
      ["/shop/desk", "$310", "DSK-02", ""],
      ["/shop/shelf", "$85", "SHF-11", "M. Tran"],
    ];
    const top = 92;
    const rh = 44;
    return (
      <g>
        <Chip x={30} y={34} w={176} h={32} text={b === "fr" ? "Author : vide" : "Author: empty"} textCls={a.tB} />
        <path className={a.accentLine} d="M206 50h264v40" />
        <Box x={30} y={top} w={580} h={rh * 5} r={10} />
        <rect x={31} y={top + 1} width={578} height={rh - 1} rx={9} className={a.card2} style={{ stroke: "none" }} />
        {[1, 2, 3, 4].map((r) => (
          <path key={r} className={a.line} d={`M30 ${top + rh * r}h580`} />
        ))}
        {cols.slice(1, 4).map((x) => (
          <path key={x} className={a.line} d={`M${x} ${top}v${rh * 5}`} />
        ))}
        {head.map((h, i) => (
          <text key={h} x={cols[i] + 14} y={top + 28} className={a.tB}>{h}</text>
        ))}
        {rows.map((r, i) => {
          const y = top + rh * (i + 1);
          return (
            <g key={r[0]}>
              {r[3] === "" && <rect x={472} y={y + 6} width={136} height={rh - 12} rx={6} className={`${a.accent} ${a.dash}`} />}
              {r.map((cell, j) => (
                <text key={j} x={cols[j] + 14} y={y + 28} className={`${a.tSm}${j === 0 || j === 2 ? ` ${a.mono}` : ""}`}>
                  {cell === "" ? (b === "fr" ? "(vide)" : "(empty)") : cell}
                </text>
              ))}
            </g>
          );
        })}
      </g>
    );
  },
};

/** 3c — extracted values become a segment that every view can filter to. */
export const valuesBecomeSegments: ArtSpec = {
  title: { en: "Values become segments", fr: "Des valeurs aux segments" },
  caption: {
    en: "An extractor named type returns product, article or page; a segment keeps the 312 product pages, and Issues can then be read for those pages alone.",
    fr: "Un extracteur nommé type renvoie product, article ou page; un segment garde les 312 pages produit, et la vue Problèmes peut alors se lire pour ces pages seulement.",
  },
  draw: (b: ArtBase) => {
    const t =
      b === "fr"
        ? { ex: "Extracteur : type", seg: "Segment : product", pages: "312 pages", issues: "Problèmes dans ce segment" }
        : { ex: "Extractor: type", seg: "Segment: product", pages: "312 pages", issues: "Issues in this segment" };
    return (
      <g>
        <Box x={20} y={68} w={170} h={56} r={12} cls={a.card2} />
        <text x={105} y={102} textAnchor="middle" className={a.tB}>{t.ex}</text>
        <Arrow x1={192} y1={96} x2={226} y2={96} />
        <Chip x={230} y={36} w={120} h={34} text="product" textCls={`${a.tB} ${a.mono}`} />
        <Chip x={230} y={80} w={120} h={34} text="article" cls={a.card} textCls={`${a.tSm} ${a.mono}`} />
        <Chip x={230} y={124} w={120} h={34} text="page" cls={a.card} textCls={`${a.tSm} ${a.mono}`} />
        <Arrow x1={352} y1={53} x2={396} y2={88} tone="accent" />
        <Box x={400} y={62} w={210} h={68} r={12} cls={a.accent} />
        <text x={505} y={92} textAnchor="middle" className={a.tB}>{t.seg}</text>
        <text x={505} y={114} textAnchor="middle" className={a.tMuted}>{t.pages}</text>
        <Arrow x1={505} y1={132} x2={505} y2={186} tone="accent" />
        <Box x={250} y={190} w={360} h={140} r={12} />
        <text x={270} y={220} className={a.tB}>{t.issues}</text>
        {[
          { w: 250, cls: a.red },
          { w: 170, cls: a.amber },
          { w: 110, cls: a.amber },
        ].map((bar, i) => (
          <rect key={i} x={270} y={238 + i * 28} width={bar.w} height={16} rx={8} className={bar.cls} />
        ))}
      </g>
    );
  },
};
