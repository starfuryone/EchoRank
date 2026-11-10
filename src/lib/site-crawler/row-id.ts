// src/lib/site-crawler/row-id.ts
//
// Row ids for the crawler's batched inserts (runner.ts writeBatch).
//
// Prisma fills `@default(cuid())` itself, row by row; a multi-row INSERT of
// pages, then of their issues and links, needs each page's id before the
// page exists. These have the cuid shape the tables already hold (25
// characters, "c" first) and increase within a process: a base-36 millisecond
// timestamp, a counter, a process fingerprint, then randomness. Cursor paging
// (orderBy id) only needs them unique and stable, which they are.

import "server-only";
import { randomBytes } from "node:crypto";

const BLOCK = 36 ** 4;
let counter = randomBytes(4).readUInt32BE(0) % BLOCK;
const fingerprint = (process.pid % BLOCK).toString(36).padStart(4, "0");

function random36(chars: number): string {
  let out = "";
  while (out.length < chars) out += randomBytes(8).readBigUInt64BE(0).toString(36);
  return out.slice(0, chars);
}

/** A new 25-character cuid-shaped id. */
export function newRowId(now: number = Date.now()): string {
  counter = (counter + 1) % BLOCK;
  return `c${now.toString(36).padStart(8, "0")}${counter.toString(36).padStart(4, "0")}${fingerprint}${random36(8)}`;
}
