import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { SeoService } from '../../core/services/seo.service';
import { AdSlotComponent } from '../../shared/components/ad-slot/ad-slot.component';

interface ToolCard {
  title: string;
  description: string;
  path: string;
  badge: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

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
export class HomeComponent {
  private readonly seo = inject(SeoService);

  readonly openFaq = signal<number | null>(0);

  toggleFaq(index: number): void {
    this.openFaq.update(current => (current === index ? null : index));
  }

  readonly tools: ToolCard[] = [
    {
      title: 'Image Compressor',
      description: 'Shrink JPG, PNG, and WebP files with quality controls and instant size savings.',
      path: '/compress',
      badge: 'Compress',
    },
    {
      title: 'Image to WebP',
      description: 'Export lightweight WebP images from common image formats.',
      path: '/convert-webp',
      badge: 'Convert',
    },
    {
      title: 'Image Resizer',
      description: 'Set custom dimensions and keep aspect ratio locked for clean responsive assets.',
      path: '/resize',
      badge: 'Resize',
    },
    {
      title: 'JPG to PNG / PNG to JPG',
      description: 'Switch between JPG and PNG for transparent graphics, thumbnails, and publishing.',
      path: '/jpg-to-png',
      badge: 'Format',
    },
    {
      title: 'PNG to SVG Converter',
      description: 'Trace PNG images into scalable SVG vector files — ideal for logos and flat graphics.',
      path: '/png-to-svg',
      badge: 'Vector',
    },
    {
      title: 'Images to PDF',
      description: 'Combine JPG, PNG, WebP, AVIF, SVG, GIF, BMP, ICO and phone photos into one PDF.',
      path: '/images-to-pdf',
      badge: 'PDF',
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
      question: 'Which tools are available?',
      answer:
        'FlexImagePro includes image compression, resizing, format conversion, image effects, PDF tools, text tools, and more utilities for everyday work.',
    },
    {
      question: 'Which image formats are supported?',
      answer:
        'FlexImagePro supports JPG, PNG, WebP, AVIF, ICO, SVG, GIF, BMP, and other browser-supported image formats depending on the selected tool. The Images to PDF converter can combine many common image files into one PDF.',
    },
    {
      question: 'Can I compress multiple images at once?',
      answer:
        'Yes. Most image tools process up to 10 images in a batch, and the Images to PDF converter supports up to 20 images for one PDF document.',
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
      question: 'Can I download processed files?',
      answer:
        'Yes. You can download single processed files, bulk ZIP files where supported, or generated text and PDF outputs from their tool pages.',
    },
  ];

  constructor() {
    this.seo.update(
      'FlexImagePro - Compress, Convert and Resize Images',
      'Free image tools for compression, WebP conversion, resizing, JPG/PNG conversion, and everyday utility workflows.',
    );
    this.seo.updateFaqSchema(this.faqs);
  }

  trackByPath(_: number, item: ToolCard): string {
    return item.path;
  }

  trackByStep(index: number): number {
    return index;
  }
}
