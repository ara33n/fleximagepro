import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { CropRect, ImageJob, OutputFormat, ToolConfig } from '../../core/models/image-job.model';
import { ImageProcessorService } from '../../core/services/image-processor.service';
import { ImageShareResponse, ImageShareService } from '../../core/services/image-share.service';
import { ImageSessionService } from '../../core/services/image-session.service';
import { PendingFilesService } from '../../core/services/pending-files.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { ZipService } from '../../core/services/zip.service';
import { AdSlotComponent } from '../../shared/components/ad-slot/ad-slot.component';
import { QrCodeCardComponent } from '../../shared/components/qr-code-card/qr-code-card.component';
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
  imports: [UploadZoneComponent, AdSlotComponent, QrCodeCardComponent],
  templateUrl: './tool-page.component.html',
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
export class ToolPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly processor = inject(ImageProcessorService);
  private readonly imageShare = inject(ImageShareService);
  private readonly sessions = inject(ImageSessionService);
  private readonly pendingFiles = inject(PendingFilesService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly zip = inject(ZipService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly doc = inject(DOCUMENT);
  private sessionId = this.route.snapshot.queryParamMap.get('session');

  constructor() {
    // Lock body scroll while the crop modal is open (works on iOS Safari too)
    effect(() => {
      const open = !!this.cropModal();
      const body = this.doc.body;
      if (open) {
        body.style.overflow = 'hidden';
        body.style.position = 'fixed';
        body.style.width = '100%';
      } else {
        body.style.overflow = '';
        body.style.position = '';
        body.style.width = '';
      }
    });
  }

  readonly tool = signal<ToolConfig>(this.route.snapshot.data['tool']);
  readonly jobs = signal<ImageJob[]>([]);
  readonly isProcessing = signal(false);
  readonly isZipping = signal(false);
  readonly isGeneratingShareLinks = signal(false);
  readonly optionsDirty = signal(false);
  readonly shareBatch = signal<ImageShareResponse | null>(null);
  readonly isShareModalOpen = signal(false);
  readonly pageIsDragging = signal(false);
  readonly openFaq = signal<number | null>(null);
  private _dragDepth = 0;

  // Crop modal state
  protected readonly Math = Math;
  readonly cropModal = signal<{ jobId: string; imageUrl: string; naturalW: number; naturalH: number } | null>(null);
  readonly cropSelDisplay = signal<{ x: number; y: number; w: number; h: number } | null>(null);
  readonly cropDisplaySize = signal({ w: 1, h: 1 });
  private cropSel = { x: 0, y: 0, w: 0, h: 0 };
  private cropDragMode: 'none' | 'new' | 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' = 'none';
  private cropDragStart = { dpx: 0, dpy: 0, sx: 0, sy: 0, sw: 0, sh: 0 };
  private cropImgEl: HTMLImageElement | null = null;
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
    this.seo.updateFaqSchema(this.tool().faqs);
    const pending = this.pendingFiles.take();
    if (pending.length) {
      void this.addFiles(pending);
    } else {
      void this.restoreSession();
    }
    this.destroyRef.onDestroy(() => this.revokeUrls(this.jobs()));
  }

  toggleFaq(index: number): void {
    this.openFaq.update((current) => (current === index ? null : index));
  }

  async addFiles(files: File[]): Promise<void> {
    const existing = this.jobs();
    const capacity = Math.max(0, 10 - existing.length);

    if (capacity === 0) {
      this.toast.warning('Maximum of 10 images reached. Clear some images first.');
      return;
    }

    if (files.length > capacity) {
      this.toast.warning(`Maximum 10 images allowed. Only the first ${capacity} image${capacity === 1 ? '' : 's'} will be added.`);
    }

    const selected = files.slice(0, capacity);

    if (!selected.length) {
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
        this.toast.error('One or more images could not be read by this browser.');
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
    this.isProcessing.set(true);
    for (const job of jobs) {
      await this.updateJob(job.id, { status: 'processing', error: undefined });
      try {
        if (job.resultUrl) {
          URL.revokeObjectURL(job.resultUrl);
        }
        const options = this.options();
        const isResize = this.tool().mode === 'resize';
        // Per-image height: when aspect lock is on, each image uses its own ratio from the target width.
        // This prevents distortion when images have different aspect ratios.
        let processHeight: number | undefined;
        if (isResize) {
          processHeight = options.lockAspect && job.width > 0 && job.height > 0
            ? Math.round(options.width / (job.width / job.height))
            : options.height;
        }
        const processed = this.tool().mode === 'png-to-svg'
          ? await this.processor.processToSvg(job.file, options.svgColors)
          : await this.processor.process(job.file, {
              mode: this.tool().mode,
              quality: options.quality,
              width: isResize ? options.width : undefined,
              height: processHeight,
              cropRect: job.cropRect,
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
      this.toast.error(errorMessage);
    } finally {
      this.isGeneratingShareLinks.set(false);
    }
  }

  closeShareModal(): void {
    this.isShareModalOpen.set(false);
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

  readonly imagesHaveDifferentRatios = computed(() => {
    const jobs = this.jobs();
    if (jobs.length < 2) return false;
    const baseRatio = jobs[0].width / jobs[0].height;
    return jobs.slice(1).some(j => Math.abs(j.width / j.height - baseRatio) > 0.02);
  });

  trackByJob(_: number, job: ImageJob): string {
    return job.id;
  }

  // ── Crop modal ─────────────────────────────────────────────────────────

  openCrop(job: ImageJob): void {
    this.cropImgEl = null;
    this.cropSelDisplay.set(null);
    this.cropDragMode = 'none';
    this.cropModal.set({ jobId: job.id, imageUrl: job.originalUrl, naturalW: job.width, naturalH: job.height });
  }

  onCropImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.cropImgEl = img;
    const { width: dw, height: dh } = img.getBoundingClientRect();
    const w = dw || img.naturalWidth || 1;
    const h = dh || img.naturalHeight || 1;
    this.cropDisplaySize.set({ w, h });
    const modal = this.cropModal();
    if (!modal) return;
    const job = this.jobs().find(j => j.id === modal.jobId);
    if (job?.cropRect) {
      const scaleX = w / modal.naturalW;
      const scaleY = h / modal.naturalH;
      const sel = { x: job.cropRect.x * scaleX, y: job.cropRect.y * scaleY, w: job.cropRect.width * scaleX, h: job.cropRect.height * scaleY };
      this.cropSel = sel;
      this.cropSelDisplay.set({ ...sel });
    } else {
      const sel = { x: 0, y: 0, w, h };
      this.cropSel = sel;
      this.cropSelDisplay.set({ ...sel });
    }
  }

  private getCropPointerRelative(event: PointerEvent): { x: number; y: number } {
    const img = this.cropImgEl;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    };
  }

  onCropImageDown(event: PointerEvent): void {
    event.preventDefault();
    const pos = this.getCropPointerRelative(event);
    this.cropDragMode = 'new';
    this.cropDragStart = { dpx: pos.x, dpy: pos.y, sx: pos.x, sy: pos.y, sw: 0, sh: 0 };
    this.cropSel = { x: pos.x, y: pos.y, w: 0, h: 0 };
    this.cropSelDisplay.set({ ...this.cropSel });
  }

  onCropSelDown(event: PointerEvent): void {
    event.stopPropagation();
    event.preventDefault();
    const pos = this.getCropPointerRelative(event);
    this.cropDragMode = 'move';
    this.cropDragStart = { dpx: pos.x, dpy: pos.y, sx: this.cropSel.x, sy: this.cropSel.y, sw: this.cropSel.w, sh: this.cropSel.h };
  }

  onCropHandleDown(event: PointerEvent, handle: string): void {
    event.stopPropagation();
    event.preventDefault();
    const pos = this.getCropPointerRelative(event);
    this.cropDragMode = handle as typeof this.cropDragMode;
    this.cropDragStart = { dpx: pos.x, dpy: pos.y, sx: this.cropSel.x, sy: this.cropSel.y, sw: this.cropSel.w, sh: this.cropSel.h };
  }

  onCropPointerMove(event: PointerEvent): void {
    if (this.cropDragMode === 'none' || !this.cropImgEl) return;
    event.preventDefault();
    const rect = this.cropImgEl.getBoundingClientRect();
    const px = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const py = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const { dpx, dpy, sx, sy, sw, sh } = this.cropDragStart;
    const W = rect.width, H = rect.height;
    let x = sx, y = sy, w = sw, h = sh;

    switch (this.cropDragMode) {
      case 'new':
        x = Math.min(dpx, px); y = Math.min(dpy, py);
        w = Math.abs(px - dpx); h = Math.abs(py - dpy);
        break;
      case 'move':
        x = Math.max(0, Math.min(W - sw, sx + px - dpx));
        y = Math.max(0, Math.min(H - sh, sy + py - dpy));
        break;
      case 'nw': { const nx = Math.max(0, Math.min(sx + sw - 1, px)), ny = Math.max(0, Math.min(sy + sh - 1, py)); x = nx; y = ny; w = sx + sw - nx; h = sy + sh - ny; break; }
      case 'ne': { const ny = Math.max(0, Math.min(sy + sh - 1, py)); y = ny; h = sy + sh - ny; w = Math.max(1, px - sx); break; }
      case 'sw': { const nx = Math.max(0, Math.min(sx + sw - 1, px)); x = nx; w = sx + sw - nx; h = Math.max(1, py - sy); break; }
      case 'se': w = Math.max(1, px - sx); h = Math.max(1, py - sy); break;
      case 'n': { const ny = Math.max(0, Math.min(sy + sh - 1, py)); y = ny; h = sy + sh - ny; break; }
      case 's': h = Math.max(1, py - sy); break;
      case 'w': { const nx = Math.max(0, Math.min(sx + sw - 1, px)); x = nx; w = sx + sw - nx; break; }
      case 'e': w = Math.max(1, px - sx); break;
    }

    this.cropSel = { x, y, w, h };
    this.cropSelDisplay.set({ x, y, w, h });
  }

  onCropPointerUp(): void {
    this.cropDragMode = 'none';
  }

  applyCrop(): void {
    const modal = this.cropModal();
    const sel = this.cropSelDisplay();
    if (!modal || !sel || !this.cropImgEl || sel.w < 2 || sel.h < 2) { this.cancelCrop(); return; }
    const { w: dw, h: dh } = this.cropDisplaySize();
    const scaleX = modal.naturalW / dw;
    const scaleY = modal.naturalH / dh;
    const cropRect: CropRect = {
      x: Math.round(sel.x * scaleX),
      y: Math.round(sel.y * scaleY),
      width: Math.max(1, Math.round(sel.w * scaleX)),
      height: Math.max(1, Math.round(sel.h * scaleY)),
    };
    void this.updateJob(modal.jobId, { cropRect, status: 'queued' });
    this.optionsDirty.set(true);
    this.cancelCrop();
  }

  removeCrop(jobId: string): void {
    void this.updateJob(jobId, { cropRect: undefined, status: 'queued' });
    this.optionsDirty.set(true);
  }

  cancelCrop(): void {
    this.cropModal.set(null);
    this.cropSelDisplay.set(null);
    this.cropImgEl = null;
    this.cropDragMode = 'none';
  }

  cropNaturalDims(): { w: number; h: number } | null {
    const sel = this.cropSelDisplay();
    const modal = this.cropModal();
    const size = this.cropDisplaySize();
    if (!sel || !modal || !size.w) return null;
    return {
      w: Math.max(1, Math.round(sel.w * modal.naturalW / size.w)),
      h: Math.max(1, Math.round(sel.h * modal.naturalH / size.h)),
    };
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
    const files = Array.from(event.dataTransfer?.files || []);
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
    if (tool.mode === 'compress') {
      return 'original';
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
      this.toast.info('Your previous images were restored from this browser.');

      if (this.tool().mode === 'resize') {
        const first = restored[0];
        this.options.update((current) => ({ ...current, width: first.width, height: first.height }));
      }

      const needsProcessing = restored.some(
        (job) => job.status === 'queued' || (job.status === 'done' && !job.resultBlob),
      );
      if (needsProcessing) {
        await this.processAll();
      } else {
        const sharedJob = restored.find(
          (j) => j.shareStatus === 'ready' && j.shareId && j.shareUrl && j.qrCodeDataUrl,
        );
        if (sharedJob?.shareId && sharedJob.shareUrl && sharedJob.qrCodeDataUrl) {
          this.shareBatch.set({
            id: sharedJob.shareId,
            shareUrl: sharedJob.shareUrl,
            qrCodeDataUrl: sharedJob.qrCodeDataUrl,
            expiresAt: sharedJob.shareExpiresAt ?? '',
            imageCount: restored.filter((j) => j.shareId === sharedJob.shareId).length,
          });
        }
      }
    } catch {
      this.toast.error('Saved images could not be restored in this browser.');
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
      this.toast.warning('Images are still available now, but this browser could not save them for refresh recovery.');
    }
  }
}
