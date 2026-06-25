import { ChangeDetectionStrategy, Component, NgZone, computed, inject, input, output, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

const MIME_LABELS: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/x-icon': 'ICO',
  'image/vnd.microsoft.icon': 'ICO',
  'image/svg+xml': 'SVG',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
  svg: 'image/svg+xml', gif: 'image/gif', bmp: 'image/bmp',
  heic: 'image/heic', heif: 'image/heif',
};

// iOS Safari canvas pixel budget — stay under this to avoid silent toBlob failures
const MAX_CANVAS_PIXELS = 16_000_000;

@Component({
  selector: 'app-upload-zone',
  standalone: true,
  templateUrl: './upload-zone.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadZoneComponent {
  private readonly toast = inject(ToastService);
  private readonly zone = inject(NgZone);

  readonly accept = input<string[]>([]);
  readonly compact = input(false);
  readonly filesSelected = output<File[]>();
  readonly isDragging = signal(false);

  // image/* lets iOS show the full Photos library without OS-level format restrictions.
  // All filtering and HEIC→PNG conversion is done in JavaScript.
  readonly acceptValue = computed(() => 'image/*');

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    this.dispatch(Array.from(event.dataTransfer?.files || []));
  }

  onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const files = Array.from(el.files || []);
    el.value = '';
    this.dispatch(files);
  }

  /**
   * Synchronously emit files that are already in an accepted format (identical
   * behaviour to the original code — no async overhead, no zone issues on iOS).
   * Files that need conversion (HEIC, or iOS-delivered JPEG for PNG-only tools)
   * are handed off to convertAndEmit separately.
   */
  private dispatch(files: File[]): void {
    if (!files.length) return;

    const ready: File[] = [];
    const toConvert: File[] = [];
    let rejected = 0;

    for (const file of files) {
      const mime = this.resolveMime(file);

      if (!mime) { rejected++; continue; }

      // HEIC/HEIF always needs async canvas conversion
      if (HEIC_TYPES.has(mime)) { toConvert.push(file); continue; }

      // Directly accepted — add without any async work
      if (this.accept().includes(mime)) { ready.push(file); continue; }

      // iOS sometimes delivers HEIC photos as JPEG for PNG-only tools (e.g. PNG→SVG).
      // Route to async conversion so those users can still upload camera photos.
      if (mime === 'image/jpeg' && this.accept().includes('image/png')) {
        toConvert.push(file);
        continue;
      }

      rejected++;
    }

    // ── Synchronous emit — same as original for normal accepted files ──
    if (ready.length) {
      this.filesSelected.emit(ready);
    }

    // Show rejection warning only when nothing is pending conversion
    if (rejected > 0 && !toConvert.length) {
      this.toast.warning(this.buildRejectedMsg(rejected));
    }

    // Async path for HEIC / format-conversion files
    if (toConvert.length) {
      void this.convertAndEmit(toConvert, rejected);
    }
  }

  private async convertAndEmit(files: File[], alreadyRejected: number): Promise<void> {
    const converted: File[] = [];
    let failed = false;
    let rejected = alreadyRejected;

    for (const file of files) {
      const mime = this.resolveMime(file);
      try {
        const png = await this.toPng(file, mime);
        if (this.accept().includes('image/png')) {
          converted.push(png);
        } else {
          rejected++;
        }
      } catch {
        failed = true;
      }
    }

    // Re-enter Angular zone after the async work so OnPush change detection fires
    this.zone.run(() => {
      if (failed) {
        this.toast.error('One or more photos could not be processed. Try a different image.');
      } else if (rejected > 0) {
        this.toast.warning(this.buildRejectedMsg(rejected));
      }
      if (converted.length) {
        this.filesSelected.emit(converted);
      }
    });
  }

  private toPng(file: File, fromMime: string): Promise<File> {
    return new Promise<File>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        // Scale large photos down to avoid iOS Safari canvas memory limits
        if (w * h > MAX_CANVAS_PIXELS) {
          const scale = Math.sqrt(MAX_CANVAS_PIXELS / (w * h));
          w = Math.floor(w * scale);
          h = Math.floor(h * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) {
              const baseName = fromMime === 'image/jpeg'
                ? file.name.replace(/\.(jpe?g)$/i, '.png')
                : file.name.replace(/\.(heic|heif)$/i, '.png');
              const name = baseName.endsWith('.png') ? baseName : `${file.name}.png`;
              resolve(new File([blob], name, { type: 'image/png' }));
            } else {
              reject(new Error('Canvas toBlob returned null'));
            }
          },
          'image/png',
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to decode ${fromMime}`));
      };

      img.src = url;
    });
  }

  /** Return MIME type, falling back to extension inference for iOS files with empty type. */
  private resolveMime(file: File): string {
    if (file.type) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return EXT_TO_MIME[ext] ?? '';
  }

  private acceptLabel(): string {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of this.accept()) {
      const label = MIME_LABELS[t] ?? t;
      if (!seen.has(label)) { seen.add(label); out.push(label); }
    }
    return out.join(', ');
  }

  private buildRejectedMsg(count: number): string {
    return `${count} file${count === 1 ? '' : 's'} skipped — only ${this.acceptLabel()} images are supported here.`;
  }
}
