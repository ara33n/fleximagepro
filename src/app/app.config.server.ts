import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RenderMode, ServerRoute, provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';

const serverRoutes: ServerRoute[] = [
  { path: '',                renderMode: RenderMode.Prerender },
  { path: 'compress',        renderMode: RenderMode.Prerender },
  { path: 'convert-webp',    renderMode: RenderMode.Prerender },
  { path: 'resize',          renderMode: RenderMode.Prerender },
  { path: 'jpg-to-png',      renderMode: RenderMode.Prerender },
  { path: 'privacy-policy',  renderMode: RenderMode.Prerender },
  { path: 'terms-of-service',renderMode: RenderMode.Prerender },
  { path: 'contact',         renderMode: RenderMode.Prerender },
  { path: '**',              renderMode: RenderMode.Client },
];

const serverConfig: ApplicationConfig = {
  providers: [
    provideNoopAnimations(),
    provideServerRendering(withRoutes(serverRoutes)),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
