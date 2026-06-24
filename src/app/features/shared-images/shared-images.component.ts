import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ImageShareBatch, ImageShareService, SharedImage } from '../../core/services/image-share.service';
import { SeoService } from '../../core/services/seo.service';
import { ZipService } from '../../core/services/zip.service';

@Component({
  selector: 'app-shared-images',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './shared-images.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedImagesComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly imageShare = inject(ImageShareService);
  private readonly seo = inject(SeoService);
  private readonly zip = inject(ZipService);

  readonly share = signal<ImageShareBatch | null>(null);
  readonly isLoading = signal(true);
  readonly isZipping = signal(false);
  readonly message = signal('');

  ngOnInit(): void {
    this.seo.update(
      'Shared Images - FlexImagePro',
      'View and download images shared from FlexImagePro. Shared image links expire after 24 hours.',
      'shared images, image download, FlexImagePro share',
    );
    void this.loadShare();
  }

  async downloadAll(): Promise<void> {
    const share = this.share();
    if (!share || this.isZipping()) {
      return;
    }

    this.message.set('');
    this.isZipping.set(true);
    try {
      const names = new Map<string, number>();
      const entries = await Promise.all(share.images.map(async (image) => {
        const response = await fetch(image.downloadUrl);
        if (!response.ok) {
          throw new Error('One or more images could not be downloaded.');
        }
        return {
          name: this.uniqueName(image.fileName, names),
          blob: await response.blob(),
        };
      }));
      const archive = await this.zip.create(entries);
      const url = URL.createObjectURL(archive);
      this.clickDownload(url, `fleximagepro-share-${share.id}.zip`);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'ZIP download failed.');
    } finally {
      this.isZipping.set(false);
    }
  }

  download(image: SharedImage): void {
    this.clickDownload(image.downloadUrl, image.fileName);
  }

  formatBytes(bytes = 0): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
  }

  trackByImage(_: number, image: SharedImage): string {
    return image.id;
  }

  private async loadShare(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') || '';
    if (!id) {
      this.message.set('Share link not found.');
      this.isLoading.set(false);
      return;
    }

    try {
      this.share.set(await this.imageShare.getBatch(id));
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'Share link could not be loaded.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private clickDownload(url: string, fileName: string): void {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  }

  private uniqueName(name: string, names: Map<string, number>): string {
    const current = names.get(name) || 0;
    names.set(name, current + 1);
    if (current === 0) {
      return name;
    }

    const dotIndex = name.lastIndexOf('.');
    if (dotIndex < 1) {
      return `${name}-${current + 1}`;
    }
    return `${name.slice(0, dotIndex)}-${current + 1}${name.slice(dotIndex)}`;
  }
}
