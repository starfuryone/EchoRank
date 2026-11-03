// SERP pixel-width estimate. Google truncates titles and descriptions by
// rendered width, not character count, so "60 characters" is a proxy for the
// real limit. Widths are Arial's advance widths in 1/1000 em for printable
// ASCII; anything else gets an average Latin width, and CJK a full em.

const ASCII_WIDTHS: number[] = [
  // 32..47:  space ! " # $ % & ' ( ) * + , - . /
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  // 48..63:  0-9 : ; < = > ?
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  // 64..79:  @ A-O
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  // 80..95:  P-Z [ \ ] ^ _
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  // 96..111: ` a-o
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  // 112..126: p-z { | } ~
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Title font size in a desktop SERP. */
export const TITLE_FONT_PX = 20;
/** Description font size in a desktop SERP. */
export const DESCRIPTION_FONT_PX = 14;

function charWidth(code: number): number {
  if (code >= 32 && code <= 126) return ASCII_WIDTHS[code - 32]!;
  if (code >= 0x2e80) return 1000;
  return 556;
}

/** Estimated rendered width in pixels, rounded. */
export function pixelWidth(text: string, fontPx: number): number {
  let units = 0;
  for (let i = 0; i < text.length; i++) units += charWidth(text.charCodeAt(i));
  return Math.round((units * fontPx) / 1000);
}
