# PixelPress Image Tools

Angular standalone SaaS micro-tool for browser-side image compression, conversion, and resizing. All image processing uses the Canvas API and File API in the browser. There is no backend, API call, or paid service dependency.

## Tools

- Image Compressor for JPG, PNG, and WebP
- Image to WebP Converter
- Image Resizer with custom width, height, and aspect ratio lock
- JPG to PNG and PNG to JPG Converter

## Tech Stack

- Angular 21 standalone components, compatible with the requested Angular 18+ baseline
- Lazy loaded routes
- Angular signals for state
- Tailwind CSS with `dark:` classes
- Canvas API and File API

## Setup

```bash
npm install
npm start
```

Open `http://localhost:4200`.

## Build

```bash
npm run build
```

The production build is emitted to `dist/image-tools`.

## File Structure

```text
src/app/
  core/
    models/
    services/
  features/
    home/
    not-found/
    tool-page/
  shared/
    components/
      ad-slot/
      footer/
      header/
      upload-zone/
```

Static SEO assets are in `public/robots.txt` and `public/sitemap.xml`. Future API, Stripe, and AdSense keys can be placed in `src/environments/environment.ts` and `src/environments/environment.prod.ts`.
