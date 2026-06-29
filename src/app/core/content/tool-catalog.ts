export interface ToolCatalogItem {
  label: string;
  slug: string;
  description: string;
  route: string;
  live?: boolean;
}

export interface ToolCatalogCategory {
  title: string;
  icon: string;
  tools: ToolCatalogItem[];
}

const pendingRoute = (slug: string) => `/${slug}`;

const tool = (
  label: string,
  slug: string,
  description: string,
  route = pendingRoute(slug),
  live = false,
): ToolCatalogItem => ({ label, slug, description, route, live });

export const TOOL_CATEGORIES: ToolCatalogCategory[] = [
  {
    title: 'Image Tools',
    icon: 'bi-images',
    tools: [
      tool('Image Compressor', 'image-compressor', 'Reduce JPG, PNG, WebP, AVIF, and ICO file sizes locally.', '/compress', true),
      tool('Image Resizer', 'image-resizer', 'Resize images by custom width and height.', '/resize', true),
      tool('Rotate Image', 'rotate-image', 'Rotate image files left, right, or by a custom angle.', '/rotate-image', true),
      tool('Flip Image', 'flip-image', 'Flip images horizontally or vertically.', '/flip-image', true),
      tool('Watermark Image', 'watermark-image', 'Add text or image watermarks to protect visual assets.', '/watermark-image', true),
      tool('JPG / PNG Converter', 'jpg-png-converter', 'Convert between JPG and PNG formats.', '/jpg-to-png', true),
      tool('Image to WEBP', 'image-to-webp', 'Create lightweight WebP images from JPG, PNG, AVIF, ICO, and WebP files.', '/convert-webp', true),
      tool('WEBP to JPG', 'webp-to-jpg', 'Convert WebP images into JPG files.', '/webp-to-jpg', true),
      tool('WEBP to PNG', 'webp-to-png', 'Convert WebP images into PNG files.', '/webp-to-png', true),
      tool('JPG to AVIF', 'jpg-to-avif', 'Convert JPG images into modern AVIF files.', '/jpg-to-avif', true),
      tool('AVIF to JPG', 'avif-to-jpg', 'Convert AVIF images into JPG files.', '/avif-to-jpg', true),
      tool('HEIC to JPG', 'heic-to-jpg', 'Convert iPhone HEIC photos into JPG files.', '/heic-to-jpg', true),
      tool('GIF to PNG', 'gif-to-png', 'Extract or convert GIF frames into PNG images.', '/gif-to-png', true),
      tool('Convert to ICO', 'convert-to-ico', 'Create ICO favicon files from common image formats.', '/convert-to-ico', true),
      tool('SVG to PNG', 'svg-to-png', 'Render SVG graphics as PNG images.', '/svg-to-png', true),
      tool('PNG to SVG', 'png-to-svg', 'Trace PNG images into scalable SVG vector files.', '/png-to-svg', true),
      tool('Image Metadata Viewer', 'image-metadata-viewer', 'View dimensions, type, and useful image file metadata.', '/image-metadata-viewer', true),
      tool('Image DPI Checker', 'image-dpi-checker', 'Check image DPI and print-size information.', '/image-dpi-checker', true),
      tool('Change Image DPI', 'change-image-dpi', 'Change embedded PNG or JPG DPI metadata without resizing pixels.', '/change-image-dpi', true),
      tool('Image Size Checker', 'image-size-checker', 'Check pixel dimensions and file size instantly.', '/image-size-checker', true),
      tool('Color Picker from Image', 'color-picker-from-image', 'Pick colors directly from uploaded images.', '/color-picker-from-image', true),
      tool('Blur Image', 'blur-image', 'Apply a blur effect to photos and graphics.', '/blur-image', true),
      tool('Sharpen Image', 'sharpen-image', 'Sharpen soft image details.', '/sharpen-image', true),
      tool('Brightness & Contrast', 'brightness-contrast', 'Adjust image brightness and contrast.', '/brightness-contrast', true),
      tool('Grayscale Filter', 'grayscale-filter', 'Convert images to grayscale.', '/grayscale-filter', true),
      tool('Sepia Filter', 'sepia-filter', 'Apply a warm sepia filter.', '/sepia-filter', true),
      tool('Invert Colors', 'invert-colors', 'Invert image colors for creative or accessibility workflows.', '/invert-colors', true),
      tool('Image to Base64', 'image-to-base64', 'Encode images as Base64 strings.', '/image-to-base64', true),
      tool('Base64 to Image', 'base64-to-image', 'Decode Base64 strings back into image files.', '/base64-to-image', true),
    ],
  },
  {
    title: 'PDF Tools',
    icon: 'bi-file-earmark-pdf',
    tools: [
      tool('Merge PDF', 'merge-pdf', 'Combine multiple PDF files into one document.', '/merge-pdf', true),
      tool('Split PDF', 'split-pdf', 'Split a PDF into separate files.', '/split-pdf', true),
      tool('Rotate PDF', 'rotate-pdf', 'Rotate selected PDF pages.', '/rotate-pdf', true),
      tool('Extract Pages', 'extract-pdf-pages', 'Extract selected pages from a PDF.', '/extract-pdf-pages', true),
      tool('Rearrange PDF Pages', 'rearrange-pdf-pages', 'Reorder PDF pages visually.', '/rearrange-pdf-pages', true),
      tool('Delete PDF Pages', 'delete-pdf-pages', 'Remove unwanted pages from a PDF.', '/delete-pdf-pages', true),
      tool('Add Page Numbers', 'add-page-numbers', 'Add page numbers to PDF documents.', '/add-page-numbers', true),
      tool('Images to PDF', 'images-to-pdf', 'Combine images into one PDF document.', '/images-to-pdf', true),
      tool('PDF to Images', 'pdf-to-images', 'Export PDF pages as images.', '/pdf-to-images', true),
      tool('PDF Metadata Viewer', 'pdf-metadata-viewer', 'View PDF title, author, page count, and metadata.', '/pdf-metadata-viewer', true),
    ],
  },
  {
    title: 'Text Tools',
    icon: 'bi-type',
    tools: [
      tool('Word Counter', 'word-counter', 'Count words in text instantly.', '/word-counter', true),
      tool('Character Counter', 'character-counter', 'Count characters, spaces, and text length.', '/character-counter', true),
      tool('Text Compare', 'text-compare', 'Compare two blocks of text.', '/text-compare', true),
      tool('Text Repeater', 'text-repeater', 'Repeat text a chosen number of times.', '/text-repeater', true),
      tool('Random Text Generator', 'random-text-generator', 'Generate random text snippets.', '/random-text-generator', true),
      tool('Remove Duplicate Lines', 'remove-duplicate-lines', 'Remove repeated lines from text.', '/remove-duplicate-lines', true),
      tool('Remove Empty Lines', 'remove-empty-lines', 'Clean blank lines from text.', '/remove-empty-lines', true),
      tool('Remove Extra Spaces', 'remove-extra-spaces', 'Normalize extra spaces in text.', '/remove-extra-spaces', true),
      tool('Sort Lines', 'sort-lines', 'Sort text lines alphabetically.', '/sort-lines', true),
      tool('Reverse Text', 'reverse-text', 'Reverse text order.', '/reverse-text', true),
      tool('Case Converter', 'case-converter', 'Convert text between uppercase, lowercase, title case, and more.', '/case-converter', true),
      tool('Slug Generator', 'slug-generator', 'Create URL-friendly slugs from text.', '/slug-generator', true),
    ],
  },
  {
    title: 'SEO Tools',
    icon: 'bi-search',
    tools: [
      tool('Meta Tag Generator', 'meta-tag-generator', 'Generate title, description, and meta tags.', '/meta-tag-generator', true),
      tool('Robots.txt Generator', 'robots-txt-generator', 'Create a robots.txt file.', '/robots-txt-generator', true),
      tool('Sitemap Generator', 'sitemap-generator', 'Generate sitemap entries for websites.', '/sitemap-generator', true),
      tool('Canonical Tag Generator', 'canonical-tag-generator', 'Create canonical URL tags.', '/canonical-tag-generator', true),
      tool('Open Graph Generator', 'open-graph-generator', 'Generate Open Graph tags for social previews.', '/open-graph-generator', true),
      tool('Twitter Card Generator', 'twitter-card-generator', 'Create Twitter/X card tags.', '/twitter-card-generator', true),
      tool('FAQ Schema Generator', 'faq-schema-generator', 'Generate FAQ JSON-LD schema.', '/faq-schema-generator', true),
      tool('Breadcrumb Schema Generator', 'breadcrumb-schema-generator', 'Generate breadcrumb JSON-LD schema.', '/breadcrumb-schema-generator', true),
      tool('Organization Schema Generator', 'organization-schema-generator', 'Generate organization JSON-LD schema.', '/organization-schema-generator', true),
      tool('Product Schema Generator', 'product-schema-generator', 'Generate product JSON-LD schema.', '/product-schema-generator', true),
      tool('Article Schema Generator', 'article-schema-generator', 'Generate article JSON-LD schema.', '/article-schema-generator', true),
      tool('JSON-LD Generator', 'json-ld-generator', 'Create structured JSON-LD data.', '/json-ld-generator', true),
      tool('Hreflang Generator', 'hreflang-generator', 'Generate hreflang tags for multilingual pages.', '/hreflang-generator', true),
    ],
  },
  {
    title: 'Developer Tools',
    icon: 'bi-code-slash',
    tools: [
      tool('JSON Formatter', 'json-formatter', 'Format JSON for easier reading.', '/json-formatter', true),
      tool('JSON Validator', 'json-validator', 'Validate JSON syntax.', '/json-validator', true),
      tool('XML Formatter', 'xml-formatter', 'Format XML documents.', '/xml-formatter', true),
      tool('XML Validator', 'xml-validator', 'Validate XML syntax.', '/xml-validator', true),
      tool('HTML Formatter', 'html-formatter', 'Format HTML markup.', '/html-formatter', true),
      tool('CSS Formatter', 'css-formatter', 'Format CSS stylesheets.', '/css-formatter', true),
      tool('JavaScript Formatter', 'javascript-formatter', 'Format JavaScript code.', '/javascript-formatter', true),
      tool('HTML Minifier', 'html-minifier', 'Minify HTML markup.', '/html-minifier', true),
      tool('CSS Minifier', 'css-minifier', 'Minify CSS stylesheets.', '/css-minifier', true),
      tool('JavaScript Minifier', 'javascript-minifier', 'Minify JavaScript code.', '/javascript-minifier', true),
      tool('SQL Formatter', 'sql-formatter', 'Format SQL queries.', '/sql-formatter', true),
      tool('URL Encode', 'url-encode', 'Encode text for URLs.', '/url-encode', true),
      tool('URL Decode', 'url-decode', 'Decode URL-encoded text.', '/url-decode', true),
      tool('Base64 Encode', 'base64-encode', 'Encode text as Base64.', '/base64-encode', true),
      tool('Base64 Decode', 'base64-decode', 'Decode Base64 text.', '/base64-decode', true),
      tool('JWT Decoder', 'jwt-decoder', 'Decode JWT headers and payloads.', '/jwt-decoder', true),
      tool('UUID Generator', 'uuid-generator', 'Generate UUID values.', '/uuid-generator', true),
      tool('MD5 Generator', 'md5-generator', 'Generate MD5 hashes.', '/md5-generator', true),
      tool('SHA1 Generator', 'sha1-generator', 'Generate SHA1 hashes.', '/sha1-generator', true),
      tool('SHA256 Generator', 'sha256-generator', 'Generate SHA256 hashes.', '/sha256-generator', true),
      tool('SHA512 Generator', 'sha512-generator', 'Generate SHA512 hashes.', '/sha512-generator', true),
    ],
  },
  {
    title: 'Calculator Tools',
    icon: 'bi-calculator',
    tools: [
      tool('Age Calculator', 'age-calculator', 'Calculate age from a date of birth.', '/age-calculator', true),
      tool('BMI Calculator', 'bmi-calculator', 'Calculate body mass index.', '/bmi-calculator', true),
      tool('Percentage Calculator', 'percentage-calculator', 'Calculate percentages quickly.', '/percentage-calculator', true),
      tool('Discount Calculator', 'discount-calculator', 'Calculate sale discounts.', '/discount-calculator', true),
      tool('GST Calculator', 'gst-calculator', 'Calculate GST amounts.', '/gst-calculator', true),
      tool('VAT Calculator', 'vat-calculator', 'Calculate VAT amounts.', '/vat-calculator', true),
      tool('EMI Calculator', 'emi-calculator', 'Estimate loan EMI payments.', '/emi-calculator', true),
      tool('Unit Converter', 'unit-converter', 'Convert common units.', '/unit-converter', true),
      tool('Scientific Calculator', 'scientific-calculator', 'Run scientific calculations.', '/scientific-calculator', true),
      tool('Binary Calculator', 'binary-calculator', 'Calculate binary values.', '/binary-calculator', true),
    ],
  },
  {
    title: 'Generator Tools',
    icon: 'bi-magic',
    tools: [
      tool('QR Code Generator', 'qr-code-generator', 'Generate QR codes.', '/qr-code-generator', true),
      tool('Barcode Generator', 'barcode-generator', 'Generate barcodes.', '/barcode-generator', true),
      tool('Password Generator', 'password-generator', 'Generate strong passwords.', '/password-generator', true),
      tool('Lorem Ipsum Generator', 'lorem-ipsum-generator', 'Generate placeholder text.', '/lorem-ipsum-generator', true),
      tool('Random Number Generator', 'random-number-generator', 'Generate random numbers.', '/random-number-generator', true),
      tool('Random Name Generator', 'random-name-generator', 'Generate random names.', '/random-name-generator', true),
      tool('Random Color Generator', 'random-color-generator', 'Generate random colors.', '/random-color-generator', true),
      tool('CSS Gradient Generator', 'css-gradient-generator', 'Generate CSS gradients.', '/css-gradient-generator', true),
      tool('CSS Box Shadow Generator', 'css-box-shadow-generator', 'Generate CSS box shadows.', '/css-box-shadow-generator', true),
      tool('CSS Border Radius Generator', 'css-border-radius-generator', 'Generate border radius CSS.', '/css-border-radius-generator', true),
      tool('CSS Clip Path Generator', 'css-clip-path-generator', 'Generate CSS clip-path shapes.', '/css-clip-path-generator', true),
    ],
  },
  {
    title: 'GIS / Map Tools',
    icon: 'bi-geo-alt',
    tools: [
      tool('KML Circle Generator', 'kml-circle-generator', 'Generate KML circles for map tools.', '/kml-circle-generator', true),
      tool('KML Polygon Generator', 'kml-polygon-generator', 'Generate KML polygons.', '/kml-polygon-generator', true),
      tool('GeoJSON to KML', 'geojson-to-kml', 'Convert GeoJSON data to KML.', '/geojson-to-kml', true),
      tool('KML to GeoJSON', 'kml-to-geojson', 'Convert KML data to GeoJSON.', '/kml-to-geojson', true),
      tool('GPX to KML', 'gpx-to-kml', 'Convert GPX tracks to KML.', '/gpx-to-kml', true),
      tool('Coordinate Converter', 'coordinate-converter', 'Convert coordinate formats.', '/coordinate-converter', true),
      tool('Latitude & Longitude Finder', 'latitude-longitude-finder', 'Find coordinates for locations.', '/latitude-longitude-finder', true),
      tool('Distance Calculator', 'distance-calculator', 'Calculate distance between coordinates.', '/distance-calculator', true),
      tool('Area Calculator', 'area-calculator', 'Calculate map area.', '/area-calculator', true),
      tool('Buffer Generator', 'buffer-generator', 'Generate map buffers.', '/buffer-generator', true),
    ],
  },
  {
    title: 'Color Tools',
    icon: 'bi-palette',
    tools: [
      tool('HEX to RGB', 'hex-to-rgb', 'Convert HEX colors to RGB.', '/hex-to-rgb', true),
      tool('RGB to HEX', 'rgb-to-hex', 'Convert RGB colors to HEX.', '/rgb-to-hex', true),
      tool('HEX to HSL', 'hex-to-hsl', 'Convert HEX colors to HSL.', '/hex-to-hsl', true),
      tool('HSL to HEX', 'hsl-to-hex', 'Convert HSL colors to HEX.', '/hsl-to-hex', true),
      tool('Color Palette Generator', 'color-palette-generator', 'Generate color palettes.', '/color-palette-generator', true),
      tool('Gradient Generator', 'gradient-generator', 'Create color gradients.', '/gradient-generator', true),
      tool('Contrast Checker', 'contrast-checker', 'Check color contrast ratios.', '/contrast-checker', true),
      tool('Color Picker', 'color-picker', 'Pick and convert colors.', '/color-picker', true),
    ],
  },
  {
    title: 'Date & Time Tools',
    icon: 'bi-clock',
    tools: [
      tool('Timestamp Converter', 'timestamp-converter', 'Convert timestamps into readable dates.', '/timestamp-converter', true),
      tool('Unix Timestamp Converter', 'unix-timestamp-converter', 'Convert Unix timestamps.', '/unix-timestamp-converter', true),
      tool('Time Zone Converter', 'time-zone-converter', 'Convert time across time zones.', '/time-zone-converter', true),
      tool('Date Difference Calculator', 'date-difference-calculator', 'Calculate the difference between dates.', '/date-difference-calculator', true),
      tool('Countdown Timer', 'countdown-timer', 'Create a simple countdown timer.', '/countdown-timer', true),
    ],
  },
];

export const ALL_TOOLS = TOOL_CATEGORIES.flatMap((category) => category.tools);
export const TOOL_COUNT = ALL_TOOLS.length;

export function findToolBySlug(slug: string | null): ToolCatalogItem | undefined {
  return ALL_TOOLS.find((item) => item.slug === slug);
}
