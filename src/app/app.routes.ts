import { Routes } from '@angular/router';
import { ToolConfig } from './core/models/image-job.model';
import { HomeComponent } from './features/home/home.component';
import { NotFoundComponent } from './features/not-found/not-found.component';
import { ToolPageComponent } from './features/tool-page/tool-page.component';
import { PrivacyPolicyComponent } from './features/privacy-policy/privacy-policy.component';
import { TermsOfServiceComponent } from './features/terms-of-service/terms-of-service.component';
import { ContactComponent } from './features/contact/contact.component';
import { SharedImagesComponent } from './features/shared-images/shared-images.component';

const ALL_RASTER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/x-icon', 'image/vnd.microsoft.icon'];

const compressTool: ToolConfig = {
  id: 'compress',
  title: 'Image Compressor',
  eyebrow: 'JPG, PNG, WebP, AVIF, ICO',
  description: 'Reduce image file sizes locally — JPEG, PNG, WebP, AVIF and ICO all supported.',
  acceptedTypes: ALL_RASTER_TYPES,
  mode: 'compress',
  defaultOutput: 'original',
  titleTag: 'Image Compressor - Compress JPG, PNG, WebP, AVIF and ICO Online',
  metaDescription: 'Compress JPEG, PNG, WebP, AVIF, and ICO images online in your browser. Private image compressor with no uploads, instant previews, and bulk ZIP downloads.',
  keywords: 'image compressor, compress image online, compress JPG, compress PNG, compress AVIF, compress ICO, reduce image size, WebP compressor, private image compression',
};

const webpTool: ToolConfig = {
  id: 'convert-webp',
  title: 'Image to WebP Converter',
  eyebrow: 'Fast WebP export',
  description: 'Convert JPG, PNG, AVIF and ICO files to lightweight WebP images without uploading them.',
  acceptedTypes: ALL_RASTER_TYPES,
  mode: 'convert-webp',
  defaultOutput: 'webp',
  titleTag: 'Image to WebP Converter - Private Browser Tool',
  metaDescription: 'Convert JPG, PNG, WebP, AVIF, and ICO images to WebP in the browser using Canvas and File APIs. Bulk WebP converter with private local processing.',
  keywords: 'image to WebP, WebP converter, JPG to WebP, PNG to WebP, AVIF to WebP, convert image online, browser image converter',
};

const resizeTool: ToolConfig = {
  id: 'resize',
  title: 'Image Resizer',
  eyebrow: 'Custom dimensions',
  description: 'Resize images by width and height with aspect ratio lock and instant previews.',
  acceptedTypes: ALL_RASTER_TYPES,
  mode: 'resize',
  defaultOutput: 'original',
  titleTag: 'Image Resizer - Resize Images Online Privately',
  metaDescription: 'Resize JPG, PNG, WebP, AVIF, and ICO images online with custom dimensions, aspect ratio lock, instant previews, and private browser-side processing.',
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

const pngToSvgTool: ToolConfig = {
  id: 'png-to-svg',
  title: 'PNG to SVG Converter',
  eyebrow: 'Raster to Vector',
  description: 'Trace PNG, JPG, WebP and AVIF images into scalable SVG vector files — all processed locally in your browser.',
  acceptedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'],
  mode: 'png-to-svg',
  defaultOutput: 'svg',
  titleTag: 'PNG to SVG Converter - Free Online Raster to Vector Tool',
  metaDescription: 'Convert PNG, JPG, WebP and AVIF images to SVG vector format in your browser. Free raster to vector tracer with no uploads and instant downloads.',
  keywords: 'PNG to SVG, JPG to SVG, image to SVG, raster to vector, convert PNG to SVG, free SVG converter, vector tracing online',
};

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
  },
  {
    path: 'compress',
    component: ToolPageComponent,
    data: { tool: compressTool },
  },
  {
    path: 'convert-webp',
    component: ToolPageComponent,
    data: { tool: webpTool },
  },
  {
    path: 'resize',
    component: ToolPageComponent,
    data: { tool: resizeTool },
  },
  {
    path: 'jpg-to-png',
    component: ToolPageComponent,
    data: { tool: jpgPngTool },
  },
  {
    path: 'png-to-svg',
    component: ToolPageComponent,
    data: { tool: pngToSvgTool },
  },
  {
    path: 'privacy-policy',
    component: PrivacyPolicyComponent,
  },
  {
    path: 'terms-of-service',
    component: TermsOfServiceComponent,
  },
  {
    path: 'contact',
    component: ContactComponent,
  },
  {
    path: 'share/:id',
    component: SharedImagesComponent,
  },
  {
    path: '**',
    component: NotFoundComponent,
  },
];
