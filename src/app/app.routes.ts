import { Routes } from '@angular/router';
import { ToolConfig } from './core/models/image-job.model';

const compressTool: ToolConfig = {
  id: 'compress',
  title: 'Image Compressor',
  eyebrow: 'JPG, PNG, WebP',
  description: 'Reduce image file sizes locally with Canvas-based compression controls.',
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  mode: 'compress',
  defaultOutput: 'original',
  titleTag: 'Image Compressor - Compress JPG, PNG and WebP Online',
  metaDescription: 'Compress JPG, PNG, and WebP images online in your browser. Private image compressor with no uploads, instant previews, and bulk ZIP downloads.',
  keywords: 'image compressor, compress image online, compress JPG, compress PNG, reduce image size, WebP compressor, private image compression',
};

const webpTool: ToolConfig = {
  id: 'convert-webp',
  title: 'Image to WebP Converter',
  eyebrow: 'Fast WebP export',
  description: 'Convert JPG and PNG files to lightweight WebP images without uploading them.',
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  mode: 'convert-webp',
  defaultOutput: 'webp',
  titleTag: 'Image to WebP Converter - Private Browser Tool',
  metaDescription: 'Convert JPG, PNG, and WebP images to WebP in the browser using Canvas and File APIs. Bulk WebP converter with private local processing.',
  keywords: 'image to WebP, WebP converter, JPG to WebP, PNG to WebP, convert image online, browser image converter',
};

const resizeTool: ToolConfig = {
  id: 'resize',
  title: 'Image Resizer',
  eyebrow: 'Custom dimensions',
  description: 'Resize images by width and height with aspect ratio lock and instant previews.',
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  mode: 'resize',
  defaultOutput: 'original',
  titleTag: 'Image Resizer - Resize Images Online Privately',
  metaDescription: 'Resize JPG, PNG, and WebP images online with custom dimensions, aspect ratio lock, instant previews, and private browser-side processing.',
  keywords: 'image resizer, resize image online, resize JPG, resize PNG, change image dimensions, bulk image resize',
};

const jpgPngTool: ToolConfig = {
  id: 'jpg-to-png',
  title: 'JPG to PNG and PNG to JPG Converter',
  eyebrow: 'Format switcher',
  description: 'Convert JPG images to PNG or PNG images to JPG locally in your browser.',
  acceptedTypes: ['image/jpeg', 'image/png'],
  mode: 'jpg-png',
  defaultOutput: 'auto',
  titleTag: 'JPG to PNG Converter and PNG to JPG Converter',
  metaDescription: 'Convert JPG to PNG and PNG to JPG in your browser with no upload required. Bulk image format converter with instant private downloads.',
  keywords: 'JPG to PNG, PNG to JPG, image format converter, convert JPG online, convert PNG online, bulk image converter',
};

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'compress',
    loadComponent: () => import('./features/tool-page/tool-page.component').then((m) => m.ToolPageComponent),
    data: { tool: compressTool },
  },
  {
    path: 'convert-webp',
    loadComponent: () => import('./features/tool-page/tool-page.component').then((m) => m.ToolPageComponent),
    data: { tool: webpTool },
  },
  {
    path: 'resize',
    loadComponent: () => import('./features/tool-page/tool-page.component').then((m) => m.ToolPageComponent),
    data: { tool: resizeTool },
  },
  {
    path: 'jpg-to-png',
    loadComponent: () => import('./features/tool-page/tool-page.component').then((m) => m.ToolPageComponent),
    data: { tool: jpgPngTool },
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
