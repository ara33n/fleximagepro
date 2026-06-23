import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  update(title: string, description: string, keywords?: string): void {
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({
      name: 'keywords',
      content:
        keywords ||
        'image compressor, image converter, image resizer, WebP converter, JPG to PNG, PNG to JPG, private image tools',
    });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.updateCanonicalUrl();
  }

  private updateCanonicalUrl(): void {
    const canonicalUrl = `${this.document.location.origin}${this.document.location.pathname}`;
    let canonicalLink = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!canonicalLink) {
      canonicalLink = this.document.createElement('link');
      canonicalLink.rel = 'canonical';
      this.document.head.appendChild(canonicalLink);
    }

    canonicalLink.href = canonicalUrl;
  }
}
