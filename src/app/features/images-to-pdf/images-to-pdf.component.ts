import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { DomSanitizer } from '@angular/platform-browser';
import { imagesToPdfFaqs, imagesToPdfSeoContent } from '../../core/content/tool-seo-content';
import { ImageShareResponse, ImageShareService } from '../../core/services/image-share.service';
import { SeoService } from '../../core/services/seo.service';
import { PdfGeneratorService, PdfImageFit, PdfOrientation, PdfPageSize } from '../../core/services/pdf-generator.service';
import { ToastService } from '../../core/services/toast.service';
import { AdSlotComponent } from '../../shared/components/ad-slot/ad-slot.component';
import { QrCodeCardComponent } from '../../shared/components/qr-code-card/qr-code-card.component';
import { UploadZoneComponent } from '../../shared/components/upload-zone/upload-zone.component';
import { environment } from '../../../environments/environment';

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

const ACCEPTED_IMAGE_TYPES = ['image/*'];

@Component({
  selector: 'app-images-to-pdf',
  standalone: true,
  imports: [UploadZoneComponent, AdSlotComponent, QrCodeCardComponent],
  templateUrl: './images-to-pdf.component.html',
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
export class ImagesToPdfComponent {
  private readonly seo = inject(SeoService);
  private readonly pdf = inject(PdfGeneratorService);
  private readonly imageShare = inject(ImageShareService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private dragDepth = 0;

  readonly acceptedTypes = ACCEPTED_IMAGE_TYPES;
  readonly jobs = signal<PdfImageJob[]>([]);
  readonly isCreating = signal(false);
  readonly isGeneratingShareLink = signal(false);
  readonly pdfBlob = signal<Blob | null>(null);
  readonly pdfUrl = signal<string | null>(null);
  readonly pdfDirty = signal(true);
  readonly shareBatch = signal<ImageShareResponse | null>(null);
  readonly isShareModalOpen = signal(false);
  readonly isPreviewModalOpen = signal(false);
  readonly pageIsDragging = signal(false);
  readonly seoContent = imagesToPdfSeoContent;
  readonly faqs = imagesToPdfFaqs;
  readonly openFaq = signal<number | null>(0);
  readonly options = signal<PdfOptions>({
    pageSize: 'a4',
    orientation: 'auto',
    fit: 'contain',
    margin: 24,
    quality: 88,
  });

  readonly totalSize = computed(() => this.jobs().reduce((total, job) => total + job.size, 0));
  readonly pdfPreviewUrl = computed(() => {
    const url = this.pdfUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  constructor() {
    this.seo.update(
      'Images to PDF Converter - Convert JPG, PNG, WebP and More Online',
      'Convert multiple images to one PDF in your browser. Upload JPG, PNG, WebP, AVIF, SVG, GIF, BMP, ICO, HEIC and other browser-supported image files with private local processing.',
      'images to PDF, image to PDF converter, JPG to PDF, PNG to PDF, WebP to PDF, convert images to PDF online',
    );
    this.seo.updateFaqSchema(this.faqs);
    this.seo.updateBreadcrumbSchema([
      { name: 'Home', item: environment.siteUrl },
      { name: 'PDF Tools', item: environment.siteUrl },
      { name: 'Images to PDF', item: `${environment.siteUrl}/images-to-pdf` },
    ]);
    this.destroyRef.onDestroy(() => {
      this.revokeUrls(this.jobs());
      this.revokePdfUrl();
    });
  }

  toggleFaq(index: number): void {
    this.openFaq.update((current) => (current === index ? null : index));
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
      this.markPdfDirty();
    }
  }

  remove(jobId: string): void {
    const job = this.jobs().find((item) => item.id === jobId);
    if (job) {
      URL.revokeObjectURL(job.url);
    }
    this.jobs.update((items) => items.filter((item) => item.id !== jobId));
    this.markPdfDirty();
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
    this.markPdfDirty();
  }

  clearAll(): void {
    this.revokeUrls(this.jobs());
    this.jobs.set([]);
    this.markPdfDirty();
  }

  async createPreview(): Promise<void> {
    if (!this.jobs().length || this.isCreating()) {
      return;
    }

    this.isCreating.set(true);
    try {
      const blob = await this.buildPdfBlob();
      this.setPdfBlob(blob);
      this.isPreviewModalOpen.set(true);
      this.toast.success('PDF preview is ready.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'PDF preview failed.');
    } finally {
      this.isCreating.set(false);
    }
  }

  async downloadPdf(): Promise<void> {
    const jobs = this.jobs();
    if (!jobs.length || this.isCreating()) {
      return;
    }

    this.isCreating.set(true);
    try {
      const blob = this.pdfBlob() && !this.pdfDirty() ? this.pdfBlob() as Blob : await this.buildPdfBlob();
      if (blob !== this.pdfBlob()) {
        this.setPdfBlob(blob);
      }
      const url = URL.createObjectURL(blob);
      this.clickDownload(url, 'fleximagepro-images.pdf');
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'PDF creation failed.');
    } finally {
      this.isCreating.set(false);
    }
  }

  async generateShareLink(): Promise<void> {
    if (!this.jobs().length || this.isGeneratingShareLink()) {
      return;
    }

    this.isGeneratingShareLink.set(true);
    try {
      const blob = this.pdfBlob() && !this.pdfDirty() ? this.pdfBlob() as Blob : await this.buildPdfBlob();
      if (blob !== this.pdfBlob()) {
        this.setPdfBlob(blob);
      }
      const share = await this.imageShare.uploadBatch([{ blob, fileName: 'fleximagepro-images.pdf' }]);
      this.shareBatch.set(share);
      this.isShareModalOpen.set(true);
      this.toast.success('Share link is ready.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'PDF sharing failed.');
    } finally {
      this.isGeneratingShareLink.set(false);
    }
  }

  closeShareModal(): void {
    this.isShareModalOpen.set(false);
  }

  openPreviewModal(): void {
    if (this.pdfUrl()) {
      this.isPreviewModalOpen.set(true);
    }
  }

  closePreviewModal(): void {
    this.isPreviewModalOpen.set(false);
  }

  async copyShareUrl(): Promise<void> {
    const share = this.shareBatch();
    if (!share?.shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(share.shareUrl);
      this.toast.success('Share URL copied to clipboard.');
    } catch {
      this.toast.error('Copy failed. Select and copy the URL manually.');
    }
  }

  downloadQrCode(): void {
    const share = this.shareBatch();
    if (!share?.qrCodeDataUrl) {
      return;
    }
    this.clickDownload(share.qrCodeDataUrl, `fleximagepro-pdf-share-${share.id}-qr.png`);
  }

  updatePageSize(event: Event): void {
    this.options.update((current) => ({ ...current, pageSize: (event.target as HTMLSelectElement).value as PdfPageSize }));
    this.markPdfDirty();
  }

  updateOrientation(event: Event): void {
    this.options.update((current) => ({ ...current, orientation: (event.target as HTMLSelectElement).value as PdfOrientation }));
    this.markPdfDirty();
  }

  updateFit(event: Event): void {
    this.options.update((current) => ({ ...current, fit: (event.target as HTMLSelectElement).value as PdfImageFit }));
    this.markPdfDirty();
  }

  updateMargin(event: Event): void {
    this.options.update((current) => ({ ...current, margin: Number((event.target as HTMLInputElement).value) }));
    this.markPdfDirty();
  }

  updateQuality(event: Event): void {
    this.options.update((current) => ({ ...current, quality: Number((event.target as HTMLInputElement).value) }));
    this.markPdfDirty();
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

  private async buildPdfBlob(): Promise<Blob> {
    return this.pdf.create(
      this.jobs().map((job) => ({ file: job.file, name: job.name })),
      this.options(),
    );
  }

  private setPdfBlob(blob: Blob): void {
    this.revokePdfUrl();
    this.pdfBlob.set(blob);
    this.pdfUrl.set(URL.createObjectURL(blob));
    this.pdfDirty.set(false);
    this.shareBatch.set(null);
  }

  private revokePdfUrl(): void {
    const currentUrl = this.pdfUrl();
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    this.pdfUrl.set(null);
  }

  private markPdfDirty(): void {
    this.revokePdfUrl();
    this.pdfBlob.set(null);
    this.pdfDirty.set(true);
    this.shareBatch.set(null);
    this.isShareModalOpen.set(false);
    this.isPreviewModalOpen.set(false);
  }
}
