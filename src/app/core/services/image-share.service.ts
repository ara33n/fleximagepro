import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PageLoaderService } from './page-loader.service';

export interface ImageShareResponse {
  id: string;
  shareUrl: string;
  qrCodeDataUrl: string;
  expiresAt: string;
  imageCount: number;
}

export interface ImageShareUpload {
  blob: Blob;
  fileName: string;
}

export interface SharedImage {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
  downloadUrl: string;
}

export interface ImageShareBatch {
  id: string;
  createdAt: string;
  expiresAt: string;
  images: SharedImage[];
}

@Injectable({ providedIn: 'root' })
export class ImageShareService {
  private readonly loader = inject(PageLoaderService);
  private readonly apiBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');
  private readonly allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf']);

  async uploadBatch(images: ImageShareUpload[]): Promise<ImageShareResponse> {
    if (!this.apiBaseUrl) {
      throw new Error('Sharing is not configured.');
    }
    if (!images.length) {
      throw new Error('No images are ready to share.');
    }
    if (images.length > 10) {
      throw new Error('You can share up to 10 images at a time.');
    }
    if (images.some((image) => !this.allowedTypes.has(image.blob.type))) {
      throw new Error('Sharing supports JPG, PNG, WebP, SVG, and PDF files only.');
    }

    const formData = new FormData();
    for (const image of images) {
      formData.append('images', image.blob, image.fileName);
    }

    const response = await this.loader.track(fetch(`${this.apiBaseUrl}/api/images/batch`, {
      method: 'POST',
      body: formData,
    }));

    if (!response.ok) {
      throw new Error(await this.errorMessage(response));
    }

    const body = (await response.json()) as Partial<ImageShareResponse>;
    if (!body.id || !body.shareUrl || !body.qrCodeDataUrl || !body.expiresAt) {
      throw new Error('Image sharing failed.');
    }
    return body as ImageShareResponse;
  }

  async getBatch(id: string): Promise<ImageShareBatch> {
    if (!this.apiBaseUrl) {
      throw new Error('Sharing is not configured.');
    }

    const response = await this.loader.track(fetch(`${this.apiBaseUrl}/api/images/batch/${encodeURIComponent(id)}`));
    if (!response.ok) {
      throw new Error(await this.errorMessage(response));
    }

    const body = (await response.json()) as ImageShareBatch;
    if (!body.id || !Array.isArray(body.images)) {
      throw new Error('Share link could not be loaded.');
    }
    return body;
  }

  private async errorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { error?: string };
      return body.error || 'Image sharing failed.';
    } catch {
      return 'Image sharing failed.';
    }
  }
}
