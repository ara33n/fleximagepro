import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  ViewChild,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { environment } from '../../../../environments/environment';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

@Component({
  selector: 'app-ad-slot',
  standalone: true,
  template: `
    @if (shouldRender()) {
      <div
        class="relative flex min-h-28 overflow-hidden rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        aria-label="{{ label() }} sponsored placement"
      >
        <ins
          #adElement
          class="adsbygoogle block min-h-24 w-full"
          style="display: block"
          [attr.data-ad-client]="clientId"
          [attr.data-ad-slot]="slotId()"
          data-ad-format="auto"
          data-full-width-responsive="true"
        ></ins>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdSlotComponent {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly slotConfig = environment.adsenseSlots;

  readonly label = input.required<string>();
  readonly adSlot = input<string>('');

  readonly clientId = environment.adsenseClientId;
  readonly slotId = computed(() => this.adSlot() || this.slotConfig[this.slotKey()] || '');
  readonly isConfigured = computed(() => Boolean(this.clientId && this.slotId()));
  readonly isHidden = signal(false);
  readonly shouldRender = computed(() => this.isConfigured() && !this.isHidden());

  @ViewChild('adElement') private readonly adElement?: ElementRef<HTMLElement>;

  constructor() {
    afterNextRender(() => {
      if (!this.isBrowser || !this.isConfigured()) {
        return;
      }

      this.loadAdsenseScript();
      this.requestAd();
      this.hideWhenAdIsUnavailable();
    });
  }

  private slotKey(): keyof typeof environment.adsenseSlots {
    return this.label().trim().toLowerCase().replace(/\s+/g, '-') as keyof typeof environment.adsenseSlots;
  }

  private loadAdsenseScript(): void {
    const existingScript = this.document.querySelector<HTMLScriptElement>(
      'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]',
    );

    if (existingScript) {
      existingScript.id ||= 'google-adsense-script';
      return;
    }

    const script = this.document.createElement('script');
    script.id = 'google-adsense-script';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.clientId}`;
    this.document.head.appendChild(script);
  }

  private requestAd(): void {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push({});
  }

  private hideWhenAdIsUnavailable(): void {
    const adElement = this.adElement?.nativeElement;

    if (!adElement) {
      return;
    }

    const syncVisibility = (): void => {
      const adStatus = adElement.getAttribute('data-ad-status');

      if (adStatus === 'unfilled') {
        this.isHidden.set(true);
      }
    };

    const observer = new MutationObserver(syncVisibility);
    observer.observe(adElement, { attributes: true, childList: true, subtree: true });

    window.setTimeout(() => {
      const hasAdFrame = Boolean(adElement.querySelector('iframe'));
      const adStatus = adElement.getAttribute('data-ad-status');

      if (!hasAdFrame && adStatus !== 'filled') {
        this.isHidden.set(true);
      }

      observer.disconnect();
    }, 6000);
  }
}
