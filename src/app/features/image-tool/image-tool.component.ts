import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TOOL_CATEGORIES, ToolCatalogItem, findToolBySlug } from '../../core/content/tool-catalog';
import { findCategoryForTool, generateToolSeo } from '../../core/content/generated-tool-seo';
import { ImageShareResponse, ImageShareService } from '../../core/services/image-share.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { ZipService } from '../../core/services/zip.service';
import { QrCodeCardComponent } from '../../shared/components/qr-code-card/qr-code-card.component';
import { ToolSeoBlockComponent } from '../../shared/components/tool-seo-block/tool-seo-block.component';
import { UploadZoneComponent } from '../../shared/components/upload-zone/upload-zone.component';

type ImageToolKind =
  | 'rotate' | 'flip' | 'watermark'
  | 'webp-jpg' | 'webp-png' | 'jpg-avif' | 'avif-jpg' | 'heic-jpg' | 'gif-png' | 'ico' | 'svg-png'
  | 'metadata' | 'dpi' | 'size' | 'color-picker'
  | 'change-dpi'
  | 'blur' | 'sharpen' | 'brightness-contrast' | 'grayscale' | 'sepia' | 'invert'
  | 'image-base64' | 'base64-image';

interface ResultFile {
  url: string;
  blob: Blob;
  name: string;
  width?: number;
  height?: number;
}

interface MetadataRow {
  label: string;
  value: string;
}

interface ImageToolJob {
  id: string;
  file: File;
  name: string;
  type: string;
  originalUrl: string;
  originalSize: number;
  width: number;
  height: number;
  status: 'queued' | 'processing' | 'done' | 'error';
  resultUrl?: string;
  resultBlob?: Blob;
  resultName?: string;
  resultSize?: number;
  resultWidth?: number;
  resultHeight?: number;
  rows?: MetadataRow[];
  base64Text?: string;
  error?: string;
}

const SLUG_KIND: Record<string, ImageToolKind> = {
  'rotate-image': 'rotate',
  'flip-image': 'flip',
  'watermark-image': 'watermark',
  'webp-to-jpg': 'webp-jpg',
  'webp-to-png': 'webp-png',
  'jpg-to-avif': 'jpg-avif',
  'avif-to-jpg': 'avif-jpg',
  'heic-to-jpg': 'heic-jpg',
  'gif-to-png': 'gif-png',
  'convert-to-ico': 'ico',
  'svg-to-png': 'svg-png',
  'image-metadata-viewer': 'metadata',
  'image-dpi-checker': 'dpi',
  'change-image-dpi': 'change-dpi',
  'image-size-checker': 'size',
  'color-picker-from-image': 'color-picker',
  'blur-image': 'blur',
  'sharpen-image': 'sharpen',
  'brightness-contrast': 'brightness-contrast',
  'grayscale-filter': 'grayscale',
  'sepia-filter': 'sepia',
  'invert-colors': 'invert',
  'image-to-base64': 'image-base64',
  'base64-to-image': 'base64-image',
};

