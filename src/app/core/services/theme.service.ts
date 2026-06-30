import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly darkMode = signal(false);
  private mediaQuery?: MediaQueryList;
  private animationTimer: number | null = null;

  init(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const stored = localStorage.getItem('pixelpress-theme');
    this.mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    const prefersDark = this.mediaQuery?.matches ?? false;
    this.setDark(stored ? stored === 'dark' : prefersDark, Boolean(stored), false);

    if (!stored) {
      this.mediaQuery?.addEventListener('change', (event) => this.setDark(event.matches, false, true));
    }
  }

  toggle(): void {
    this.setDark(!this.darkMode(), true, true);
  }

  private setDark(value: boolean, persist = true, animate = false): void {
    const root = document.documentElement;
    if (animate) {
      root.classList.add('theme-animating');
      if (this.animationTimer) {
        window.clearTimeout(this.animationTimer);
      }
      this.animationTimer = window.setTimeout(() => {
        root.classList.remove('theme-animating');
        this.animationTimer = null;
      }, 360);
    }
    root.classList.toggle('dark', value);
    root.style.colorScheme = value ? 'dark' : 'light';
    root.classList.add('theme-ready');
    this.updateThemeColor(value);
    this.darkMode.set(value);

    if (persist) {
      localStorage.setItem('pixelpress-theme', value ? 'dark' : 'light');
    }
  }

  private updateThemeColor(dark: boolean): void {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
      meta.content = dark ? '#09090b' : '#ffffff';
    }
  }
}
