import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

type InstallOutcome = 'accepted' | 'dismissed';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
  prompt(): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly promptEvent = signal<BeforeInstallPromptEvent | null>(null);
  private readonly manualInstall = signal(false);
  private readonly hidden = signal(false);

  readonly canPrompt = computed(() => this.promptEvent() !== null);
  readonly needsManualInstall = computed(() => this.manualInstall() && !this.canPrompt());
  readonly visible = computed(
    () => !this.hidden() && (this.canPrompt() || this.needsManualInstall()) && !this.isInstalled(),
  );

  constructor() {
    if (!isPlatformBrowser(this.platformId) || this.isInstalled()) {
      return;
    }

    const win = this.document.defaultView;

    if (!win || win.sessionStorage.getItem('fleximagepro-install-dismissed') === 'true') {
      this.hidden.set(true);
      return;
    }

    win.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.promptEvent.set(event as BeforeInstallPromptEvent);
      this.manualInstall.set(false);
      this.hidden.set(false);
    });

    win.addEventListener('appinstalled', () => {
      win.localStorage.setItem('fleximagepro-installed', 'true');
      this.promptEvent.set(null);
      this.manualInstall.set(false);
      this.hidden.set(true);
    });

    if (this.isIosSafari(win)) {
      win.setTimeout(() => {
        if (!this.isInstalled() && !this.promptEvent()) {
          this.manualInstall.set(true);
        }
      }, 1800);
    }
  }

  async install(): Promise<void> {
    const event = this.promptEvent();

    if (!event) {
      this.dismiss();
      return;
    }

    await event.prompt();
    const choice = await event.userChoice;

    if (choice.outcome === 'accepted') {
      this.document.defaultView?.localStorage.setItem('fleximagepro-installed', 'true');
    }

    this.promptEvent.set(null);
    this.hidden.set(true);
  }

  dismiss(): void {
    const win = this.document.defaultView;

    win?.sessionStorage.setItem('fleximagepro-install-dismissed', 'true');
    this.hidden.set(true);
  }

  private isInstalled(): boolean {
    const win = this.document.defaultView;

    if (!win) {
      return false;
    }

    const navigatorWithStandalone = win.navigator as Navigator & { standalone?: boolean };

    return (
      win.localStorage.getItem('fleximagepro-installed') === 'true' ||
      win.matchMedia('(display-mode: standalone)').matches ||
      navigatorWithStandalone.standalone === true
    );
  }

  private isIosSafari(win: Window): boolean {
    const navigatorWithStandalone = win.navigator as Navigator & { standalone?: boolean };
    const userAgent = win.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent) || navigatorWithStandalone.standalone !== undefined;
    const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios/.test(userAgent);

    return isIos && isSafari;
  }
}
