import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { ToolFaq } from '../models/image-job.model';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly faqSchemaId = 'faq-schema';
  private readonly breadcrumbSchemaId = 'breadcrumb-schema';

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
    this.updateFaqSchema();
    this.updateBreadcrumbSchema();
  }

  updateFaqSchema(faqs: ToolFaq[] = []): void {
    const existing = this.document.getElementById(this.faqSchemaId);

    if (!faqs.length) {
      existing?.remove();
      return;
    }

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };

    const script = existing || this.document.createElement('script');
    script.id = this.faqSchemaId;
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify(schema);

    if (!existing) {
      this.document.head.appendChild(script);
    }
  }

  updateBreadcrumbSchema(items: { name: string; item: string }[] = []): void {
    const existing = this.document.getElementById(this.breadcrumbSchemaId);

    if (!items.length) {
      existing?.remove();
      return;
    }

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((entry, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: entry.name,
        item: entry.item,
      })),
    };

    const script = existing || this.document.createElement('script');
    script.id = this.breadcrumbSchemaId;
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify(schema);

    if (!existing) {
      this.document.head.appendChild(script);
    }
  }

  private updateCanonicalUrl(): void {
    // Use the production origin so canonical URLs are always correct,
    // even during SSG prerendering where document.location.origin is http://localhost.
    const canonicalUrl = `${environment.siteUrl}${this.document.location.pathname}`;
    let canonicalLink = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!canonicalLink) {
      canonicalLink = this.document.createElement('link');
      canonicalLink.rel = 'canonical';
      this.document.head.appendChild(canonicalLink);
    }

    canonicalLink.href = canonicalUrl;
  }
}
