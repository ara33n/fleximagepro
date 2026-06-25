import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { SeoService } from '../../core/services/seo.service';
import { PdfGeneratorService, PdfImageFit, PdfOrientation, PdfPageSize } from '../../core/services/pdf-generator.service';
import { ToastService } from '../../core/services/toast.service';
import { AdSlotComponent } from '../../shared/components/ad-slot/ad-slot.component';
import { UploadZoneComponent } from '../../shared/components/upload-zone/upload-zone.component';

interface PdfImageJob {
  id: string;
  file: File;
  name: string;
  type: string;
  url: string;
  size: number;
  width: number;
  height: number;
}

interface PdfOptions {
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  fit: PdfImageFit;
  margin: number;
  quality: number;
}

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/svg+xml',
  'image/gif',
  'image/bmp',
];

@Component({
  selector: 'app-images-to-pdf',
  standalone: true,
  imports: [UploadZoneComponent, AdSlotComponent],
  templateUrl: './images-to-pdf.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImagesToPdfComponent {
  private readonly seo = inject(SeoService);
  private readonly pdf = inject(PdfGeneratorService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private dragDepth = 0;

  readonly acceptedTypes = ACCEPTED_IMAGE_TYPES;
  readonly jobs = signal<PdfImageJob[]>([]);
  readonly isCreating = signal(false);
  readonly pageIsDragging = signal(false);
  readonly options = signal<PdfOptions>({
    pageSize: 'a4',
    orientation: 'auto',
    fit: 'contain',
    margin: 24,
    quality: 88,
  });

  readonly totalSize = computed(() => this.jobs().reduce((total, job) => total + job.size, 0));

  constructor() {
    this.seo.update(
      'Images to PDF Converter - Convert JPG, PNG, WebP and More Online',
      'Convert multiple images to one PDF in your browser. Upload JPG, PNG, WebP, AVIF, SVG, GIF, BMP, ICO, HEIC and other browser-supported image files with private local processing.',
      'images to PDF, image to PDF converter, JPG to PDF, PNG to PDF, WebP to PDF, convert images to PDF online',
    );
    this.destroyRef.onDestroy(() => this.revokeUrls(this.jobs()));
  }

  async addFiles(files: File[]): Promise<void> {
    const existing = this.jobs();
    const capacity = Math.max(0, 20 - existing.length);

    if (!capacity) {
      this.toast.warning('Maximum of 20 images reached. Clear some images first.');
      return;
    }

    if (files.length > capacity) {
      this.toast.warning(`Maximum 20 images allowed. Only the first ${capacity} image${capacity === 1 ? '' : 's'} will be added.`);
    }

    const nextJobs: PdfImageJob[] = [];
    for (const file of files.slice(0, capacity)) {
      try {
        const dimensions = await this.getDimensions(file);
        nextJobs.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          type: file.type || 'image/*',
          url: URL.createObjectURL(file),
          size: file.size,
          width: dimensions.width,
          height: dimensions.height,
        });
      } catch {
        this.toast.error(`${file.name} could not be read by this browser.`);
      }
    }

    if (nextJobs.length) {
      this.jobs.set([...existing, ...nextJobs]);
    }
  }

  remove(jobId: string): void {
    const job = this.jobs().find((item) => item.id === jobId);
    if (job) {
      URL.revokeObjectURL(job.url);
    }
    this.jobs.update((items) => items.filter((item) => item.id !== jobId));
  }

  move(jobId: string, direction: -1 | 1): void {
    const items = [...this.jobs()];
    const index = items.findIndex((item) => item.id === jobId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
      return;
    }
    [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
    this.jobs.set(items);
  }

  clearAll(): void {
    this.revokeUrls(this.jobs());
    this.jobs.set([]);
  }

  async downloadPdf(): Promise<void> {
    const jobs = this.jobs();
    if (!jobs.length || this.isCreating()) {
      return;
    }

    this.isCreating.set(true);
    try {
      const blob = await this.pdf.create(
        jobs.map((job) => ({ file: job.file, name: job.name })),
        this.options(),
      );
      const url = URL.createObjectURL(blob);
      this.clickDownload(url, 'fleximagepro-images.pdf');
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'PDF creation failed.');
    } finally {
      this.isCreating.set(false);
    }
  }

  updatePageSize(event: Event): void {
    this.options.update((current) => ({ ...current, pageSize: (event.target as HTMLSelectElement).value as PdfPageSize }));
  }

  updateOrientation(event: Event): void {
    this.options.update((current) => ({ ...current, orientation: (event.target as HTMLSelectElement).value as PdfOrientation }));
  }

  updateFit(event: Event): void {
    this.options.update((current) => ({ ...current, fit: (event.target as HTMLSelectElement).value as PdfImageFit }));
  }

  updateMargin(event: Event): void {
    this.options.update((current) => ({ ...current, margin: Number((event.target as HTMLInputElement).value) }));
  }

  updateQuality(event: Event): void {
    this.options.update((current) => ({ ...current, quality: Number((event.target as HTMLInputElement).value) }));
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

  trackByJob(_: number, job: PdfImageJob): string {
    return job.id;
  }

  @HostListener('dragenter', ['$event'])
  onPageDragEnter(event: DragEvent): void {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    this.dragDepth++;
    this.pageIsDragging.set(true);
  }

  @HostListener('dragleave')
  onPageDragLeave(): void {
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.pageIsDragging.set(false);
  }

  @HostListener('dragover', ['$event'])
  onPageDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  @HostListener('drop', ['$event'])
  onPageDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.pageIsDragging.set(false);
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length) void this.addFiles(files);
  }

  private getDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: Math.max(1, img.naturalWidth || img.width),
          height: Math.max(1, img.naturalHeight || img.height),
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image decode failed'));
      };
      img.src = url;
    });
  }

  private clickDownload(url: string, fileName: string): void {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  private revokeUrls(jobs: PdfImageJob[]): void {
    for (const job of jobs) {
      URL.revokeObjectURL(job.url);
    }
  }
}
