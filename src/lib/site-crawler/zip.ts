// src/lib/site-crawler/zip.ts
//
// A minimal ZIP writer (PKWARE APPNOTE 6.3, deflate, no ZIP64) for the
// sitemap download. Entries are added one at a time and emitted as they are
// added, so the archive streams: only the entry being compressed and the
// central-directory records (a few dozen bytes per file) are held.
//
// Limits that hold for this use: fewer than 65,535 entries, each file and the
// whole archive under 4 GiB. A sitemap file is at most 50,000 URLs (~10 MB).

import "server-only";
import { crc32, deflateRawSync } from "node:zlib";

interface CentralRecord {
  name: Buffer;
  crc: number;
  compressed: number;
  size: number;
  offset: number;
  dosTime: number;
  dosDate: number;
}

function dosDateTime(d: Date): { dosTime: number; dosDate: number } {
  return {
    dosTime: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
    dosDate: ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

export class ZipWriter {
  private readonly records: CentralRecord[] = [];
  private offset = 0;

  constructor(
    /** Receives each chunk of the archive, in order. */
    private readonly emit: (chunk: Uint8Array) => void,
    private readonly now: Date = new Date(),
  ) {}

  addFile(name: string, content: string | Buffer): void {
    const data = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    const deflated = deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const { dosTime, dosDate } = dosDateTime(this.now);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // local file header
    header.writeUInt16LE(20, 4); // version needed: 2.0 (deflate)
    header.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    header.writeUInt16LE(8, 8); // method: deflate
    header.writeUInt16LE(dosTime, 10);
    header.writeUInt16LE(dosDate, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(deflated.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28); // extra length

    this.records.push({ name: nameBuf, crc, compressed: deflated.length, size: data.length, offset: this.offset, dosTime, dosDate });
    this.emit(header);
    this.emit(nameBuf);
    this.emit(deflated);
    this.offset += header.length + nameBuf.length + deflated.length;
  }

  /** Write the central directory. Nothing may be added after this. */
  finish(): void {
    const start = this.offset;
    for (const r of this.records) {
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0); // central directory header
      c.writeUInt16LE((3 << 8) | 20, 4); // made by: Unix, 2.0 (so the mode below is read)
      c.writeUInt16LE(20, 6); // version needed
      c.writeUInt16LE(0x0800, 8);
      c.writeUInt16LE(8, 10);
      c.writeUInt16LE(r.dosTime, 12);
      c.writeUInt16LE(r.dosDate, 14);
      c.writeUInt32LE(r.crc, 16);
      c.writeUInt32LE(r.compressed, 20);
      c.writeUInt32LE(r.size, 24);
      c.writeUInt16LE(r.name.length, 28);
      // extra, comment, disk start, internal attrs: 0
      c.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attrs: regular file, rw-r--r--
      c.writeUInt32LE(r.offset, 42);
      this.emit(c);
      this.emit(r.name);
      this.offset += c.length + r.name.length;
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); // end of central directory
    end.writeUInt16LE(this.records.length, 8);
    end.writeUInt16LE(this.records.length, 10);
    end.writeUInt32LE(this.offset - start, 12);
    end.writeUInt32LE(start, 16);
    this.emit(end);
  }
}
