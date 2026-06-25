import { Routes } from '@angular/router';
import { ToolConfig } from './core/models/image-job.model';
import { HomeComponent } from './features/home/home.component';
import { NotFoundComponent } from './features/not-found/not-found.component';
import { ToolPageComponent } from './features/tool-page/tool-page.component';
import { PrivacyPolicyComponent } from './features/privacy-policy/privacy-policy.component';
import { TermsOfServiceComponent } from './features/terms-of-service/terms-of-service.component';
import { ContactComponent } from './features/contact/contact.component';
import { SharedImagesComponent } from './features/shared-images/shared-images.component';
import { ImagesToPdfComponent } from './features/images-to-pdf/images-to-pdf.component';
import {
  compressFaqs,
  compressSeoContent,
  jpgPngFaqs,
  jpgPngSeoContent,
  pngSvgFaqs,
  pngSvgSeoContent,
  resizeFaqs,
  resizeSeoContent,
  webpFaqs,
  webpSeoContent,
} from './core/content/tool-seo-content';

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
  seoContent: compressSeoContent,
  faqs: compressFaqs,
};

const webpTool: ToolConfig = {
  id: 'convert-webp',
  title: 'Image to WebP Converter',
  eyebrow: 'Fast WebP export',
  description: 'Convert JPG, PNG, AVIF and ICO files to lightweight WebP images without uploading them.',
  acceptedTypes: ALL_RASTER_TYPES,
  mode: 'convert-webp',
  defaultOutput: 'webp',
  titleTag: 'PNG to WebP Converter - Convert Images to WebP Online',
  metaDescription: 'Convert PNG, JPG, AVIF, ICO, and WebP images to WebP in your browser. Private PNG to WebP converter with previews, quality control, and ZIP downloads.',
  keywords: 'png to webp, png to webp converter, convert png to webp, png to webp hq, png to webp converter free, jpg to webp, image to WebP, WebP converter, convert image online',
  seoContent: webpSeoContent,
  faqs: webpFaqs,
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
  metaDescription: 'Resize JPG, PNG, WebP, AVIF, and ICO images online with custom dimensions, crop controls, aspect ratio lock, instant previews, and private browser-side processing.',
  keywords: 'image resizer, resize image online, resize photo online, change size image, image size resizer, adjust picture dimensions, photo dimension editor, crop image, pixels to inches, px to inches, bulk image resize',
  seoContent: resizeSeoContent,
  faqs: resizeFaqs,
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
  metaDescription: 'Convert JPG to PNG and PNG to JPG in your browser with no upload required. Bulk image format converter with previews, quality control, and private downloads.',
  keywords: 'JPG to PNG, PNG to JPG, image format converter, png format converter, turn image to png, convert an image to png, photo convert png, convert JPG online, convert PNG online',
  seoContent: jpgPngSeoContent,
  faqs: jpgPngFaqs,
};

const pngToSvgTool: ToolConfig = {
  id: 'png-to-svg',
  title: 'PNG to SVG Converter',
  eyebrow: 'Raster to Vector',
  description: 'Trace PNG images into scalable SVG vector files — all processed locally in your browser.',
  acceptedTypes: ['image/png'],
  mode: 'png-to-svg',
  defaultOutput: 'svg',
  titleTag: 'PNG to SVG Converter - Free Online Raster to Vector Tool',
  metaDescription: 'Convert PNG images to SVG vector format in your browser. Free raster to vector tracer with no uploads and instant downloads.',
  keywords: 'PNG to SVG, JPG to SVG, image to SVG, raster to vector, convert PNG to SVG, free SVG converter, vector tracing online',
  seoContent: pngSvgSeoContent,
  faqs: pngSvgFaqs,
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
    path: 'images-to-pdf',
    component: ImagesToPdfComponent,
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
