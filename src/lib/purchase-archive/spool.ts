// src/lib/purchase-archive/spool.ts — the local spool, for when Spaces (or the
// queue) is unreachable.
//
// One file per object, mode 600, in spoolDir() (root creates it, owned by
// echorank, mode 700). The name starts with the receive time in ms, zero-padded,
// so a lexical sort is arrival order and the drain uploads oldest first. Each
// file is written to a .tmp name and renamed, so a drain never reads half a file.

import "server-only";

import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PreparedObject } from "./core";
import { spoolDir } from "./config";

/** A PreparedObject as JSON (the BullMQ job payload and the spool file). */
export type SerializedObject = Omit<PreparedObject, "gz"> & { gzB64: string };

export function serializeObject(o: PreparedObject): SerializedObject {
  const { gz, ...rest } = o;
  return { ...rest, gzB64: gz.toString("base64") };
}

export function deserializeObject(s: SerializedObject): PreparedObject {
  const { gzB64, ...rest } = s;
  return { ...rest, gz: Buffer.from(gzB64, "base64") };
}

export function spoolFileName(o: Pick<PreparedObject, "receivedAt" | "dedupeKey">): string {
  const ms = String(new Date(o.receivedAt).getTime()).padStart(15, "0");
  return `${ms}-${o.dedupeKey.slice(0, 24)}.json`;
}

/** Write one object to the spool. Throws when the directory is not writable. */
export async function writeSpool(o: PreparedObject, dir = spoolDir()): Promise<string> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const name = spoolFileName(o);
  const tmp = join(dir, `.${name}.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(serializeObject(o)), { mode: 0o600, flag: "wx" });
  await rename(tmp, join(dir, name));
  return name;
}

/** Spooled object files, oldest first. A missing directory is an empty spool. */
export async function listSpool(dir = spoolDir()): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((n) => n.endsWith(".json") && !n.startsWith(".")).sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function readSpool(name: string, dir = spoolDir()): Promise<PreparedObject> {
  return deserializeObject(JSON.parse(await readFile(join(dir, name), "utf8")) as SerializedObject);
}

export async function removeSpool(name: string, dir = spoolDir()): Promise<void> {
  await unlink(join(dir, name));
}

export async function spoolStats(dir = spoolDir()): Promise<{ files: number; bytes: number }> {
  const names = await listSpool(dir);
  let bytes = 0;
  for (const n of names) {
    try {
      bytes += (await stat(join(dir, n))).size;
    } catch {
      // drained between the list and the stat
    }
  }
  return { files: names.length, bytes };
}
