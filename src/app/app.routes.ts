import { Routes } from '@angular/router';
import { ToolConfig } from './core/models/image-job.model';
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
const loadHome = () => import('./features/home/home.component').then((m) => m.HomeComponent);
const loadNotFound = () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent);
const loadToolPage = () => import('./features/tool-page/tool-page.component').then((m) => m.ToolPageComponent);
const loadPrivacyPolicy = () => import('./features/privacy-policy/privacy-policy.component').then((m) => m.PrivacyPolicyComponent);
const loadTermsOfService = () => import('./features/terms-of-service/terms-of-service.component').then((m) => m.TermsOfServiceComponent);
const loadContact = () => import('./features/contact/contact.component').then((m) => m.ContactComponent);
const loadSharedImages = () => import('./features/shared-images/shared-images.component').then((m) => m.SharedImagesComponent);
const loadImagesToPdf = () => import('./features/images-to-pdf/images-to-pdf.component').then((m) => m.ImagesToPdfComponent);
const loadImageTool = () => import('./features/image-tool/image-tool.component').then((m) => m.ImageToolComponent);
const loadTextTool = () => import('./features/text-tool/text-tool.component').then((m) => m.TextToolComponent);
const loadSeoTool = () => import('./features/seo-tool/seo-tool.component').then((m) => m.SeoToolComponent);
const loadUtilityTool = () => import('./features/utility-tool/utility-tool.component').then((m) => m.UtilityToolComponent);

const compressTool: ToolConfig = {
  id: 'compress',
  title: 'Image Compressor',
  eyebrow: 'JPG, PNG, WebP, AVIF, ICO',
  description: 'Reduce image file sizes — JPEG, PNG, WebP, AVIF and ICO all supported.',
  acceptedTypes: ALL_RASTER_TYPES,
  mode: 'compress',
  defaultOutput: 'original',
  titleTag: 'Image Compressor - Compress JPG, PNG, WebP, AVIF and ICO Online',
  metaDescription: 'Compress JPEG, PNG, WebP, AVIF, and ICO images online with instant previews and bulk ZIP downloads.',
  keywords: 'image compressor, compress image online, compress JPG, compress PNG, compress AVIF, compress ICO, reduce image size, WebP compressor, private image compression',
  seoContent: compressSeoContent,
  faqs: compressFaqs,
};

const webpTool: ToolConfig = {
  id: 'convert-webp',
  title: 'Image to WebP Converter',
  eyebrow: 'Fast WebP export',
  description: 'Convert JPG, PNG, AVIF and ICO files to lightweight WebP images.',
  acceptedTypes: ALL_RASTER_TYPES,
  mode: 'convert-webp',
  defaultOutput: 'webp',
  titleTag: 'PNG to WebP Converter - Convert Images to WebP Online',
  metaDescription: 'Convert PNG, JPG, AVIF, ICO, and WebP images to WebP with previews, quality control, and ZIP downloads.',
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
  metaDescription: 'Resize JPG, PNG, WebP, AVIF, and ICO images online with custom dimensions, crop controls, aspect ratio lock, and instant previews.',
  keywords: 'image resizer, resize image online, resize photo online, change size image, image size resizer, adjust picture dimensions, photo dimension editor, crop image, pixels to inches, px to inches, bulk image resize',
  seoContent: resizeSeoContent,
  faqs: resizeFaqs,
};

const jpgPngTool: ToolConfig = {
  id: 'jpg-to-png',
  title: 'JPG to PNG and PNG to JPG Converter',
  eyebrow: 'Format switcher',
  description: 'Convert JPG images to PNG or PNG images to JPG.',
  acceptedTypes: ['image/jpeg', 'image/png'],
  mode: 'jpg-png',
  defaultOutput: 'auto',
  titleTag: 'JPG to PNG Converter and PNG to JPG Converter',
  metaDescription: 'Convert JPG to PNG and PNG to JPG with previews, quality control, and downloads.',
  keywords: 'JPG to PNG, PNG to JPG, image format converter, png format converter, turn image to png, convert an image to png, photo convert png, convert JPG online, convert PNG online',
  seoContent: jpgPngSeoContent,
  faqs: jpgPngFaqs,
};

const pngToSvgTool: ToolConfig = {
  id: 'png-to-svg',
  title: 'PNG to SVG Converter',
  eyebrow: 'Raster to Vector',
  description: 'Trace PNG images into scalable SVG vector files.',
  acceptedTypes: ['image/png'],
  mode: 'png-to-svg',
  defaultOutput: 'svg',
  titleTag: 'PNG to SVG Converter - Free Online Raster to Vector Tool',
  metaDescription: 'Convert PNG images to SVG vector format with instant downloads.',
  keywords: 'PNG to SVG, JPG to SVG, image to SVG, raster to vector, convert PNG to SVG, free SVG converter, vector tracing online',
  seoContent: pngSvgSeoContent,
  faqs: pngSvgFaqs,
};

