// src/lib/keyword-scan-limits.ts — the free keyword scan's allowance, in one
// dependency-free place: the route enforces it (src/app/api/av/keywords) and
// /ai-visibility states it. Redis INCR keyed on cf-connecting-ip, with a
// 24-hour TTL from the first scan.

export const KEYWORD_SCAN_LIMIT_PER_DAY = 2;
export const KEYWORD_SCAN_WINDOW_SECONDS = 24 * 60 * 60;
