import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-ad-slot',
  standalone: true,
  template: `
    <!-- <div
      class="group relative flex min-h-28 overflow-hidden rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="{{ label() }} sponsored placement"
    >
    
      <ins
        class="adsbygoogle flex min-h-24 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-500"
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot="0000000000"
        data-ad-format="auto"
        data-full-width-responsive="true"
      >
        {{ label() }} ad
      </ins>
    </div> -->
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdSlotComponent {
  readonly label = input.required<string>();
}
