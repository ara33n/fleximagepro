import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <p class="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">404</p>
      <h1 class="mt-4 text-4xl font-bold tracking-tight text-slate-950 dark:text-white">Page not found</h1>
      <p class="mt-4 text-slate-600 dark:text-slate-400">The image tool you are looking for does not exist or has moved.</p>
      <a routerLink="/" class="mt-8 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-300">Go home</a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.update('404 - FlexImagePro', 'The requested image tool page could not be found.');
  }
}