@Component({
  selector: 'app-image-tool',
  standalone: true,
  imports: [UploadZoneComponent, QrCodeCardComponent, ToolSeoBlockComponent, RouterLink],
  templateUrl: './image-tool.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageToolComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly zip = inject(ZipService);
  private readonly imageShare = inject(ImageShareService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('pickerCanvas') pickerCanvas?: ElementRef<HTMLCanvasElement>;

  readonly slug = this.route.snapshot.data['slug'] as string;
  readonly kind = SLUG_KIND[this.slug];
  readonly category = findCategoryForTool(this.slug) ?? TOOL_CATEGORIES[0];
  readonly catalogItem = signal<ToolCatalogItem>(
    findToolBySlug(this.slug) ?? {
      label: 'Image Tool',
      slug: this.slug,
      route: `/${this.slug}`,
      description: 'Free image tool.',
    },
  );

  readonly file = signal<File | null>(null);
  readonly originalUrl = signal<string | null>(null);
  readonly result = signal<ResultFile | null>(null);
  readonly jobs = signal<ImageToolJob[]>([]);
  readonly rows = signal<MetadataRow[]>([]);
  readonly base64Text = signal('');
  readonly base64Input = signal('');
  readonly pickedColor = signal<{ hex: string; rgb: string } | null>(null);
  readonly isProcessing = signal(false);
  readonly isZipping = signal(false);
  readonly isGeneratingShareLinks = signal(false);
  readonly shareBatch = signal<ImageShareResponse | null>(null);
  readonly isShareModalOpen = signal(false);
  readonly error = signal<string | null>(null);

  readonly angle = signal(90);
  readonly flipHorizontal = signal(true);
  readonly flipVertical = signal(false);
  readonly watermarkText = signal('FlexImagePro');
  readonly watermarkSize = signal(32);
  readonly watermarkOpacity = signal(70);
  readonly blur = signal(6);
  readonly sharpen = signal(45);
  readonly brightness = signal(105);
  readonly contrast = signal(105);
  readonly quality = signal(86);
  readonly dpiValue = signal(300);

  readonly accepts = computed(() => {
    switch (this.kind) {
      case 'webp-jpg':
      case 'webp-png':
        return ['image/webp'];
      case 'avif-jpg':
        return ['image/avif'];
      case 'heic-jpg':
        return ['image/*'];
      case 'gif-png':
        return ['image/gif'];
      case 'svg-png':
        return ['image/svg+xml'];
      case 'jpg-avif':
        return ['image/jpeg'];
      case 'change-dpi':
        return ['image/png', 'image/jpeg'];
      case 'ico':
        return ['image/png', 'image/jpeg', 'image/webp'];
      default:
        return ['image/*'];
    }
  });

  readonly isInspector = computed(() => ['metadata', 'dpi', 'size', 'color-picker', 'image-base64'].includes(this.kind));
  readonly isSingleImageTool = computed(() => ['metadata', 'dpi', 'size', 'color-picker', 'image-base64', 'change-dpi'].includes(this.kind));
  readonly allowBatch = computed(() => !this.isSingleImageTool());
  readonly needsUpload = computed(() => this.kind !== 'base64-image');
  readonly hasOptions = computed(() => !this.isInspector() && this.kind !== 'base64-image');
  readonly isShareableTool = computed(() => !this.isInspector() && this.kind !== 'base64-image');
  readonly canGenerateShareLink = computed(() => this.isShareableTool() && !['ico', 'jpg-avif'].includes(this.kind));
  readonly completedJobs = computed(() => this.jobs().filter((job) => job.status === 'done' && job.resultBlob));
  readonly progress = computed(() => {
    const jobs = this.jobs();
    if (!jobs.length) return 0;
    return Math.round((jobs.filter((job) => job.status === 'done' || job.status === 'error').length / jobs.length) * 100);
  });
  readonly hasOutput = computed(() => Boolean(this.jobs().length || this.result() || this.base64Text()));
  readonly totalOriginalSize = computed(() => this.jobs().reduce((total, job) => total + job.originalSize, 0));
  readonly totalResultSize = computed(() => this.completedJobs().reduce((total, job) => total + (job.resultSize || 0), 0));
  readonly savedPercent = computed(() => this.savings(this.totalOriginalSize(), this.totalResultSize()));
  readonly shareLinksReady = computed(() => Boolean(this.shareBatch() && this.completedJobs().length));
  readonly completeText = computed(() => {
    if (this.isProcessing()) return 'Processing...';
    if (this.error()) return 'Needs attention';
    if (this.jobs().length) return `${this.completedJobs().length} of ${this.jobs().length} complete`;
    if (this.result() || this.base64Text()) return '1 of 1 complete';
    return 'Waiting for image';
  });

  ngOnInit(): void {
    const item = this.catalogItem();
    const seoContent = generateToolSeo(item, this.category);
    this.seo.update(seoContent.title, seoContent.metaDescription);
    this.seo.updateFaqSchema(seoContent.faqs);
    this.seo.updateBreadcrumbSchema(seoContent.breadcrumb);
    this.destroyRef.onDestroy(() => this.revokeJobUrls(this.jobs()));
  }

  async addFiles(files: File[]): Promise<void> {
    if (!this.allowBatch() && this.jobs().length) {
      this.clearAll();
    }
    const limit = this.allowBatch() ? 10 : 1;
    const capacity = Math.max(0, limit - this.jobs().length);
    if (capacity === 0) {
      this.toast.warning(this.allowBatch() ? 'Maximum of 10 images reached. Clear some images first.' : 'This tool works with one image at a time.');
      return;
    }
    if (files.length > capacity) {
      this.toast.warning(this.allowBatch()
        ? `Maximum 10 images allowed. Only the first ${capacity} image${capacity === 1 ? '' : 's'} will be added.`
        : 'This tool needs one image only. The first image was selected.');
    }
    const selected = files.slice(0, capacity);
    if (!selected.length) return;

    const nextJobs: ImageToolJob[] = [];
    for (const selectedFile of selected) {
      try {
        const dimensions = await this.getDimensions(selectedFile);
        nextJobs.push({
          id: crypto.randomUUID(),
          file: selectedFile,
          name: selectedFile.name,
          type: selectedFile.type,
          originalUrl: URL.createObjectURL(selectedFile),
          originalSize: selectedFile.size,
          width: dimensions.width,
          height: dimensions.height,
          status: 'queued',
        });
      } catch {
        this.toast.error('One or more images could not be read by this browser.');
      }
    }
    if (!nextJobs.length) return;

    this.jobs.set([...this.jobs(), ...nextJobs]);
    const first = this.jobs()[0];
    this.file.set(first.file);
    this.originalUrl.set(first.originalUrl);
    await this.processAll();
  }

  async process(): Promise<void> {
    if (this.kind !== 'base64-image') {
      await this.processAll();
      return;
    }
    const file = this.file();
    if (!file && this.needsUpload()) return;
    this.error.set(null);
    this.isProcessing.set(true);
    this.clearResult(false);

    try {
      await this.decodeBase64();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'This image could not be processed.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  async processAll(): Promise<void> {
    const jobs = this.jobs();
    if (!jobs.length) return;
    this.error.set(null);
    this.shareBatch.set(null);
    this.isShareModalOpen.set(false);
    this.isProcessing.set(true);
    for (const job of jobs) {
      this.updateJob(job.id, { status: 'processing', error: undefined });
      try {
        if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
        const updated = await this.processJob(job);
        this.updateJob(job.id, updated);
      } catch (error) {
        this.updateJob(job.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Processing failed.',
        });
      }
    }
    this.syncFirstJobSignals();
    this.isProcessing.set(false);
  }

  download(): void {
    const result = this.result();
    if (!result) return;
    const anchor = document.createElement('a');
    anchor.href = result.url;
    anchor.download = result.name;
    anchor.click();
  }

  downloadJob(job: ImageToolJob): void {
    if (!job.resultUrl || !job.resultName) return;
    this.clickDownload(job.resultUrl, job.resultName);
  }

  async downloadAll(): Promise<void> {
    const completed = this.completedJobs();
    if (!completed.length || this.isZipping()) return;
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
      this.clickDownload(url, `${this.slug}-images.zip`);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      this.isZipping.set(false);
    }
  }

  async generateShareLinks(): Promise<void> {
    const completed = this.completedJobs();
    if (!completed.length || this.isGeneratingShareLinks()) return;
    this.shareBatch.set(null);
    this.isGeneratingShareLinks.set(true);
    try {
      const share = await this.imageShare.uploadBatch(completed.map((job) => ({
        blob: job.resultBlob as Blob,
        fileName: job.resultName || job.name,
      })));
      this.shareBatch.set(share);
      this.isShareModalOpen.set(true);
      this.toast.success('Share link is ready.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Image sharing failed.');
    } finally {
      this.isGeneratingShareLinks.set(false);
    }
  }

  closeShareModal(): void {
    this.isShareModalOpen.set(false);
  }

  openShareModal(): void {
    if (this.shareBatch()) this.isShareModalOpen.set(true);
  }

  async copyShareUrl(): Promise<void> {
    const share = this.shareBatch();
    if (!share?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(share.shareUrl);
      this.toast.success('Share URL copied to clipboard.');
    } catch {
      this.toast.error('Copy failed. Select and copy the URL manually.');
    }
  }

  downloadQrCode(): void {
    const share = this.shareBatch();
    if (!share?.qrCodeDataUrl) return;
    this.clickDownload(share.qrCodeDataUrl, `fleximagepro-share-${share.id}-qr.png`);
  }

  clearAll(): void {
    this.revokeJobUrls(this.jobs());
    this.jobs.set([]);
    this.shareBatch.set(null);
    this.isShareModalOpen.set(false);
    this.clearResult(true);
    this.base64Input.set('');
  }

  copyBase64(): void {
    const text = this.base64Text();
    if (!text) return;
    void navigator.clipboard.writeText(text).then(
      () => this.toast.success('Base64 copied.'),
      () => this.toast.error('Copy failed. Select and copy the text manually.'),
    );
  }

  async onBase64Input(event: Event): Promise<void> {
    this.base64Input.set((event.target as HTMLTextAreaElement).value);
  }

  pickColor(event: MouseEvent): void {
    const canvas = this.pickerCanvas?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((event.clientY - rect.top) * (canvas.height / rect.height));
    const data = canvas.getContext('2d')?.getImageData(x, y, 1, 1).data;
    if (!data) return;
    const [r, g, b] = data;
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    this.pickedColor.set({ hex, rgb: `rgb(${r}, ${g}, ${b})` });
  }

  updateNumber(signalRef: { set(value: number): void }, event: Event): void {
    signalRef.set(Number((event.target as HTMLInputElement).value));
  }

  rangeFill(value: number, min: number, max: number): string {
    const percent = ((value - min) / (max - min)) * 100;
    return `${Math.max(0, Math.min(100, percent))}%`;
  }

  trackByJob(_: number, job: ImageToolJob): string {
    return job.id;
  }

  private async processJob(job: ImageToolJob): Promise<Partial<ImageToolJob>> {
    switch (this.kind) {
      case 'metadata': {
        const rows = await this.metadataRows(job.file);
        return { status: 'done', rows };
      }
      case 'dpi': {
        const rows = await this.dpiRows(job.file);
        return { status: 'done', rows };
      }
      case 'size': {
        const rows = await this.sizeRows(job.file);
        return { status: 'done', rows };
      }
      case 'image-base64': {
        const base64Text = await this.readAsDataUrl(job.file);
        const rows = await this.metadataRows(job.file);
        return { status: 'done', rows, base64Text };
      }
      case 'color-picker': {
        const rows = await this.metadataRows(job.file);
        return { status: 'done', rows };
      }
      case 'change-dpi':
        return await this.changeDpi(job.file);
      default:
        return await this.transform(job.file);
    }
  }

  private async transform(file: File): Promise<Partial<ImageToolJob>> {
    const image = await this.loadImage(file);
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = image.width;
    sourceCanvas.height = image.height;
    const source = this.context(sourceCanvas);
    source.drawImage(image.element, 0, 0, image.width, image.height);

    let canvas = sourceCanvas;
    switch (this.kind) {
      case 'rotate':
        canvas = this.rotateCanvas(sourceCanvas, this.angle());
        break;
      case 'flip':
        canvas = this.flipCanvas(sourceCanvas, this.flipHorizontal(), this.flipVertical());
        break;
      case 'watermark':
        canvas = this.watermarkCanvas(sourceCanvas);
        break;
      case 'blur':
        canvas = this.filterCanvas(sourceCanvas, `blur(${this.blur()}px)`);
        break;
      case 'brightness-contrast':
        canvas = this.filterCanvas(sourceCanvas, `brightness(${this.brightness()}%) contrast(${this.contrast()}%)`);
        break;
      case 'grayscale':
        canvas = this.filterCanvas(sourceCanvas, 'grayscale(100%)');
        break;
      case 'sepia':
        canvas = this.filterCanvas(sourceCanvas, 'sepia(100%)');
        break;
      case 'invert':
        canvas = this.filterCanvas(sourceCanvas, 'invert(100%)');
        break;
      case 'sharpen':
        canvas = this.sharpenCanvas(sourceCanvas, this.sharpen());
        break;
    }

    const output = this.outputForKind(file);
    const blob = output.mime === 'image/x-icon'
      ? await this.canvasToIco(canvas)
      : await this.canvasToBlob(canvas, output.mime, this.quality() / 100);

    if (output.mime === 'image/avif' && blob.type !== 'image/avif') {
      throw new Error('AVIF export is not supported by this browser. Try the WebP converter instead.');
    }

    return {
      status: 'done',
      resultBlob: blob,
      resultUrl: URL.createObjectURL(blob),
      resultName: this.rename(file.name, output.extension),
      resultSize: blob.size,
      resultWidth: canvas.width,
      resultHeight: canvas.height,
    };
  }

  private async inspectMetadata(file: File): Promise<void> {
    this.rows.set(await this.metadataRows(file));
  }

  private async metadataRows(file: File): Promise<MetadataRow[]> {
    const dimensions = await this.getDimensions(file);
    return [
      { label: 'File name', value: file.name },
      { label: 'File type', value: file.type || 'Unknown' },
      { label: 'File size', value: this.formatBytes(file.size) },
      { label: 'Width', value: `${dimensions.width} px` },
      { label: 'Height', value: `${dimensions.height} px` },
      { label: 'Last modified', value: new Date(file.lastModified).toLocaleString() },
    ];
  }

  private async inspectSize(file: File): Promise<void> {
    this.rows.set(await this.sizeRows(file));
  }

  private async sizeRows(file: File): Promise<MetadataRow[]> {
    const dimensions = await this.getDimensions(file);
    return [
      { label: 'Pixel size', value: `${dimensions.width} x ${dimensions.height} px` },
      { label: 'Total pixels', value: `${(dimensions.width * dimensions.height).toLocaleString()} px` },
      { label: 'File size', value: this.formatBytes(file.size) },
      { label: 'Aspect ratio', value: this.aspectRatio(dimensions.width, dimensions.height) },
    ];
  }

  private async inspectDpi(file: File): Promise<void> {
    this.rows.set(await this.dpiRows(file));
  }

  private async dpiRows(file: File): Promise<MetadataRow[]> {
    const buffer = await file.arrayBuffer();
    const dimensions = await this.getDimensions(file);
    const dpi = this.readDpi(new Uint8Array(buffer), file.type, dimensions);
    return [
      { label: 'Detected DPI', value: dpi ? `${dpi.x} x ${dpi.y} DPI` : 'No embedded DPI found' },
      { label: 'Print size', value: dpi ? `${(dpi.width / dpi.x).toFixed(2)} x ${(dpi.height / dpi.y).toFixed(2)} in` : 'Unavailable without embedded DPI' },
      { label: 'Pixel size', value: `${dimensions.width} x ${dimensions.height} px` },
      { label: 'Note', value: 'DPI is metadata. Pixel dimensions are the real image detail.' },
    ];
  }

  private async changeDpi(file: File): Promise<Partial<ImageToolJob>> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dpi = Math.max(1, Math.min(2400, Math.round(this.dpiValue())));
    let blob: Blob;
    let extension: string;
    if (file.type === 'image/png') {
      blob = new Blob([this.toBlobPart(this.patchPngDpi(bytes, dpi))], { type: 'image/png' });
      extension = 'png';
    } else if (file.type === 'image/jpeg') {
      blob = new Blob([this.toBlobPart(this.patchJpegDpi(bytes, dpi))], { type: 'image/jpeg' });
      extension = 'jpg';
    } else {
      throw new Error('Change DPI supports PNG and JPG images.');
    }
    const dimensions = await this.getDimensions(file);
    return {
      status: 'done',
      resultBlob: blob,
      resultUrl: URL.createObjectURL(blob),
      resultName: this.rename(file.name, `${dpi}dpi.${extension}`),
      resultSize: blob.size,
      resultWidth: dimensions.width,
      resultHeight: dimensions.height,
      rows: [
        { label: 'New DPI', value: `${dpi} x ${dpi} DPI` },
        { label: 'Pixel size', value: `${dimensions.width} x ${dimensions.height} px` },
        { label: 'Print size', value: `${(dimensions.width / dpi).toFixed(2)} x ${(dimensions.height / dpi).toFixed(2)} in` },
      ],
    };
  }

  private async encodeBase64(file: File): Promise<void> {
    this.base64Text.set(await this.readAsDataUrl(file));
    await this.inspectMetadata(file);
  }

  private async decodeBase64(): Promise<void> {
    const input = this.base64Input().trim();
    if (!input) throw new Error('Paste a Base64 image string first.');
    const dataUrl = input.startsWith('data:') ? input : `data:image/png;base64,${input}`;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('The Base64 text is not an image.');
    this.result.set({
      blob,
      url: URL.createObjectURL(blob),
      name: `base64-image.${blob.type.split('/')[1] || 'png'}`,
    });
  }

  private async prepareColorPicker(file: File): Promise<void> {
    const image = await this.loadImage(file);
    window.setTimeout(() => {
      const canvas = this.pickerCanvas?.nativeElement;
      if (!canvas) return;
      const maxWidth = 900;
      const scale = Math.min(1, maxWidth / image.width);
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      this.context(canvas).drawImage(image.element, 0, 0, canvas.width, canvas.height);
    }, 0);
    await this.inspectMetadata(file);
  }

  private rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
    const radians = degrees * Math.PI / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(canvas.width * cos + canvas.height * sin));
    out.height = Math.max(1, Math.round(canvas.width * sin + canvas.height * cos));
    const ctx = this.context(out);
    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate(radians);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return out;
  }

  private flipCanvas(canvas: HTMLCanvasElement, horizontal: boolean, vertical: boolean): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = this.context(out);
    ctx.translate(horizontal ? out.width : 0, vertical ? out.height : 0);
    ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
    ctx.drawImage(canvas, 0, 0);
    return out;
  }

  private watermarkCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = this.context(out);
    ctx.drawImage(canvas, 0, 0);
    ctx.globalAlpha = this.watermarkOpacity() / 100;
    ctx.font = `700 ${this.watermarkSize()}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = Math.max(2, this.watermarkSize() / 12);
    const text = this.watermarkText() || 'FlexImagePro';
    const metrics = ctx.measureText(text);
    const x = Math.max(24, out.width - metrics.width - 32);
    const y = Math.max(this.watermarkSize() + 12, out.height - 32);
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
    return out;
  }

  private filterCanvas(canvas: HTMLCanvasElement, filterValue: string): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = this.context(out);
    ctx.filter = filterValue;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    return out;
  }

  private sharpenCanvas(canvas: HTMLCanvasElement, amount: number): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = this.context(out);
    ctx.drawImage(canvas, 0, 0);
    const image = ctx.getImageData(0, 0, out.width, out.height);
    const data = image.data;
    const copy = new Uint8ClampedArray(data);
    const strength = amount / 100;
    const kernel = [0, -strength, 0, -strength, 1 + 4 * strength, -strength, 0, -strength, 0];
    for (let y = 1; y < out.height - 1; y++) {
      for (let x = 1; x < out.width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * out.width + (x + kx)) * 4 + c;
              sum += copy[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          data[(y * out.width + x) * 4 + c] = Math.max(0, Math.min(255, sum));
        }
      }
    }
    ctx.putImageData(image, 0, 0);
    return out;
  }

  private outputForKind(file: File): { mime: string; extension: string } {
    switch (this.kind) {
      case 'webp-jpg':
      case 'avif-jpg':
      case 'heic-jpg':
        return { mime: 'image/jpeg', extension: 'jpg' };
      case 'webp-png':
      case 'gif-png':
      case 'svg-png':
        return { mime: 'image/png', extension: 'png' };
      case 'jpg-avif':
        return { mime: 'image/avif', extension: 'avif' };
      case 'ico':
        return { mime: 'image/x-icon', extension: 'ico' };
      default:
        if (file.type === 'image/png') return { mime: 'image/png', extension: 'png' };
        if (file.type === 'image/webp') return { mime: 'image/webp', extension: 'webp' };
        return { mime: 'image/jpeg', extension: 'jpg' };
    }
  }

  private async canvasToIco(canvas: HTMLCanvasElement): Promise<Blob> {
    const png = await this.canvasToBlob(canvas, 'image/png');
    const pngBytes = new Uint8Array(await png.arrayBuffer());
    const header = new Uint8Array(22);
    const view = new DataView(header.buffer);
    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, 1, true);
    header[6] = canvas.width >= 256 ? 0 : canvas.width;
    header[7] = canvas.height >= 256 ? 0 : canvas.height;
    header[8] = 0;
    header[9] = 0;
    view.setUint16(10, 1, true);
    view.setUint16(12, 32, true);
    view.setUint32(14, pngBytes.length, true);
    view.setUint32(18, header.length, true);
    return new Blob([header, pngBytes], { type: 'image/x-icon' });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality = 0.86): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(`${mime} export is not supported by this browser.`)), mime, quality);
    });
  }

  private async loadImage(file: File): Promise<{ element: HTMLImageElement; width: number; height: number }> {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('This browser could not read that image format.'));
    });
    img.src = url;
    await loaded;
    URL.revokeObjectURL(url);
    return { element: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
  }

  private async getDimensions(file: File): Promise<{ width: number; height: number }> {
    const image = await this.loadImage(file);
    return { width: image.width, height: image.height };
  }

  private context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas is not supported in this browser.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return ctx;
  }

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.readAsDataURL(file);
    });
  }

  private readDpi(
    bytes: Uint8Array,
    type: string,
    dimensions: { width: number; height: number },
  ): { x: number; y: number; width: number; height: number } | null {
    if (type === 'image/png') {
      for (let i = 8; i < bytes.length - 24; i++) {
        if (String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]) === 'pHYs') {
          const xppm = (bytes[i + 8] << 24) | (bytes[i + 9] << 16) | (bytes[i + 10] << 8) | bytes[i + 11];
          const yppm = (bytes[i + 12] << 24) | (bytes[i + 13] << 16) | (bytes[i + 14] << 8) | bytes[i + 15];
          const unit = bytes[i + 16];
          if (unit === 1) return { x: Math.round(xppm * 0.0254), y: Math.round(yppm * 0.0254), ...dimensions };
        }
      }
    }
    if (type === 'image/jpeg') {
      for (let i = 2; i < bytes.length - 4;) {
        if (bytes[i] !== 0xff) break;
        const marker = bytes[i + 1];
        if (marker === 0xda || marker === 0xd9) break;
        const length = (bytes[i + 2] << 8) | bytes[i + 3];
        if (length < 2 || i + 2 + length > bytes.length) break;
        if (marker === 0xe0 && String.fromCharCode(...bytes.slice(i + 4, i + 9)) === 'JFIF\0') {
          const unit = bytes[i + 11];
          let x = (bytes[i + 12] << 8) | bytes[i + 13];
          let y = (bytes[i + 14] << 8) | bytes[i + 15];
          if (unit === 2) {
            x = Math.round(x * 2.54);
            y = Math.round(y * 2.54);
          }
          if (unit) return { x, y, ...dimensions };
        }
        if (marker === 0xe1 && String.fromCharCode(...bytes.slice(i + 4, i + 10)) === 'Exif\0\0') {
          const exif = this.readExifDpi(bytes, i + 10, length - 8);
          if (exif) return { ...exif, ...dimensions };
        }
        i += 2 + length;
      }
    }
    return null;
  }

  private readExifDpi(bytes: Uint8Array, start: number, length: number): { x: number; y: number } | null {
    if (start + length > bytes.length || length < 14) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset + start, length);
    const littleEndian = view.getUint16(0, false) === 0x4949;
    if (!littleEndian && view.getUint16(0, false) !== 0x4d4d) return null;
    if (view.getUint16(2, littleEndian) !== 42) return null;
    const ifdOffset = view.getUint32(4, littleEndian);
    if (ifdOffset + 2 > length) return null;
    const entryCount = view.getUint16(ifdOffset, littleEndian);
    let x: number | null = null;
    let y: number | null = null;
    let unit = 2;
    for (let index = 0; index < entryCount; index++) {
      const offset = ifdOffset + 2 + index * 12;
      if (offset + 12 > length) break;
      const tag = view.getUint16(offset, littleEndian);
      if (tag === 0x011a) x = this.readExifRational(view, offset + 8, littleEndian);
      if (tag === 0x011b) y = this.readExifRational(view, offset + 8, littleEndian);
      if (tag === 0x0128) unit = view.getUint16(offset + 8, littleEndian);
    }
    if (!x || !y) return null;
    if (unit === 3) return { x: Math.round(x * 2.54), y: Math.round(y * 2.54) };
    return { x: Math.round(x), y: Math.round(y) };
  }

  private readExifRational(view: DataView, valueOffset: number, littleEndian: boolean): number | null {
    const pointer = view.getUint32(valueOffset, littleEndian);
    if (pointer + 8 > view.byteLength) return null;
    const numerator = view.getUint32(pointer, littleEndian);
    const denominator = view.getUint32(pointer + 4, littleEndian);
    return denominator ? numerator / denominator : null;
  }

  private patchPngDpi(bytes: Uint8Array, dpi: number): Uint8Array {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!signature.every((value, index) => bytes[index] === value)) throw new Error('This is not a valid PNG file.');
    const ppm = Math.round(dpi / 0.0254);
    const chunk = this.createPngPhysChunk(ppm);
    for (let offset = 8; offset < bytes.length;) {
      const length = this.readUint32(bytes, offset);
      const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
      const end = offset + 12 + length;
      if (type === 'pHYs') return this.concatBytes(bytes.slice(0, offset), chunk, bytes.slice(end));
      if (type === 'IHDR') return this.concatBytes(bytes.slice(0, end), chunk, bytes.slice(end));
      offset = end;
    }
    throw new Error('PNG header could not be updated.');
  }

  private createPngPhysChunk(ppm: number): Uint8Array {
    const chunk = new Uint8Array(21);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, 9, false);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4);
    view.setUint32(8, ppm, false);
    view.setUint32(12, ppm, false);
    chunk[16] = 1;
    view.setUint32(17, this.crc32(chunk.slice(4, 17)), false);
    return chunk;
  }

  private patchJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('This is not a valid JPG file.');
    const density = Math.max(1, Math.min(65535, dpi));
    for (let i = 2; i < bytes.length - 16;) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      const length = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker === 0xe0 && String.fromCharCode(...bytes.slice(i + 4, i + 9)) === 'JFIF\0') {
        const out = new Uint8Array(bytes);
        out[i + 11] = 1;
        out[i + 12] = density >> 8;
        out[i + 13] = density & 255;
        out[i + 14] = density >> 8;
        out[i + 15] = density & 255;
        return out;
      }
      if (length < 2) break;
      i += 2 + length;
    }
    const jfif = new Uint8Array([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, density >> 8, density & 255, density >> 8, density & 255, 0x00, 0x00]);
    return this.concatBytes(bytes.slice(0, 2), jfif, bytes.slice(2));
  }

  private readUint32(bytes: Uint8Array, offset: number): number {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  }

  private concatBytes(...parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  private toBlobPart(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  private crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private aspectRatio(width: number, height: number): string {
    const divisor = this.gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  private gcd(a: number, b: number): number {
    return b === 0 ? a : this.gcd(b, a % b);
  }

  private rename(name: string, extension: string): string {
    return `${name.replace(/\.[^.]+$/, '')}-${this.slug.replace(/^image-/, '')}.${extension}`;
  }

  private updateJob(id: string, partial: Partial<ImageToolJob>): void {
    this.jobs.update((jobs) => jobs.map((job) => (job.id === id ? { ...job, ...partial } : job)));
  }

  private syncFirstJobSignals(): void {
    const first = this.jobs()[0];
    if (!first) {
      this.file.set(null);
      this.originalUrl.set(null);
      this.result.set(null);
      this.rows.set([]);
      this.base64Text.set('');
      return;
    }
    this.file.set(first.file);
    this.originalUrl.set(first.originalUrl);
    this.rows.set(first.rows ?? []);
    this.base64Text.set(first.base64Text ?? '');
    if (first.resultBlob && first.resultUrl && first.resultName) {
      this.result.set({
        blob: first.resultBlob,
        url: first.resultUrl,
        name: first.resultName,
        width: first.resultWidth,
        height: first.resultHeight,
      });
    } else {
      this.result.set(null);
    }
    if (this.kind === 'color-picker') {
      void this.prepareColorPicker(first.file);
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
    if (current === 0) return name;
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex < 1) return `${name}-${current + 1}`;
    return `${name.slice(0, dotIndex)}-${current + 1}${name.slice(dotIndex)}`;
  }

  private revokeJobUrls(jobs: ImageToolJob[]): void {
    for (const job of jobs) {
      URL.revokeObjectURL(job.originalUrl);
      if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
    }
  }

  private clearResult(clearFile = true): void {
    const result = this.result();
    if (result) URL.revokeObjectURL(result.url);
    this.result.set(null);
    this.rows.set([]);
    this.base64Text.set('');
    this.pickedColor.set(null);
    this.error.set(null);
    if (clearFile) {
      const url = this.originalUrl();
      if (url) URL.revokeObjectURL(url);
      this.originalUrl.set(null);
      this.file.set(null);
    }
  }

  formatBytes(bytes = 0): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index++;
    }
    return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
  }

  savings(original = 0, result = 0): number {
    if (!original || !result) return 0;
    return Math.max(0, Math.round(((original - result) / original) * 100));
  }
}
