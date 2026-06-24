import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Disable pinch zoom & double tap zoom on iPhone
document.addEventListener(
  'touchmove',
  (event: any) => {
    if (event.scale !== 1) {
      event.preventDefault();
    }
  },
  { passive: false },
);

let lastTouchEnd = 0;

document.addEventListener(
  'touchend',
  (event) => {
    const now = Date.now();

    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }

    lastTouchEnd = now;
  },
  false,
);

document.addEventListener(
  'gesturestart',
  (event) => {
    event.preventDefault();
  },
  { passive: false },
);

document.addEventListener(
  'gesturechange',
  (event) => {
    event.preventDefault();
  },
  { passive: false },
);

document.addEventListener(
  'gestureend',
  (event) => {
    event.preventDefault();
  },
  { passive: false },
);

bootstrapApplication(App, {
  ...appConfig,
  providers: [
    ...(appConfig.providers ?? []),
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
  ],
}).catch((err) => console.error(err));
