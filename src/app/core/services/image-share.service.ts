import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface ImageShareResponse {
  id: string;
  downloadUrl: string;
  qrCodeDataUrl: string;
  expiresAt: string;
}

export interface ImageShareUpload {
  blob: Blob;
  fileName: string;
}

@Injectable({ providedIn: 'root' })
export class ImageShareService {
  private readonly apiBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');
  private readonly allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

  async uploadBatch(images: ImageShareUpload[]): Promise<ImageShareResponse[]> {
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
      throw new Error('Sharing supports JPG, PNG, and WebP images only.');
    }

    const formData = new FormData();
    for (const image of images) {
      formData.append('images', image.blob, image.fileName);
    }

    const response = await fetch(`${this.apiBaseUrl}/api/images/batch`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await this.errorMessage(response));
    }

    const body = (await response.json()) as { images?: ImageShareResponse[] };
    if (!Array.isArray(body.images)) {
      throw new Error('Image sharing failed.');
    }
    return body.images;
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
