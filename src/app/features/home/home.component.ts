import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { PendingFilesService } from '../../core/services/pending-files.service';
import { SeoService } from '../../core/services/seo.service';
import { AdSlotComponent } from '../../shared/components/ad-slot/ad-slot.component';

interface ToolCard {
  title: string;
  description: string;
  path: string;
  badge: string;
  label: string;
  accept: string[];
}

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is FlexImagePro free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, FlexImagePro is completely free to use. All image tools — including the compressor, WebP converter, image resizer, and JPG/PNG converter — are available at no cost with no sign-up required.',
      },
    },
    {
      '@type': 'Question',
      name: 'Are my images uploaded to a server?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. FlexImagePro processes every image directly in your browser using the HTML5 Canvas API. Your files never leave your device and are never transmitted to any server.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which image formats are supported?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'FlexImagePro supports JPEG (JPG), PNG, and WebP formats for compression and resizing. The JPG to PNG converter handles JPEG and PNG, and the WebP converter can export any of these formats to WebP.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I compress multiple images at once?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. You can upload and process up to 10 images in a single batch. Once processed, you can download them individually or as a single ZIP archive with one click.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I convert JPG to WebP?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The Image to WebP Converter tool lets you convert JPEG, PNG, or WebP images to the WebP format, which produces smaller file sizes with similar or better visual quality — ideal for web performance.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I resize images without losing quality?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'FlexImagePro uses high-quality Canvas rendering to resize images. For best results, resize downwards (making images smaller) rather than upwards, as enlarging any image introduces interpolation artefacts regardless of the tool used.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does FlexImagePro work on mobile devices?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. FlexImagePro is fully responsive and works on smartphones, tablets, and desktop browsers. The Canvas API is supported on all modern mobile browsers including Safari on iOS and Chrome on Android.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is image processing private and secure?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Completely. Because all processing happens locally in your browser, no image data is ever sent to a server or third party. FlexImagePro does not store, analyse, or have access to any of your images.',
      },
    },
  ],
};

const ALL_RASTER = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/x-icon', 'image/vnd.microsoft.icon'];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, AdSlotComponent],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ height: 0, opacity: 0, overflow: 'hidden' }),
        animate('260ms cubic-bezier(0.4,0,0.2,1)', style({ height: '*', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.4,0,0.2,1)', style({ height: 0, opacity: 0, overflow: 'hidden' })),
      ]),
    ]),
  ],
})
export class HomeComponent implements OnDestroy {
  private readonly seo = inject(SeoService);
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly pendingFiles = inject(PendingFilesService);
  private faqScript: HTMLScriptElement | null = null;

  readonly openFaq = signal<number | null>(null);
  readonly homeIsDragging = signal(false);
  readonly homePendingFiles = signal<File[]>([]);

  toggleFaq(index: number): void {
    this.openFaq.update(current => (current === index ? null : index));
  }

  readonly tools: ToolCard[] = [
    {
      title: 'Image Compressor',
      label: 'Image Compressor',
      description: 'Shrink JPG, PNG, and WebP files with quality controls and instant size savings.',
      path: '/compress',
      badge: 'Compress',
      accept: ALL_RASTER,
    },
    {
      title: 'Image to WebP',
      label: 'Image to WebP',
      description: 'Export lightweight WebP images from common image formats without a server round-trip.',
      path: '/convert-webp',
      badge: 'Convert',
      accept: ALL_RASTER,
    },
    {
      title: 'Image Resizer',
      label: 'Image Resizer',
      description: 'Set custom dimensions and keep aspect ratio locked for clean responsive assets.',
      path: '/resize',
      badge: 'Resize',
      accept: ALL_RASTER,
    },
    {
      title: 'JPG to PNG / PNG to JPG',
      label: 'JPG ↔ PNG',
      description: 'Switch between JPG and PNG for transparent graphics, thumbnails, and publishing.',
      path: '/jpg-to-png',
      badge: 'Format',
      accept: ['image/jpeg', 'image/png'],
    },
    {
      title: 'PNG to SVG Converter',
      label: 'PNG to SVG',
      description: 'Trace PNG, JPG and WebP images into scalable SVG vector files — ideal for logos and flat graphics.',
      path: '/png-to-svg',
      badge: 'Vector',
      accept: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'],
    },
  ];

