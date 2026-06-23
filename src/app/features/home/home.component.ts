import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { AdSlotComponent } from '../../shared/components/ad-slot/ad-slot.component';

interface ToolCard {
  title: string;
  description: string;
  path: string;
  badge: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, AdSlotComponent],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly seo = inject(SeoService);

  readonly tools: ToolCard[] = [
    {
      title: 'Image Compressor',
      description: 'Shrink JPG, PNG, and WebP files with quality controls and instant size savings.',
      path: '/compress',
      badge: 'Compress',
    },
    {
      title: 'Image to WebP',
      description: 'Export lightweight WebP images from common image formats without a server round-trip.',
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
  ];

  readonly steps = [
    'Choose a tool and add up to 10 images.',
    'Adjust quality, dimensions, or output format.',
    'Preview the before and after result, then download one file or all processed files.',
  ];

  constructor() {
    this.seo.update(
      'FlexImagePro - Compress, Convert and Resize Images',
      'Free browser-side image tools for compression, WebP conversion, resizing, and JPG/PNG conversion. No uploads or backend required.',
    );
  }

  trackByPath(_: number, item: ToolCard): string {
    return item.path;
  }

  trackByStep(index: number): number {
    return index;
  }
}