const imageToolSlugs = [
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
];

const imageToolRoutes: Routes = imageToolSlugs.map((slug) => ({
  path: slug,
  loadComponent: loadImageTool,
  data: { slug },
}));

const textToolSlugs = [
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
];

const textToolRoutes: Routes = textToolSlugs.map((slug) => ({
  path: slug,
  loadComponent: loadTextTool,
  data: { slug },
}));

const seoToolSlugs = [
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
];

const seoToolRoutes: Routes = seoToolSlugs.map((slug) => ({
  path: slug,
  loadComponent: loadSeoTool,
  data: { slug },
}));

const developerToolSlugs = [
  'json-formatter',
  'json-validator',
  'xml-formatter',
  'xml-validator',
  'html-formatter',
  'css-formatter',
  'javascript-formatter',
  'html-minifier',
  'css-minifier',
  'javascript-minifier',
  'sql-formatter',
  'url-encode',
  'url-decode',
  'base64-encode',
  'base64-decode',
  'jwt-decoder',
  'uuid-generator',
  'md5-generator',
  'sha1-generator',
  'sha256-generator',
  'sha512-generator',
];

const calculatorToolSlugs = [
  'age-calculator',
  'bmi-calculator',
  'percentage-calculator',
  'discount-calculator',
  'gst-calculator',
  'vat-calculator',
  'emi-calculator',
  'unit-converter',
  'scientific-calculator',
  'binary-calculator',
];

const generatorToolSlugs = [
  'qr-code-generator',
  'barcode-generator',
  'password-generator',
  'lorem-ipsum-generator',
  'random-number-generator',
  'random-name-generator',
  'random-color-generator',
  'css-gradient-generator',
  'css-box-shadow-generator',
  'css-border-radius-generator',
  'css-clip-path-generator',
];

const pdfToolSlugs = [
  'merge-pdf',
  'split-pdf',
  'rotate-pdf',
  'extract-pdf-pages',
  'rearrange-pdf-pages',
  'delete-pdf-pages',
  'add-page-numbers',
  'pdf-to-images',
  'pdf-metadata-viewer',
];

const gisToolSlugs = [
  'kml-circle-generator',
  'kml-polygon-generator',
  'geojson-to-kml',
  'kml-to-geojson',
  'gpx-to-kml',
  'coordinate-converter',
  'latitude-longitude-finder',
  'distance-calculator',
  'area-calculator',
  'buffer-generator',
];

const colorToolSlugs = [
  'hex-to-rgb',
  'rgb-to-hex',
  'hex-to-hsl',
  'hsl-to-hex',
  'color-palette-generator',
  'gradient-generator',
  'contrast-checker',
  'color-picker',
];

const dateTimeToolSlugs = [
  'timestamp-converter',
  'unix-timestamp-converter',
  'time-zone-converter',
  'date-difference-calculator',
  'countdown-timer',
];

const utilityToolRoutes: Routes = [...developerToolSlugs, ...calculatorToolSlugs, ...generatorToolSlugs, ...pdfToolSlugs, ...gisToolSlugs, ...colorToolSlugs, ...dateTimeToolSlugs].map((slug) => ({
  path: slug,
  loadComponent: loadUtilityTool,
  data: { slug },
}));

export const routes: Routes = [
  {
    path: '',
    loadComponent: loadHome,
  },
  {
    path: 'compress',
    loadComponent: loadToolPage,
    data: { tool: compressTool },
  },
  {
    path: 'convert-webp',
    loadComponent: loadToolPage,
    data: { tool: webpTool },
  },
  {
    path: 'resize',
    loadComponent: loadToolPage,
    data: { tool: resizeTool },
  },
  {
    path: 'jpg-to-png',
    loadComponent: loadToolPage,
    data: { tool: jpgPngTool },
  },
  {
    path: 'png-to-svg',
    loadComponent: loadToolPage,
    data: { tool: pngToSvgTool },
  },
  {
    path: 'images-to-pdf',
    loadComponent: loadImagesToPdf,
  },
  ...imageToolRoutes,
  ...textToolRoutes,
  ...seoToolRoutes,
  ...utilityToolRoutes,
  {
    path: 'privacy-policy',
    loadComponent: loadPrivacyPolicy,
  },
  {
    path: 'terms-of-service',
    loadComponent: loadTermsOfService,
  },
  {
    path: 'contact',
    loadComponent: loadContact,
  },
  {
    path: 'share/:id',
    loadComponent: loadSharedImages,
  },
  {
    path: '**',
    loadComponent: loadNotFound,
  },
];
