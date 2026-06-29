import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RenderMode, ServerRoute, provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';

const imageToolServerRoutes: ServerRoute[] = [
  'rotate-image',
  'flip-image',
  'watermark-image',
  'webp-to-jpg',
  'webp-to-png',
  'jpg-to-avif',
  'avif-to-jpg',
  'heic-to-jpg',
  'gif-to-png',
  'convert-to-ico',
  'svg-to-png',
  'image-metadata-viewer',
  'image-dpi-checker',
  'change-image-dpi',
  'image-size-checker',
  'color-picker-from-image',
  'blur-image',
  'sharpen-image',
  'brightness-contrast',
  'grayscale-filter',
  'sepia-filter',
  'invert-colors',
  'image-to-base64',
  'base64-to-image',
].map((path) => ({ path, renderMode: RenderMode.Prerender }));

const textToolServerRoutes: ServerRoute[] = [
  'word-counter',
  'character-counter',
  'text-compare',
  'text-repeater',
  'random-text-generator',
  'remove-duplicate-lines',
  'remove-empty-lines',
  'remove-extra-spaces',
  'sort-lines',
  'reverse-text',
  'case-converter',
  'slug-generator',
].map((path) => ({ path, renderMode: RenderMode.Prerender }));

const seoToolServerRoutes: ServerRoute[] = [
  'meta-tag-generator',
  'robots-txt-generator',
  'sitemap-generator',
  'canonical-tag-generator',
  'open-graph-generator',
  'twitter-card-generator',
  'faq-schema-generator',
  'breadcrumb-schema-generator',
  'organization-schema-generator',
  'product-schema-generator',
  'article-schema-generator',
  'json-ld-generator',
  'hreflang-generator',
].map((path) => ({ path, renderMode: RenderMode.Prerender }));

const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'compress', renderMode: RenderMode.Prerender },
  { path: 'convert-webp', renderMode: RenderMode.Prerender },
  { path: 'resize', renderMode: RenderMode.Prerender },
  { path: 'jpg-to-png', renderMode: RenderMode.Prerender },
  { path: 'png-to-svg', renderMode: RenderMode.Prerender },
  { path: 'images-to-pdf', renderMode: RenderMode.Prerender },
  ...imageToolServerRoutes,
  ...textToolServerRoutes,
  ...seoToolServerRoutes,
  { path: 'privacy-policy', renderMode: RenderMode.Prerender },
  { path: 'terms-of-service', renderMode: RenderMode.Prerender },
  { path: 'contact', renderMode: RenderMode.Prerender },
  { path: 'share/:id', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Client },
];

const serverConfig: ApplicationConfig = {
  providers: [provideNoopAnimations(), provideServerRendering(withRoutes(serverRoutes))],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
