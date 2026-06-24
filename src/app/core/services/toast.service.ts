import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

const DURATIONS: Record<ToastType, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 6000,
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(message: string): void { this.push(message, 'success'); }
  error(message: string): void   { this.push(message, 'error'); }
  warning(message: string): void { this.push(message, 'warning'); }
  info(message: string): void    { this.push(message, 'info'); }

  dismiss(id: string): void {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  private push(message: string, type: ToastType): void {
    const id = crypto.randomUUID();
    this._toasts.update(list => [...list, { id, message, type }]);
    setTimeout(() => this.dismiss(id), DURATIONS[type]);
  }
}
