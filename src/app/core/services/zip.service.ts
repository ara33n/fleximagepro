import { Injectable } from '@angular/core';

interface ZipEntry {
  name: string;
  blob: Blob;
}

@Injectable({ providedIn: 'root' })
export class ZipService {
  async create(entries: ZipEntry[]): Promise<Blob> {
    const fileParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
      const data = new Uint8Array(await entry.blob.arrayBuffer());
      const name = this.encodeName(entry.name);
      const crc = this.crc32(data);
      const localHeader = this.localHeader(name, crc, data.length);
      const centralHeader = this.centralHeader(name, crc, data.length, offset);

      fileParts.push(localHeader, data);
      centralParts.push(centralHeader);
      offset += localHeader.length + data.length;
    }

    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const endRecord = this.endRecord(entries.length, centralSize, offset);

    const parts = [...fileParts, ...centralParts, endRecord];
    const totalSize = parts.reduce((total, part) => total + part.length, 0);
    const zipBytes = new Uint8Array(totalSize);
    let cursor = 0;
    for (const part of parts) {
      zipBytes.set(part, cursor);
      cursor += part.length;
    }

    return new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' });
  }

  private localHeader(name: Uint8Array, crc: number, size: number): Uint8Array {
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);
    return header;
  }

  private centralHeader(name: Uint8Array, crc: number, size: number, offset: number): Uint8Array {
    const header = new Uint8Array(46 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, size, true);
    view.setUint32(24, size, true);
    view.setUint16(28, name.length, true);
    view.setUint32(42, offset, true);
    header.set(name, 46);
    return header;
  }

  private endRecord(count: number, centralSize: number, centralOffset: number): Uint8Array {
    const record = new Uint8Array(22);
    const view = new DataView(record.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, count, true);
    view.setUint16(10, count, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
    return record;
  }

  private encodeName(name: string): Uint8Array {
    return new TextEncoder().encode(name.replace(/[\\/:*?"<>|]+/g, '-'));
  }

  private crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
}
