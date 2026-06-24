import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PendingFilesService {
  private _files: File[] = [];

  set(files: File[]): void {
    this._files = files;
  }

  take(): File[] {
    const files = this._files;
    this._files = [];
    return files;
  }

  has(): boolean {
    return this._files.length > 0;
  }
}
