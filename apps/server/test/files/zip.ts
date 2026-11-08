// ZIP archives for tests of uploads and scans (APPNOTE.TXT of PKWARE): local headers, central
// directory and its end record, without ZIP64.
import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipEntry {
  name: string;
  content: Buffer;
  /** Sets the encryption flag; the content is stored as it is. */
  isEncrypted?: boolean;
  /** Deflated instead of stored, e.g. for a small archive with a large entry. */
  isDeflated?: boolean;
}

const STORED = 0;
const DEFLATED = 8;
const ENCRYPTED_FLAG = 0x1;
const VERSION = 20;

export function zipArchive(entries: readonly ZipEntry[]): Buffer {
  const records: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = entry.isDeflated ? deflateRawSync(entry.content) : entry.content;
    const fields = {
      flags: entry.isEncrypted ? ENCRYPTED_FLAG : 0,
      method: entry.isDeflated ? DEFLATED : STORED,
      crc: crc32(entry.content),
      compressedSize: data.length,
      size: entry.content.length,
    };
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(fields.flags, 6);
    local.writeUInt16LE(fields.method, 8);
    local.writeUInt32LE(fields.crc, 14);
    local.writeUInt32LE(fields.compressedSize, 18);
    local.writeUInt32LE(fields.size, 22);
    local.writeUInt16LE(name.length, 26);
    records.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(VERSION, 4);
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(fields.flags, 8);
    central.writeUInt16LE(fields.method, 10);
    central.writeUInt32LE(fields.crc, 16);
    central.writeUInt32LE(fields.compressedSize, 20);
    central.writeUInt32LE(fields.size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const directorySize = directory.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...records, ...directory, end]);
}
