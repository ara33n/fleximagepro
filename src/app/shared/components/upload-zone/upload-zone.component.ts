import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-upload-zone',
  standalone: true,
  templateUrl: './upload-zone.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadZoneComponent {
  readonly accept = input<string[]>([]);
  readonly compact = input(false);
  readonly filesSelected = output<File[]>();
  readonly isDragging = signal(false);

  readonly acceptValue = computed(() => this.accept().join(','));

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
    this.emitFiles(Array.from(event.dataTransfer?.files || []));
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.emitFiles(Array.from(input.files || []));
    input.value = '';
  }

  private emitFiles(files: File[]): void {
    const accepted = files.filter((file) => this.accept().includes(file.type)).slice(0, 10);
    if (accepted.length) {
      this.filesSelected.emit(accepted);
    }
  }
}
