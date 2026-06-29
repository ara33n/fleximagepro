import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { FooterComponent } from './shared/components/footer/footer.component';
import { HeaderComponent } from './shared/components/header/header.component';
import { InstallPromptComponent } from './shared/components/install-prompt/install-prompt.component';
import { PageLoaderComponent } from './shared/components/page-loader/page-loader.component';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    ToastComponent,
    InstallPromptComponent,
    PageLoaderComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, OnDestroy {
  private readonly theme = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);

  private removeZoomListeners: Array<() => void> = [];

  constructor() {
    this.theme.init();
  }

  ngOnInit(): void {
    this.disableZoom();
  }

  ngOnDestroy(): void {
    this.removeZoomListeners.forEach((remove) => remove());
  }

  private disableZoom(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const addListener = (
      target: EventTarget,
      eventName: string,
      handler: EventListener,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(eventName, handler, options);

      this.removeZoomListeners.push(() => {
        target.removeEventListener(eventName, handler, options);
      });
    };

    // Ctrl + mouse wheel zoom block
    addListener(
      document,
      'wheel',
      (event: Event) => {
        const wheelEvent = event as WheelEvent;

        if (wheelEvent.ctrlKey) {
          wheelEvent.preventDefault();
        }
      },
      { passive: false },
    );

    // Ctrl/Cmd + +, -, 0 zoom shortcuts block
    addListener(document, 'keydown', (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;

      if (
        (keyboardEvent.ctrlKey || keyboardEvent.metaKey) &&
        ['+', '-', '=', '0'].includes(keyboardEvent.key)
      ) {
        keyboardEvent.preventDefault();
      }
    });

    // Safari / iPhone pinch zoom block
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((eventName) => {
      addListener(
        document,
        eventName,
        (event: Event) => {
          event.preventDefault();
        },
        { passive: false },
      );
    });
  }
}