  readonly steps = [
    'Choose a tool and add up to 10 images.',
    'Adjust quality, dimensions, or output format.',
    'Preview the before and after result, then download one file or all processed files.',
  ];

  readonly faqs: FaqItem[] = [
    {
      question: 'Is FlexImagePro free to use?',
      answer:
        'Yes, FlexImagePro is completely free to use. All image tools — including the compressor, WebP converter, image resizer, and JPG/PNG converter — are available at no cost with no sign-up required.',
    },
    {
      question: 'Are my images uploaded to a server?',
      answer:
        'No. FlexImagePro processes every image directly in your browser using the HTML5 Canvas API. Your files never leave your device and are never transmitted to any server.',
    },
    {
      question: 'Which image formats are supported?',
      answer:
        'FlexImagePro supports JPEG (JPG), PNG, and WebP formats for compression and resizing. The JPG to PNG converter handles JPEG and PNG, and the WebP converter can export any of these formats to WebP.',
    },
    {
      question: 'Can I compress multiple images at once?',
      answer:
        'Yes. You can upload and process up to 10 images in a single batch. Once processed, you can download them individually or as a single ZIP archive with one click.',
    },
    {
      question: 'Can I convert JPG to WebP?',
      answer:
        'Yes. The Image to WebP Converter tool lets you convert JPEG, PNG, or WebP images to the WebP format, which produces smaller file sizes with similar or better visual quality — ideal for web performance.',
    },
    {
      question: 'Can I resize images without losing quality?',
      answer:
        'FlexImagePro uses high-quality Canvas rendering to resize images. For best results, resize downwards (making images smaller) rather than upwards, as enlarging any image introduces interpolation artefacts regardless of the tool used.',
    },
    {
      question: 'Does FlexImagePro work on mobile devices?',
      answer:
        'Yes. FlexImagePro is fully responsive and works on smartphones, tablets, and desktop browsers. The Canvas API is supported on all modern mobile browsers including Safari on iOS and Chrome on Android.',
    },
    {
      question: 'Is image processing private and secure?',
      answer:
        'Completely. Because all processing happens locally in your browser, no image data is ever sent to a server or third party. FlexImagePro does not store, analyse, or have access to any of your images.',
    },
  ];

  constructor() {
    this.seo.update(
      'FlexImagePro - Compress, Convert and Resize Images',
      'Free browser-side image tools for compression, WebP conversion, resizing, and JPG/PNG conversion. No uploads or backend required.',
    );
    this.faqScript = this.doc.createElement('script');
    this.faqScript.type = 'application/ld+json';
    this.faqScript.text = JSON.stringify(FAQ_SCHEMA);
    this.doc.head.appendChild(this.faqScript);
  }

  ngOnDestroy(): void {
    this.faqScript?.remove();
    this.faqScript = null;
  }

  onHomeDragOver(event: DragEvent): void {
    event.preventDefault();
    this.homeIsDragging.set(true);
  }

  onHomeDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.homeIsDragging.set(false);
  }

  onHomeDrop(event: DragEvent): void {
    event.preventDefault();
    this.homeIsDragging.set(false);
    const files = Array.from(event.dataTransfer?.files || [])
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 10);
    if (files.length) {
      this.homePendingFiles.set(files);
    }
  }

  onHomeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || [])
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 10);
    input.value = '';
    if (files.length) {
      this.homePendingFiles.set(files);
    }
  }

  sendToTool(tool: ToolCard): void {
    const files = this.homePendingFiles().filter(f => tool.accept.includes(f.type));
    if (!files.length) return;
    this.pendingFiles.set(files);
    this.homePendingFiles.set([]);
    void this.router.navigate([tool.path]);
  }

  clearHomePending(): void {
    this.homePendingFiles.set([]);
  }

  trackByPath(_: number, item: ToolCard): string {
    return item.path;
  }

  trackByStep(index: number): number {
    return index;
  }
}
