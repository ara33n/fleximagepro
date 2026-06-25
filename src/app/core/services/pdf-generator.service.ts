import { Injectable } from '@angular/core';

export type PdfPageSize = 'a4' | 'letter';
export type PdfOrientation = 'portrait' | 'landscape' | 'auto';
export type PdfImageFit = 'contain' | 'cover';

export interface PdfImageInput {
  file: File;
  name: string;
}

export interface PdfOptions {
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  fit: PdfImageFit;
  margin: number;
  quality: number;
}

interface PdfImagePage {
  data: ArrayBuffer;
  width: number;
  height: number;
}

interface PageBox {
  width: number;
  height: number;
}

const PAGE_SIZES: Record<PdfPageSize, PageBox> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

@Injectable({ providedIn: 'root' })
export class PdfGeneratorService {
  async create(images: PdfImageInput[], options: PdfOptions): Promise<Blob> {
    const pages = await Promise.all(images.map((image) => this.renderImage(image.file, options.quality)));
    return this.buildPdf(pages, options);
  }

  private async renderImage(file: File, quality: number): Promise<PdfImagePage> {
    const img = await this.loadImage(file);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, img.naturalWidth || img.width);
    canvas.height = Math.max(1, img.naturalHeight || img.height);

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Canvas is not supported in this browser.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await this.canvasToBlob(canvas, 'image/jpeg', Math.min(0.95, Math.max(0.35, quality / 100)));
    return {
      data: await blob.arrayBuffer(),
      width: canvas.width,
      height: canvas.height,
    };
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`${file.name} could not be decoded by this browser.`));
      };
      img.src = url;
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('PDF image rendering failed.'));
          return;
        }
        resolve(blob);
      }, mimeType, quality);
    });
  }

  private buildPdf(images: PdfImagePage[], options: PdfOptions): Blob {
    const chunks: Array<string | ArrayBuffer> = [];
    const offsets: number[] = [];
    let length = 0;
    let objectId = 1;

    const append = (chunk: string | ArrayBuffer) => {
      chunks.push(chunk);
      length += typeof chunk === 'string' ? this.byteLength(chunk) : chunk.byteLength;
    };

    const writeObject = (body: Array<string | ArrayBuffer>): number => {
      const id = objectId++;
      offsets[id] = length;
      append(`${id} 0 obj\n`);
      for (const part of body) append(part);
      append('\nendobj\n');
      return id;
    };

    append('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    const catalogId = objectId++;
    const pagesId = objectId++;
    const pageIds: number[] = [];

    for (const image of images) {
      const imageId = writeObject([
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.byteLength} >>\nstream\n`,
        image.data,
        '\nendstream',
      ]);

      const pageBox = this.pageBoxFor(image, options);
      const placement = this.imagePlacement(image, pageBox, options);
      const content = [
        'q',
        `${this.num(placement.width)} 0 0 ${this.num(placement.height)} ${this.num(placement.x)} ${this.num(placement.y)} cm`,
        `/Im${imageId} Do`,
        'Q',
      ].join('\n');

      const contentBytes = this.encode(content);
      const contentId = writeObject([
        `<< /Length ${contentBytes.byteLength} >>\nstream\n`,
        contentBytes,
        '\nendstream',
      ]);

      const pageId = writeObject([
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.num(pageBox.width)} ${this.num(pageBox.height)}] /Resources << /XObject << /Im${imageId} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ]);
      pageIds.push(pageId);
    }

    offsets[pagesId] = length;
    append(`${pagesId} 0 obj\n`);
    append(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`);
    append('\nendobj\n');

    offsets[catalogId] = length;
    append(`${catalogId} 0 obj\n`);
    append(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    append('\nendobj\n');

    const xrefOffset = length;
    append(`xref\n0 ${objectId}\n`);
    append('0000000000 65535 f \n');
    for (let id = 1; id < objectId; id++) {
      append(`${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`);
    }
    append(`trailer\n<< /Size ${objectId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return new Blob(chunks, { type: 'application/pdf' });
  }

  private pageBoxFor(image: PdfImagePage, options: PdfOptions): PageBox {
    const base = PAGE_SIZES[options.pageSize];
    const imageLandscape = image.width > image.height;
    const landscape = options.orientation === 'landscape' || (options.orientation === 'auto' && imageLandscape);
    return landscape ? { width: base.height, height: base.width } : base;
  }

  private imagePlacement(image: PdfImagePage, page: PageBox, options: PdfOptions): { x: number; y: number; width: number; height: number } {
    const margin = Math.max(0, Math.min(96, options.margin));
    const availableWidth = Math.max(1, page.width - margin * 2);
    const availableHeight = Math.max(1, page.height - margin * 2);
    const scale = options.fit === 'cover'
      ? Math.max(availableWidth / image.width, availableHeight / image.height)
      : Math.min(availableWidth / image.width, availableHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    return {
      x: (page.width - width) / 2,
      y: (page.height - height) / 2,
      width,
      height,
    };
  }

  private encode(value: string): ArrayBuffer {
    const bytes = new TextEncoder().encode(value);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  private byteLength(value: string): number {
    return this.encode(value).byteLength;
  }

  private num(value: number): string {
    return Number(value.toFixed(2)).toString();
  }
}
