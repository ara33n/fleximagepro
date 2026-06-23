import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly darkMode = signal(false);
  private mediaQuery?: MediaQueryList;

  init(): void {
    const stored = localStorage.getItem('pixelpress-theme');
    this.mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    const prefersDark = this.mediaQuery?.matches ?? false;
    this.setDark(stored ? stored === 'dark' : prefersDark, Boolean(stored));

    if (!stored) {
      this.mediaQuery?.addEventListener('change', (event) => this.setDark(event.matches, false));
    }
  }

  toggle(): void {
    this.setDark(!this.darkMode());
  }

  private setDark(value: boolean, persist = true): void {
    this.darkMode.set(value);
    document.documentElement.classList.toggle('dark', value);
    document.documentElement.classList.add('theme-ready');
    if (persist) {
      localStorage.setItem('pixelpress-theme', value ? 'dark' : 'light');
    }
  }
}
