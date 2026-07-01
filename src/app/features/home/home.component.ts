import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { TOOL_CATEGORIES, TOOL_COUNT, ToolCatalogCategory, ToolCatalogItem } from '../../core/content/tool-catalog';

interface FeatureItem {
  title: string;
  description: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly seo = inject(SeoService);

  readonly toolCount = TOOL_COUNT;
  readonly categories = TOOL_CATEGORIES;
  readonly openFaq = signal<number | null>(0);

  readonly popularTools: ToolCatalogItem[] = [
    this.findTool('image-compressor'),
    this.findTool('image-resizer'),
    this.findTool('image-to-webp'),
    this.findTool('merge-pdf'),
    this.findTool('pdf-to-images'),
    this.findTool('qr-code-generator'),
    this.findTool('json-formatter'),
    this.findTool('sitemap-generator'),
  ].filter(Boolean) as ToolCatalogItem[];

  readonly features: FeatureItem[] = [
    {
      title: 'Fast browser workflows',
      description: 'Image, text, color, calculator, and developer tools open quickly and keep the work surface first.',
    },
    {
      title: 'Complete tool coverage',
      description: 'Use image converters, PDF utilities, SEO generators, QR tools, CSS generators, GIS helpers, and more from one catalog.',
    },
    {
      title: 'Clean downloads',
      description: 'Export finished files, ZIP batches, generated code, JSON, CSV, TXT, HTML, or PDF reports where the format makes sense.',
    },
  ];

  readonly steps: FeatureItem[] = [
    {
      title: 'Choose a tool',
      description: 'Open the exact converter, generator, calculator, or PDF utility from the home page or header search.',
    },
    {
      title: 'Add input',
      description: 'Upload files, paste text, enter a URL, pick colors, or set values using focused controls built for that tool.',
    },
    {
      title: 'Preview and download',
      description: 'Review the output, adjust options, then download the final file or copy the generated result.',
    },
  ];

  readonly faqs: FaqItem[] = [
    {
      question: 'What is FlexImagePro?',
      answer:
        'FlexImagePro is a free online toolkit for image conversion, PDF tasks, SEO markup, text cleanup, developer utilities, calculators, generators, color tools, and GIS map helpers.',
    },
    {
      question: 'Which tools are available on the site?',
      answer:
        'The catalog includes Image Tools, PDF Tools, Text Tools, SEO Tools, Developer Tools, Calculator Tools, Generator Tools, GIS and Map Tools, Color Tools, and Date and Time Tools.',
    },
    {
      question: 'Can I use FlexImagePro on mobile?',
      answer:
        'Yes. The layouts, upload zones, controls, dropdowns, and result panels are responsive for phones, tablets, laptops, and desktop screens.',
    },
    {
      question: 'Does PDF to Images support large PDFs?',
      answer:
        'Yes. PDF to Images can render all selected pages into a ZIP. If the browser cannot decode a PDF image format, the PDF repair fallback can prepare a cleaner copy before rendering.',
    },
    {
      question: 'Can I process multiple images at once?',
      answer:
        'Many image tools support batch workflows with previews, result cards, and ZIP downloads, while single-image tools keep the upload flow focused.',
    },
    {
      question: 'Are SEO generators included?',
      answer:
        'Yes. You can generate meta tags, robots.txt, sitemaps, canonical tags, Open Graph tags, Twitter cards, FAQ schema, breadcrumb schema, product schema, article schema, and hreflang tags.',
    },
    {
      question: 'Can I download generated output?',
      answer:
        'Yes. Tools show download actions based on the output type, including images, PDFs, ZIP files, TXT, CSV, JSON, HTML, and copy-ready code.',
    },
    {
      question: 'Is FlexImagePro free?',
      answer:
        'Yes. The tools are free to use and designed for quick everyday work without forcing a landing page before the actual tool.',
    },
  ];

  constructor() {
    this.seo.update(
      'FlexImagePro - Free Image, PDF, SEO and Utility Tools',
      'Use 120+ free online tools for images, PDFs, SEO, text, code, calculators, colors, QR codes, dates, and GIS map workflows.',
      'free online tools, image tools, PDF tools, SEO tools, text tools, developer tools, QR code generator, image converter, PDF converter',
    );
    this.seo.updateFaqSchema(this.faqs);
  }

  toggleFaq(index: number): void {
    this.openFaq.update((current) => current === index ? null : index);
  }

  trackByCategory(_: number, category: ToolCatalogCategory): string {
    return category.title;
  }

  trackByTool(_: number, tool: ToolCatalogItem): string {
    return tool.slug;
  }

  trackByTitle(_: number, item: FeatureItem): string {
    return item.title;
  }

  trackByFaq(_: number, item: FaqItem): string {
    return item.question;
  }

  private findTool(slug: string): ToolCatalogItem | undefined {
    return TOOL_CATEGORIES.flatMap((category) => category.tools).find((tool) => tool.slug === slug);
  }
}
