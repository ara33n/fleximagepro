import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ImageJob, OutputFormat, ToolConfig } from '../../core/models/image-job.model';
import { ImageProcessorService } from '../../core/services/image-processor.service';
import { ImageShareResponse, ImageShareService } from '../../core/services/image-share.service';
import { ImageSessionService } from '../../core/services/image-session.service';
import { PendingFilesService } from '../../core/services/pending-files.service';
import { SeoService } from '../../core/services/seo.service';
import { ZipService } from '../../core/services/zip.service';
import { AdSlotComponent } from '../../shared/components/ad-slot/ad-slot.component';
import { UploadZoneComponent } from '../../shared/components/upload-zone/upload-zone.component';

interface ToolOptions {
  quality: number;
  width: number;
  height: number;
  lockAspect: boolean;
  outputFormat: OutputFormat;
  svgColors: number;
}

@Component({
  selector: 'app-tool-page',
  standalone: true,
  imports: [UploadZoneComponent, AdSlotComponent],
  templateUrl: './tool-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly processor = inject(ImageProcessorService);
  private readonly imageShare = inject(ImageShareService);
  private readonly sessions = inject(ImageSessionService);
  private readonly pendingFiles = inject(PendingFilesService);
  private readonly seo = inject(SeoService);
  private readonly zip = inject(ZipService);
  private readonly destroyRef = inject(DestroyRef);
  private sessionId = this.route.snapshot.queryParamMap.get('session');

  readonly tool = signal<ToolConfig>(this.route.snapshot.data['tool']);
  readonly jobs = signal<ImageJob[]>([]);
  readonly isProcessing = signal(false);
  readonly isZipping = signal(false);
  readonly isGeneratingShareLinks = signal(false);
  readonly optionsDirty = signal(false);
  readonly message = signal('');
  readonly copyMessage = signal('');
  readonly shareBatch = signal<ImageShareResponse | null>(null);
  readonly isShareModalOpen = signal(false);
  readonly pageIsDragging = signal(false);
  private _dragDepth = 0;
  readonly options = signal<ToolOptions>({
    quality: 78,
    width: 1200,
    height: 800,
    lockAspect: true,
    outputFormat: this.tool().defaultOutput,
    svgColors: 100,
  });

  readonly completedJobs = computed(() => this.jobs().filter((job) => job.status === 'done' && job.resultBlob));
  readonly progress = computed(() => {
    const jobs = this.jobs();
    if (!jobs.length) {
      return 0;
    }
    return Math.round((jobs.filter((job) => job.status === 'done' || job.status === 'error').length / jobs.length) * 100);
  });
  readonly totalOriginalSize = computed(() => this.jobs().reduce((total, job) => total + job.originalSize, 0));
  readonly totalResultSize = computed(() => this.completedJobs().reduce((total, job) => total + (job.resultSize || 0), 0));
  readonly totalSavings = computed(() => this.savings(this.totalOriginalSize(), this.totalResultSize()));
  readonly shareLinksReady = computed(() => {
    const share = this.shareBatch();
    return Boolean(share && this.completedJobs().length > 0);
  });

  ngOnInit(): void {
    this.seo.update(this.tool().titleTag, this.tool().metaDescription, this.tool().keywords);
    const pending = this.pendingFiles.take();
    if (pending.length) {
      void this.addFiles(pending);
    } else {
      void this.restoreSession();
    }
    this.destroyRef.onDestroy(() => this.revokeUrls(this.jobs()));
  }

  async addFiles(files: File[]): Promise<void> {
    this.message.set('');
    const existing = this.jobs();
    const capacity = Math.max(0, 10 - existing.length);
    const selected = files.slice(0, capacity);

    if (!selected.length) {
      this.message.set('You can process up to 10 images at a time.');
      return;
    }

    const nextJobs: ImageJob[] = [];
    for (const file of selected) {
      try {
        const dimensions = await this.processor.getDimensions(file);
        nextJobs.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          type: file.type,
          originalUrl: URL.createObjectURL(file),
          originalSize: file.size,
          width: dimensions.width,
          height: dimensions.height,
          status: 'queued',
        });
      } catch {
        this.message.set('One or more images could not be read by this browser.');
      }
    }

    if (!nextJobs.length) {
      return;
    }

    await this.ensureSessionUrl();
    this.jobs.set([...existing, ...nextJobs]);
    await this.persistCurrentSession();
    if (this.tool().mode === 'resize' && existing.length === 0) {
      const first = nextJobs[0];
      this.options.update((current) => ({ ...current, width: first.width, height: first.height }));
    }
    await this.processAll();
  }

  async processAll(): Promise<void> {
    const jobs = this.jobs();
    if (!jobs.length) {
      return;
    }

    this.shareBatch.set(null);
    this.isShareModalOpen.set(false);
    this.copyMessage.set('');
    this.isProcessing.set(true);
    for (const job of jobs) {
      await this.updateJob(job.id, { status: 'processing', error: undefined });
      try {
        if (job.resultUrl) {
          URL.revokeObjectURL(job.resultUrl);
        }
        const options = this.options();
        const processed = this.tool().mode === 'png-to-svg'
          ? await this.processor.processToSvg(job.file, options.svgColors)
          : await this.processor.process(job.file, {
              mode: this.tool().mode,
              quality: options.quality,
              width: this.tool().mode === 'resize' ? options.width : undefined,
              height: this.tool().mode === 'resize' ? options.height : undefined,
              outputFormat: this.outputFormatForTool(),
            });

        await this.updateJob(job.id, {
          status: 'done',
          resultUrl: processed.url,
          resultBlob: processed.blob,
          resultName: processed.fileName,
          resultSize: processed.blob.size,
          resultWidth: processed.width,
          resultHeight: processed.height,
          shareStatus: 'idle',
          shareId: undefined,
          shareUrl: undefined,
          qrCodeDataUrl: undefined,
          shareExpiresAt: undefined,
          shareError: undefined,
        });
      } catch (error) {
        await this.updateJob(job.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Processing failed.',
        });
      }
    }
    this.optionsDirty.set(false);
    this.isProcessing.set(false);
  }

  clearAll(): void {
    const sessionId = this.sessionId;
    this.revokeUrls(this.jobs());
    this.jobs.set([]);
    this.message.set('');
    this.copyMessage.set('');
    this.shareBatch.set(null);
    this.isShareModalOpen.set(false);
    this.sessionId = null;
    if (sessionId) {
      void this.sessions.remove(sessionId);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { session: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  download(job: ImageJob): void {
    if (!job.resultUrl || !job.resultName) {
      return;
    }
    this.clickDownload(job.resultUrl, job.resultName);
  }

  async downloadAll(): Promise<void> {
    const completed = this.completedJobs();
    if (!completed.length || this.isZipping()) {
      return;
    }

    this.isZipping.set(true);
    try {
      const names = new Map<string, number>();
      const archive = await this.zip.create(
        completed.map((job) => ({
          name: this.uniqueName(job.resultName || job.name, names),
          blob: job.resultBlob as Blob,
        })),
      );
      const url = URL.createObjectURL(archive);
      this.clickDownload(url, `${this.tool().id}-images.zip`);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      this.isZipping.set(false);
    }
  }

  async generateShareLinks(): Promise<void> {
    const completed = this.completedJobs();
    if (!completed.length || this.isGeneratingShareLinks()) {
      return;
    }

    this.message.set('');
    this.copyMessage.set('');
    this.shareBatch.set(null);
    this.isGeneratingShareLinks.set(true);
    const jobsToShare = completed.filter((job) => job.resultBlob && job.resultName);

    try {
      await Promise.all(jobsToShare.map((job) => this.updateJob(job.id, {
        shareStatus: 'uploading',
        shareError: undefined,
      })));

      const share = await this.imageShare.uploadBatch(jobsToShare.map((job) => ({
        blob: job.resultBlob as Blob,
        fileName: job.resultName as string,
      })));

      this.shareBatch.set(share);
      this.isShareModalOpen.set(true);
      await Promise.all(jobsToShare.map((job) => (
        this.updateJob(job.id, {
          shareStatus: 'ready',
          shareId: share.id,
          shareUrl: share.shareUrl,
          qrCodeDataUrl: share.qrCodeDataUrl,
          shareExpiresAt: share.expiresAt,
          shareError: undefined,
        })
      )));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Image sharing failed.';
      await Promise.all(jobsToShare.map((job) => this.updateJob(job.id, {
        shareStatus: 'error',
        shareError: errorMessage,
      })));
      this.message.set(errorMessage);
    } finally {
      this.isGeneratingShareLinks.set(false);
    }
  }

  closeShareModal(): void {
    this.isShareModalOpen.set(false);
    this.copyMessage.set('');
  }

  openShareModal(): void {
    if (this.shareBatch()) {
      this.isShareModalOpen.set(true);
    }
  }

  async copyShareUrl(): Promise<void> {
    const share = this.shareBatch();
    if (!share?.shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(share.shareUrl);
      this.copyMessage.set('Share URL copied.');
    } catch {
      this.copyMessage.set('Copy failed. Select and copy the URL manually.');
    }
  }

  downloadQrCode(): void {
    const share = this.shareBatch();
    if (!share?.qrCodeDataUrl) {
      return;
    }

    this.clickDownload(share.qrCodeDataUrl, `fleximagepro-share-${share.id}-qr.png`);
  }

  updateQuality(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.options.update((current) => ({ ...current, quality: value }));
    this.optionsDirty.set(true);
  }

  updateOutputFormat(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as OutputFormat;
    this.options.update((current) => ({ ...current, outputFormat: value }));
    this.optionsDirty.set(true);
  }

  updateWidth(event: Event): void {
    const width = Number((event.target as HTMLInputElement).value);
    this.options.update((current) => {
      const next: ToolOptions = { ...current, width };
      if (current.lockAspect && this.jobs()[0]) {
        next.height = Math.round(width / (this.jobs()[0].width / this.jobs()[0].height));
      }
      return next;
    });
    this.optionsDirty.set(true);
  }

  updateHeight(event: Event): void {
    const height = Number((event.target as HTMLInputElement).value);
    this.options.update((current) => {
      const next: ToolOptions = { ...current, height };
      if (current.lockAspect && this.jobs()[0]) {
        next.width = Math.round(height * (this.jobs()[0].width / this.jobs()[0].height));
      }
      return next;
    });
    this.optionsDirty.set(true);
  }

  toggleAspectLock(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.options.update((current) => ({ ...current, lockAspect: checked }));
    this.optionsDirty.set(true);
  }

  updateSvgColors(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.options.update((current) => ({ ...current, svgColors: value }));
    this.optionsDirty.set(true);
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

  savings(original = 0, result = 0): number {
    if (!original || !result) {
      return 0;
    }
    return Math.round(((original - result) / original) * 100);
  }

  trackByJob(_: number, job: ImageJob): string {
    return job.id;
  }

  @HostListener('dragenter', ['$event'])
  onPageDragEnter(event: DragEvent): void {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    this._dragDepth++;
    this.pageIsDragging.set(true);
  }

  @HostListener('dragleave', ['$event'])
  onPageDragLeave(_event: DragEvent): void {
    this._dragDepth = Math.max(0, this._dragDepth - 1);
    if (this._dragDepth === 0) this.pageIsDragging.set(false);
  }

  @HostListener('dragover', ['$event'])
  onPageDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  @HostListener('drop', ['$event'])
  onPageDrop(event: DragEvent): void {
    event.preventDefault();
    this._dragDepth = 0;
    this.pageIsDragging.set(false);
    const files = Array.from(event.dataTransfer?.files || [])
      .filter(f => this.tool().acceptedTypes.includes(f.type))
      .slice(0, 10);
    if (files.length) void this.addFiles(files);
  }

  private outputFormatForTool(): OutputFormat {
    const tool = this.tool();
    if (tool.mode === 'convert-webp') {
      return 'webp';
    }
    if (tool.mode === 'png-to-svg') {
      return 'svg';
    }
    if (tool.mode === 'jpg-png') {
      return this.options().outputFormat === 'auto' ? 'auto' : this.options().outputFormat;
    }
    return this.options().outputFormat;
  }

  private async updateJob(id: string, partial: Partial<ImageJob>): Promise<void> {
    this.jobs.update((jobs) => jobs.map((job) => (job.id === id ? { ...job, ...partial } : job)));
    await this.persistCurrentSession();
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

  private revokeUrls(jobs: ImageJob[]): void {
    for (const job of jobs) {
      URL.revokeObjectURL(job.originalUrl);
      if (job.resultUrl) {
        URL.revokeObjectURL(job.resultUrl);
      }
    }
  }

  private async restoreSession(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    try {
      const restored = await this.sessions.restore(this.sessionId, this.tool());
      if (!restored.length) {
        return;
      }

      this.jobs.set(restored);
      this.message.set('Your previous images were restored from this browser.');

      if (this.tool().mode === 'resize') {
        const first = restored[0];
        this.options.update((current) => ({ ...current, width: first.width, height: first.height }));
      }

      if (restored.some((job) => job.status === 'queued' || (job.status === 'done' && !job.resultBlob))) {
        await this.processAll();
      }
    } catch {
      this.message.set('Saved images could not be restored in this browser.');
    }
  }

  private async ensureSessionUrl(): Promise<void> {
    if (this.sessionId) {
      return;
    }

    this.sessionId = this.sessions.createSessionId();
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { session: this.sessionId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async persistCurrentSession(): Promise<void> {
    if (!this.sessionId || !this.jobs().length) {
      return;
    }

    try {
      await this.sessions.save(this.sessionId, this.tool(), this.jobs());
    } catch {
      this.message.set('Images are still available now, but this browser could not save them for refresh recovery.');
    }
  }
}
