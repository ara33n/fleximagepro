import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { ToastService, Toast } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('toast', [
      transition(':enter', [
        style({ transform: 'translateX(calc(100% + 16px))', opacity: 0 }),
        animate('240ms cubic-bezier(0.4,0,0.2,1)', style({ transform: 'translateX(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('180ms cubic-bezier(0.4,0,0.2,1)', style({ transform: 'translateX(calc(100% + 16px))', opacity: 0 })),
      ]),
    ]),
  ],
})
export class ToastComponent {
  readonly toastService = inject(ToastService);

  trackById(_: number, t: Toast): string { return t.id; }

  containerClass(type: Toast['type']): string {
    const base = 'flex w-full items-start gap-3 rounded-xl border p-4 shadow-lg';
    const map: Record<Toast['type'], string> = {
      success: `${base} border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-100`,
      error:   `${base} border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100`,
      warning: `${base} border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100`,
      info:    `${base} border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100`,
    };
    return map[type];
  }

  iconClass(type: Toast['type']): string {
    const map: Record<Toast['type'], string> = {
      success: 'text-teal-500 dark:text-teal-400',
      error:   'text-red-500 dark:text-red-400',
      warning: 'text-amber-500 dark:text-amber-400',
      info:    'text-zinc-400 dark:text-zinc-500',
    };
    return map[type];
  }

  closeBtnClass(type: Toast['type']): string {
    const map: Record<Toast['type'], string> = {
      success: 'text-teal-400 hover:text-teal-600 dark:text-teal-500 dark:hover:text-teal-300',
      error:   'text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300',
      warning: 'text-amber-400 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-300',
      info:    'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300',
    };
    return map[type];
  }
}
