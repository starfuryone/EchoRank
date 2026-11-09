// src/lib/page-archive/spool.ts — page objects that could not be uploaded.
//
// One file per object (mode 600) in pageSpoolDir(), named so a lexical sort is
// write order: a run's manifest is spooled after its pages and therefore
// uploaded after them, so "no manifest" still means "incomplete". The
// purchase-archive worker's drain job uploads this directory too.

import "server-only";

import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ObjectStore, PutOptions } from "@/lib/spaces/client";
import { pageSpoolDir } from "./config";

export interface SpooledPageObject {
  v: 1;
  key: string;
  opts: PutOptions;
  bodyB64: string;
}

let seq = 0;

function spoolName(): string {
  seq = (seq + 1) % 1_000_000;
  return `${String(Date.now()).padStart(15, "0")}-${String(process.pid).padStart(7, "0")}-${String(seq).padStart(6, "0")}.json`;
}

export async function spoolPageObject(key: string, body: Buffer, opts: PutOptions, dir = pageSpoolDir()): Promise<string> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const name = spoolName();
  const tmp = join(dir, `.${name}.tmp`);
  const rec: SpooledPageObject = { v: 1, key, opts, bodyB64: body.toString("base64") };
  await writeFile(tmp, JSON.stringify(rec), { mode: 0o600, flag: "wx" });
  await rename(tmp, join(dir, name));
  return name;
}

export async function listPageSpool(dir = pageSpoolDir()): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((n) => n.endsWith(".json") && !n.startsWith(".")).sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/** Upload oldest first; stop at the first failure so order holds. */
export async function drainPageSpool(store: ObjectStore, opts: { dir?: string; limit?: number } = {}): Promise<{ uploaded: number; remaining: number; failed: boolean }> {
  const dir = opts.dir ?? pageSpoolDir();
  const names = await listPageSpool(dir);
  let uploaded = 0;
  let failed = false;
  for (const name of names.slice(0, opts.limit ?? 1_000)) {
    let rec: SpooledPageObject;
    try {
      rec = JSON.parse(await readFile(join(dir, name), "utf8")) as SpooledPageObject;
    } catch {
      continue; // unreadable: left for a human, never deleted unread
    }
    try {
      await store.put(rec.key, Buffer.from(rec.bodyB64, "base64"), rec.opts);
      await unlink(join(dir, name));
      uploaded++;
    } catch {
      failed = true;
      break;
    }
  }
  return { uploaded, remaining: (await listPageSpool(dir)).length, failed };
}
