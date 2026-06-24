import { Injectable } from '@angular/core';
import { OutputFormat, ProcessOptions, ProcessedImage } from '../models/image-job.model';

@Injectable({ providedIn: 'root' })
export class ImageProcessorService {
  async getDimensions(file: File): Promise<{ width: number; height: number }> {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  async process(file: File, options: ProcessOptions): Promise<ProcessedImage> {
    const bitmap = await createImageBitmap(file);
    const targetWidth = Math.max(1, Math.round(options.width || bitmap.width));
    const targetHeight = Math.max(1, Math.round(options.height || bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      bitmap.close();
      throw new Error('Canvas is not supported in this browser.');
    }

    const format = this.resolveFormat(file, options.outputFormat);
    if (format === 'jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, targetWidth, targetHeight);
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const mimeType = this.mimeForFormat(format);
    const quality = format === 'png' ? undefined : Math.min(1, Math.max(0.1, options.quality / 100));
    const blob = await this.canvasToBlob(canvas, mimeType, quality);

    return {
      blob,
      url: URL.createObjectURL(blob),
      fileName: this.rename(file.name, format),
      width: targetWidth,
      height: targetHeight,
    };
  }

  async processToSvg(file: File, colorCount: number): Promise<ProcessedImage> {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      bitmap.close();
      throw new Error('Canvas is not supported in this browser.');
    }

    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const ImageTracer = (await import('imagetracerjs')) as any;
    const tracer = ImageTracer.default ?? ImageTracer;
    const svgString: string = tracer.imagedataToSVG(imageData, {
      numberofcolors: Math.max(2, Math.min(100, colorCount)),
      colorsampling: 2,
      pathomit: 8,
    });

    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    return {
      blob,
      url: URL.createObjectURL(blob),
      fileName: this.renameSvg(file.name),
      width: canvas.width,
      height: canvas.height,
    };
  }

  private canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Image processing failed.'));
            return;
          }
          resolve(blob);
        },
        mimeType,
        quality,
      );
    });
  }

  private resolveFormat(file: File, outputFormat: OutputFormat): 'jpeg' | 'png' | 'webp' {
    if (outputFormat === 'webp' || outputFormat === 'png' || outputFormat === 'jpeg') {
      return outputFormat;
    }

    if (outputFormat === 'auto') {
      return file.type === 'image/png' ? 'jpeg' : 'png';
    }

    // AVIF and ICO cannot be output by canvas — map to a supported format
    if (file.type === 'image/avif') {
      return 'webp';
    }
    if (file.type === 'image/x-icon' || file.type === 'image/vnd.microsoft.icon') {
      return 'png';
    }

    if (file.type === 'image/png') {
      return 'png';
    }
    if (file.type === 'image/webp') {
      return 'webp';
    }

    return 'jpeg';
  }

  private mimeForFormat(format: 'jpeg' | 'png' | 'webp'): string {
    return format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
  }

  private rename(name: string, format: 'jpeg' | 'png' | 'webp'): string {
    const extension = format === 'jpeg' ? 'jpg' : format;
    const base = name.replace(/\.[^.]+$/, '');
    return `${base}-${format === 'webp' ? 'webp' : 'optimized'}.${extension}`;
  }

  private renameSvg(name: string): string {
    const base = name.replace(/\.[^.]+$/, '');
    return `${base}.svg`;
  }
}
