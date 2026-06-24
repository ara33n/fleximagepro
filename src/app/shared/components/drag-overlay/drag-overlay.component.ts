import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { PendingFilesService } from '../../../core/services/pending-files.service';

interface ToolOption {
  label: string;
  badge: string;
  path: string;
  accept: string[];
}

const ALL_RASTER = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/x-icon', 'image/vnd.microsoft.icon'];

const TOOLS: ToolOption[] = [
  { label: 'Image Compressor', badge: 'Compress', path: '/compress', accept: ALL_RASTER },
  { label: 'Image to WebP', badge: 'Convert', path: '/convert-webp', accept: ALL_RASTER },
  { label: 'Image Resizer', badge: 'Resize', path: '/resize', accept: ALL_RASTER },
  { label: 'JPG ↔ PNG', badge: 'Format', path: '/jpg-to-png', accept: ['image/jpeg', 'image/png'] },
  { label: 'PNG to SVG', badge: 'Vector', path: '/png-to-svg', accept: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'] },
];

@Component({
  selector: 'app-drag-overlay',
  standalone: true,
  template: `
    @if (visible()) {
      <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm"
        (dragover)="onDragOver($event)"
        (dragleave)="onContainerLeave($event)"
        (drop)="onDrop($event)"
      >
        <p class="mb-6 text-lg font-semibold text-white">Drop images on a tool to get started</p>
        <div class="grid w-full max-w-3xl grid-cols-2 gap-3 px-6 sm:grid-cols-5">
          @for (tool of tools; track tool.path) {
            <button
              type="button"
              class="flex flex-col items-center gap-2 rounded-xl border-2 border-white/20 bg-zinc-900 p-4 text-center transition hover:border-teal-400 hover:bg-zinc-800"
              [class.border-teal-400]="hoveredTool() === tool.path"
              [class.bg-zinc-800]="hoveredTool() === tool.path"
              (dragover)="onToolDragOver($event, tool.path)"
              (dragleave)="onToolDragLeave()"
              (drop)="onToolDrop($event, tool)"
            >
              <span class="rounded-md bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white">{{ tool.badge }}</span>
              <span class="text-xs font-medium text-white">{{ tool.label }}</span>
            </button>
          }
        </div>
        <p class="mt-6 text-sm text-zinc-400">Release to drop, or press Esc to cancel</p>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DragOverlayComponent {
  private readonly router = inject(Router);
  private readonly pendingFiles = inject(PendingFilesService);

  readonly visible = signal(false);
  readonly hoveredTool = signal<string | null>(null);
  readonly tools = TOOLS;

  private readonly TOOL_PATHS = ['/compress', '/convert-webp', '/resize', '/jpg-to-png', '/png-to-svg'];

  // Counter handles nested dragenter/dragleave events reliably
  private dragDepth = 0;

  private isOnToolPage(): boolean {
    return this.TOOL_PATHS.some(p => this.router.url.startsWith(p));
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!this.hasImageFiles(event)) return;
    if (this.isOnToolPage()) return;
    this.dragDepth++;
    this.visible.set(true);
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (this.isOnToolPage()) return;
    if (!event.relatedTarget && event.target === document.documentElement) {
      this.dragDepth = 0;
      this.visible.set(false);
    } else {
      this.dragDepth = Math.max(0, this.dragDepth - 1);
      if (this.dragDepth === 0) {
        this.visible.set(false);
      }
    }
  }

  @HostListener('window:drop', ['$event'])
  onWindowDrop(event: DragEvent): void {
    if (this.isOnToolPage()) return;
    // Prevent browser from opening the file if dropped outside a tool card
    event.preventDefault();
    this.dragDepth = 0;
    this.visible.set(false);
    this.hoveredTool.set(null);
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.dragDepth = 0;
    this.visible.set(false);
    this.hoveredTool.set(null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onContainerLeave(event: DragEvent): void {
    // Only hide if leaving the overlay itself (not entering a child)
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) {
      this.dragDepth = 0;
      this.visible.set(false);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.visible.set(false);
    this.hoveredTool.set(null);
  }

  onToolDragOver(event: DragEvent, path: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.hoveredTool.set(path);
  }

  onToolDragLeave(): void {
    this.hoveredTool.set(null);
  }

  onToolDrop(event: DragEvent, tool: ToolOption): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth = 0;
    this.visible.set(false);
    this.hoveredTool.set(null);

    const files = Array.from(event.dataTransfer?.files || [])
      .filter(f => tool.accept.includes(f.type))
      .slice(0, 10);

    if (!files.length) return;

    this.pendingFiles.set(files);
    void this.router.navigate([tool.path]);
  }

  private hasImageFiles(event: DragEvent): boolean {
    if (!event.dataTransfer) return false;
    return Array.from(event.dataTransfer.types).includes('Files');
  }
}
