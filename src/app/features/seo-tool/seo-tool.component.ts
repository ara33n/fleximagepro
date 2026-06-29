import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TOOL_CATEGORIES, findToolBySlug, ToolCatalogItem } from '../../core/content/tool-catalog';
import { findCategoryForTool, generateToolSeo } from '../../core/content/generated-tool-seo';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';
import { ToolSeoBlockComponent } from '../../shared/components/tool-seo-block/tool-seo-block.component';
import { PageLoaderService } from '../../core/services/page-loader.service';
import { ExportPdfService } from '../../core/services/export-pdf.service';

type SeoToolKind =
  | 'meta-tag-generator'
  | 'robots-txt-generator'
  | 'sitemap-generator'
  | 'canonical-tag-generator'
  | 'open-graph-generator'
  | 'twitter-card-generator'
  | 'faq-schema-generator'
  | 'breadcrumb-schema-generator'
  | 'organization-schema-generator'
  | 'product-schema-generator'
  | 'article-schema-generator'
  | 'json-ld-generator'
  | 'hreflang-generator';

interface ResultRow {
  label: string;
  value: string;
}

interface RobotRule {
  label: string;
  userAgent: string;
  action: 'default' | 'allowed' | 'blocked';
}

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

interface BreadcrumbEntry {
  id: string;
  name: string;
  url: string;
}

interface HreflangEntry {
  id: string;
  language: string;
  url: string;
}

interface SitemapCrawlResponse {
  source: 'existing' | 'generated' | 'combined';
  robotsFound: boolean;
  existingSitemapUrl: string | null;
  pages: string[];
  totalPages: number;
  sitemapXml: string;
  limit: number;
}

interface SeoFields {
  siteUrl: string;
  title: string;
  description: string;
  imageUrl: string;
  author: string;
  language: string;
  robotsAllow: string;
  robotsDisallow: string;
  sitemapUrls: string;
  canonicalUrl: string;
  twitterHandle: string;
  faqItems: string;
  breadcrumbs: string;
  organizationName: string;
  logoUrl: string;
  productName: string;
  price: string;
  currency: string;
  availability: string;
  articleHeadline: string;
  publishedDate: string;
  jsonLdType: string;
  hreflangItems: string;
}

const DEFAULT_FIELDS: SeoFields = {
  siteUrl: 'https://example.com',
  title: 'Example Page Title',
  description: 'Write a clear page description for search results and social previews.',
  imageUrl: 'https://example.com/preview.jpg',
  author: 'Example Author',
  language: 'en',
  robotsAllow: '/',
  robotsDisallow: '/admin',
  sitemapUrls: 'https://example.com/\nhttps://example.com/about\nhttps://example.com/contact',
  canonicalUrl: 'https://example.com/page',
  twitterHandle: '@example',
  faqItems: 'What is this page?|This page answers a common question.\nHow does it help?|It gives users clear information.',
  breadcrumbs: 'Home|https://example.com/\nTools|https://example.com/tools\nCurrent Page|https://example.com/tools/current',
  organizationName: 'Example Organization',
  logoUrl: 'https://example.com/logo.png',
  productName: 'Example Product',
  price: '49.00',
  currency: 'USD',
  availability: 'https://schema.org/InStock',
  articleHeadline: 'Example Article Headline',
  publishedDate: new Date().toISOString().slice(0, 10),
  jsonLdType: 'WebPage',
  hreflangItems: 'en|https://example.com/\nes|https://example.com/es/\nx-default|https://example.com/',
};

const DEFAULT_ROBOTS: RobotRule[] = [
  { label: 'Google', userAgent: 'Googlebot', action: 'allowed' },
  { label: 'Google Image', userAgent: 'Googlebot-Image', action: 'allowed' },
  { label: 'Google Mobile', userAgent: 'Googlebot-Mobile', action: 'allowed' },
  { label: 'MSN Search', userAgent: 'msnbot', action: 'allowed' },
  { label: 'Yahoo', userAgent: 'Slurp', action: 'default' },
  { label: 'Yahoo MM', userAgent: 'Yahoo-MMCrawler', action: 'default' },
  { label: 'Yahoo Blogs', userAgent: 'Yahoo-Blogs', action: 'default' },
  { label: 'Ask/Teoma', userAgent: 'Teoma', action: 'default' },
  { label: 'GigaBlast', userAgent: 'Gigabot', action: 'default' },
  { label: 'DMOZ Checker', userAgent: 'Robozilla', action: 'default' },
  { label: 'Nutch', userAgent: 'Nutch', action: 'default' },
  { label: 'Alexa/Wayback', userAgent: 'ia_archiver', action: 'default' },
  { label: 'Baidu', userAgent: 'Baiduspider', action: 'default' },
  { label: 'Naver', userAgent: 'Yeti', action: 'default' },
  { label: 'MSN PicSearch', userAgent: 'psbot', action: 'default' },
];

@Component({
  selector: 'app-seo-tool',
  standalone: true,
  imports: [ToolSeoBlockComponent],
  templateUrl: './seo-tool.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeoToolComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly loader = inject(PageLoaderService);
  private readonly exportPdf = inject(ExportPdfService);

  readonly slug = this.route.snapshot.data['slug'] as SeoToolKind;
  readonly kind = this.slug;
  readonly category = findCategoryForTool(this.slug) ?? TOOL_CATEGORIES[0];
  readonly catalogItem = signal<ToolCatalogItem>(
    findToolBySlug(this.slug) ?? {
      label: 'SEO Tool',
      slug: this.slug,
      route: `/${this.slug}`,
      description: 'Generate SEO markup and files.',
    },
  );

  readonly fields = signal<SeoFields>({ ...DEFAULT_FIELDS });
  readonly defaultRobotAction = signal<'allowed' | 'blocked'>('allowed');
  readonly crawlDelay = signal(120);
  readonly sitemapUrl = signal('https://www.xml-sitemaps.com/');
  readonly restrictedDirectories = signal('/cgi-bin/');
  readonly robotRules = signal<RobotRule[]>(DEFAULT_ROBOTS.map((rule) => ({ ...rule })));
  readonly faqQuestion = signal('');
  readonly faqAnswer = signal('');
  readonly faqEntries = signal<FaqEntry[]>([
    {
      id: crypto.randomUUID(),
      question: 'What is this page?',
      answer: 'This page answers a common question.',
    },
  ]);
  readonly breadcrumbName = signal('');
  readonly breadcrumbUrl = signal('');
  readonly breadcrumbEntries = signal<BreadcrumbEntry[]>([
    { id: crypto.randomUUID(), name: 'Home', url: 'https://example.com/' },
    { id: crypto.randomUUID(), name: 'Tools', url: 'https://example.com/tools' },
  ]);
  readonly hreflangLanguage = signal('');
  readonly hreflangUrl = signal('');
  readonly hreflangEntries = signal<HreflangEntry[]>([
    { id: crypto.randomUUID(), language: 'en', url: 'https://example.com/' },
    { id: crypto.randomUUID(), language: 'x-default', url: 'https://example.com/' },
  ]);
  readonly sitemapWebsiteUrl = signal('https://example.com');
  readonly sitemapIsLoading = signal(false);
  readonly sitemapError = signal<string | null>(null);
  readonly sitemapStatus = signal('');
  readonly sitemapPages = signal<string[]>([]);
  readonly sitemapSource = signal<'existing' | 'generated' | 'combined' | null>(null);
  readonly sitemapRobotsFound = signal(false);
  readonly sitemapExistingUrl = signal<string | null>(null);
  readonly output = signal('');
  readonly rows = signal<ResultRow[]>([]);

  ngOnInit(): void {
    const item = this.catalogItem();
    const seoContent = generateToolSeo(item, this.category);
    this.seo.update(seoContent.title, seoContent.metaDescription);
    this.seo.updateFaqSchema(seoContent.faqs);
    this.seo.updateBreadcrumbSchema(seoContent.breadcrumb);
    this.generate();
  }

  updateField(key: keyof SeoFields, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
    this.fields.update((fields) => ({ ...fields, [key]: value }));
  }

  updateCrawlDelay(event: Event): void {
    this.crawlDelay.set(Math.max(0, Number((event.target as HTMLInputElement).value)));
  }

  updateSitemapUrl(event: Event): void {
    this.sitemapUrl.set((event.target as HTMLInputElement).value);
  }

  updateRestrictedDirectories(event: Event): void {
    this.restrictedDirectories.set((event.target as HTMLTextAreaElement).value);
  }

  setDefaultRobotAction(action: 'allowed' | 'blocked'): void {
    this.defaultRobotAction.set(action);
    this.generate();
  }

  setRobotAction(userAgent: string, action: RobotRule['action']): void {
    this.robotRules.update((rules) => rules.map((rule) => rule.userAgent === userAgent ? { ...rule, action } : rule));
    this.generate();
  }

  updateFaqQuestion(event: Event): void {
    this.faqQuestion.set((event.target as HTMLInputElement).value);
  }

  updateFaqAnswer(event: Event): void {
    this.faqAnswer.set((event.target as HTMLTextAreaElement).value);
  }

  addFaq(): void {
    const question = this.faqQuestion().trim();
    const answer = this.faqAnswer().trim();
    if (!question || !answer) {
      this.toast.error('Add both question and answer.');
      return;
    }
    this.faqEntries.update((entries) => [...entries, { id: crypto.randomUUID(), question, answer }]);
    this.faqQuestion.set('');
    this.faqAnswer.set('');
    this.generate();
  }

  removeFaq(id: string): void {
    this.faqEntries.update((entries) => entries.filter((entry) => entry.id !== id));
    this.generate();
  }

  updateBreadcrumbName(event: Event): void {
    this.breadcrumbName.set((event.target as HTMLInputElement).value);
  }

  updateBreadcrumbUrl(event: Event): void {
    this.breadcrumbUrl.set((event.target as HTMLInputElement).value);
  }

  addBreadcrumb(): void {
    const name = this.breadcrumbName().trim();
    const url = this.breadcrumbUrl().trim();
    if (!name || !this.isValidUrl(url)) {
      this.toast.error('Add a breadcrumb name and valid URL.');
      return;
    }
    this.breadcrumbEntries.update((entries) => [...entries, { id: crypto.randomUUID(), name, url }]);
    this.breadcrumbName.set('');
    this.breadcrumbUrl.set('');
    this.generate();
  }

  removeBreadcrumb(id: string): void {
    this.breadcrumbEntries.update((entries) => entries.filter((entry) => entry.id !== id));
    this.generate();
  }

  updateHreflangLanguage(event: Event): void {
    this.hreflangLanguage.set((event.target as HTMLInputElement).value);
  }

  updateHreflangUrl(event: Event): void {
    this.hreflangUrl.set((event.target as HTMLInputElement).value);
  }

  addHreflang(): void {
    const language = this.hreflangLanguage().trim();
    const url = this.hreflangUrl().trim();
    if (!language || !this.isValidUrl(url)) {
      this.toast.error('Add a language code and valid URL.');
      return;
    }
    this.hreflangEntries.update((entries) => [...entries, { id: crypto.randomUUID(), language, url }]);
    this.hreflangLanguage.set('');
    this.hreflangUrl.set('');
    this.generate();
  }

  removeHreflang(id: string): void {
    this.hreflangEntries.update((entries) => entries.filter((entry) => entry.id !== id));
    this.generate();
  }

  updateSitemapWebsiteUrl(event: Event): void {
    this.sitemapWebsiteUrl.set((event.target as HTMLInputElement).value);
  }

  async crawlSitemap(): Promise<void> {
    const url = this.sitemapWebsiteUrl().trim();
    if (!this.isValidUrlWithOptionalProtocol(url)) {
      this.sitemapError.set('Enter a valid website URL.');
      this.toast.error('Enter a valid website URL.');
      return;
    }
    this.sitemapIsLoading.set(true);
    this.sitemapError.set(null);
    this.sitemapStatus.set('');
    this.sitemapPages.set([]);
    this.sitemapSource.set(null);
    this.sitemapExistingUrl.set(null);
    try {
      const apiBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');
      const response = await this.loader.track(fetch(`${apiBaseUrl}/api/seo/sitemap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, limit: 500 }),
      }));
      const payload = await response.json() as SitemapCrawlResponse | { error?: string };
      if (!response.ok) {
        throw new Error('error' in payload && payload.error ? payload.error : 'Sitemap crawl failed.');
      }
      const result = payload as SitemapCrawlResponse;
      this.output.set(result.sitemapXml);
      this.sitemapPages.set(result.pages || []);
      this.sitemapSource.set(result.source);
      this.sitemapRobotsFound.set(result.robotsFound);
      this.sitemapExistingUrl.set(result.existingSitemapUrl);
      this.sitemapStatus.set('');
      this.toast.success(result.source === 'existing' || result.source === 'combined'
        ? `Sitemap checked and crawl merged ${result.totalPages} URL${result.totalPages === 1 ? '' : 's'}.`
        : `Sitemap generated with ${result.totalPages} page${result.totalPages === 1 ? '' : 's'}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sitemap crawl failed.';
      this.sitemapError.set(message);
      this.sitemapStatus.set('');
      this.toast.error(message);
    } finally {
      this.sitemapIsLoading.set(false);
    }
  }

  generate(): void {
    const f = this.fields();
    let output = '';
    switch (this.kind) {
      case 'meta-tag-generator':
        output = this.metaTags(f);
        break;
      case 'robots-txt-generator':
        output = this.robotsTxt();
        break;
      case 'sitemap-generator':
        output = this.sitemapXml(f);
        break;
      case 'canonical-tag-generator':
        output = `<link rel="canonical" href="${this.escapeAttr(f.canonicalUrl)}">`;
        break;
      case 'open-graph-generator':
        output = this.openGraphTags(f);
        break;
      case 'twitter-card-generator':
        output = this.twitterCardTags(f);
        break;
      case 'faq-schema-generator':
        output = this.scriptJson(this.faqSchema());
        break;
      case 'breadcrumb-schema-generator':
        output = this.scriptJson(this.breadcrumbSchema());
        break;
      case 'organization-schema-generator':
        output = this.scriptJson(this.organizationSchema(f));
        break;
      case 'product-schema-generator':
        output = this.scriptJson(this.productSchema(f));
        break;
      case 'article-schema-generator':
        output = this.scriptJson(this.articleSchema(f));
        break;
      case 'json-ld-generator':
        output = this.scriptJson(this.genericJsonLd(f));
        break;
      case 'hreflang-generator':
        output = this.hreflangTags();
        break;
    }
    this.output.set(output);
    this.rows.set([
      { label: 'Tool', value: this.catalogItem().label },
      { label: 'Output', value: this.outputType() },
      { label: 'Characters', value: output.length.toLocaleString() },
    ]);
  }

  clear(): void {
    this.fields.set({ ...DEFAULT_FIELDS });
    this.defaultRobotAction.set('allowed');
    this.crawlDelay.set(120);
    this.sitemapUrl.set('https://www.xml-sitemaps.com/');
    this.restrictedDirectories.set('/cgi-bin/');
    this.robotRules.set(DEFAULT_ROBOTS.map((rule) => ({ ...rule })));
    this.faqQuestion.set('');
    this.faqAnswer.set('');
    this.faqEntries.set([{
      id: crypto.randomUUID(),
      question: 'What is this page?',
      answer: 'This page answers a common question.',
    }]);
    this.breadcrumbName.set('');
    this.breadcrumbUrl.set('');
    this.breadcrumbEntries.set([
      { id: crypto.randomUUID(), name: 'Home', url: 'https://example.com/' },
      { id: crypto.randomUUID(), name: 'Tools', url: 'https://example.com/tools' },
    ]);
    this.hreflangLanguage.set('');
    this.hreflangUrl.set('');
    this.hreflangEntries.set([
      { id: crypto.randomUUID(), language: 'en', url: 'https://example.com/' },
      { id: crypto.randomUUID(), language: 'x-default', url: 'https://example.com/' },
    ]);
    this.sitemapWebsiteUrl.set('https://example.com');
    this.sitemapError.set(null);
    this.sitemapStatus.set('');
    this.sitemapPages.set([]);
    this.sitemapSource.set(null);
    this.sitemapRobotsFound.set(false);
    this.sitemapExistingUrl.set(null);
    this.generate();
  }

  async copyOutput(): Promise<void> {
    if (!this.output()) return;
    try {
      await navigator.clipboard.writeText(this.output());
      this.toast.success('Copied to clipboard.');
    } catch {
      this.toast.error('Copy failed. Select and copy manually.');
    }
  }

  downloadOutput(format: 'txt' | 'csv' | 'json' | 'html' | 'pdf' = this.downloadExtension() as 'txt' | 'csv' | 'json' | 'html' | 'pdf'): void {
    if (!this.output()) return;
    const blob = this.outputBlob(format);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.slug}.${format}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  outputType(): string {
    if (this.kind === 'robots-txt-generator') return 'robots.txt';
    if (this.kind === 'sitemap-generator') return 'XML';
    if (this.kind.includes('schema') || this.kind === 'json-ld-generator') return 'JSON-LD';
    return 'HTML';
  }

  private metaTags(f: SeoFields): string {
    return [
      `<title>${this.escapeHtml(f.title)}</title>`,
      `<meta name="description" content="${this.escapeAttr(f.description)}">`,
      `<meta name="author" content="${this.escapeAttr(f.author)}">`,
      `<meta name="language" content="${this.escapeAttr(f.language)}">`,
      `<link rel="canonical" href="${this.escapeAttr(f.canonicalUrl)}">`,
    ].join('\n');
  }

  private robotsTxt(): string {
    const restricted = this.lines(this.restrictedDirectories()).map((path) => this.normalizeDirectory(path));
    const defaultBlock = [
      'User-agent: *',
      this.defaultRobotAction() === 'allowed' ? 'Allow: /' : 'Disallow: /',
      ...restricted.map((path) => `Disallow: ${path}`),
      `Crawl-delay: ${Math.round(this.crawlDelay())}`,
    ];
    const botBlocks = this.robotRules()
      .filter((rule) => rule.action !== 'default')
      .map((rule) => [
        `User-agent: ${rule.userAgent}`,
        rule.action === 'allowed' ? 'Allow: /' : 'Disallow: /',
        ...restricted.map((path) => `Disallow: ${path}`),
        `Crawl-delay: ${Math.round(this.crawlDelay())}`,
      ].join('\n'));
    return [
      defaultBlock.join('\n'),
      ...botBlocks,
      `Sitemap: ${this.sitemapUrl().trim()}`,
    ].join('\n\n');
  }

  private sitemapXml(f: SeoFields): string {
    const urls = this.lines(f.sitemapUrls);
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map((url) => `  <url>\n    <loc>${this.escapeHtml(url)}</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n  </url>`),
      '</urlset>',
    ].join('\n');
  }

  private openGraphTags(f: SeoFields): string {
    return [
      `<meta property="og:title" content="${this.escapeAttr(f.title)}">`,
      `<meta property="og:description" content="${this.escapeAttr(f.description)}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:url" content="${this.escapeAttr(f.canonicalUrl)}">`,
      `<meta property="og:image" content="${this.escapeAttr(f.imageUrl)}">`,
      `<meta property="og:site_name" content="${this.escapeAttr(f.organizationName)}">`,
    ].join('\n');
  }

  private twitterCardTags(f: SeoFields): string {
    return [
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:site" content="${this.escapeAttr(f.twitterHandle)}">`,
      `<meta name="twitter:title" content="${this.escapeAttr(f.title)}">`,
      `<meta name="twitter:description" content="${this.escapeAttr(f.description)}">`,
      `<meta name="twitter:image" content="${this.escapeAttr(f.imageUrl)}">`,
    ].join('\n');
  }

  private faqSchema(): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faqEntries().map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    };
  }

  private breadcrumbSchema(): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: this.breadcrumbEntries().map(({ name, url }, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name,
        item: url,
      })),
    };
  }

  private organizationSchema(f: SeoFields): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: f.organizationName,
      url: f.siteUrl,
      logo: f.logoUrl,
    };
  }

  private productSchema(f: SeoFields): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: f.productName,
      image: f.imageUrl,
      description: f.description,
      brand: { '@type': 'Brand', name: f.organizationName },
      offers: {
        '@type': 'Offer',
        price: f.price,
        priceCurrency: f.currency,
        availability: f.availability,
        url: f.canonicalUrl,
      },
    };
  }

  private articleSchema(f: SeoFields): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: f.articleHeadline,
      description: f.description,
      image: f.imageUrl,
      author: { '@type': 'Person', name: f.author },
      publisher: { '@type': 'Organization', name: f.organizationName, logo: { '@type': 'ImageObject', url: f.logoUrl } },
      datePublished: f.publishedDate,
      dateModified: f.publishedDate,
      mainEntityOfPage: f.canonicalUrl,
    };
  }

  private genericJsonLd(f: SeoFields): object {
    return {
      '@context': 'https://schema.org',
      '@type': f.jsonLdType,
      name: f.title,
      description: f.description,
      url: f.canonicalUrl,
      image: f.imageUrl,
    };
  }

  private hreflangTags(): string {
    return this.hreflangEntries()
      .map(({ language, url }) => `<link rel="alternate" hreflang="${this.escapeAttr(language)}" href="${this.escapeAttr(url)}">`)
      .join('\n');
  }

  private scriptJson(value: object): string {
    return `<script type="application/ld+json">\n${JSON.stringify(value, null, 2)}\n</script>`;
  }

  private lines(value: string): string[] {
    return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  private pairs(value: string): string[][] {
    return this.lines(value).map((line) => {
      const [first = '', ...rest] = line.split('|');
      return [first.trim(), rest.join('|').trim()];
    }).filter(([first, second]) => first && second);
  }

  private cleanUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }

  private isValidUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private isValidUrlWithOptionalProtocol(value: string): boolean {
    const target = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return this.isValidUrl(target);
  }

  private normalizeDirectory(path: string): string {
    const trimmed = path.trim();
    if (!trimmed) return '/';
    const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escapeAttr(value: string): string {
    return this.escapeHtml(value).replace(/"/g, '&quot;');
  }

  private downloadExtension(): string {
    if (this.kind === 'robots-txt-generator') return 'txt';
    if (this.kind === 'sitemap-generator') return 'xml';
    return this.outputType() === 'JSON-LD' ? 'html' : 'html';
  }

  private downloadMime(): string {
    if (this.kind === 'robots-txt-generator') return 'text/plain;charset=utf-8';
    if (this.kind === 'sitemap-generator') return 'application/xml;charset=utf-8';
    return 'text/html;charset=utf-8';
  }

  private outputBlob(format: 'txt' | 'csv' | 'json' | 'html' | 'pdf'): Blob {
    const output = this.output();
    if (format === 'json') {
      return new Blob([JSON.stringify({ tool: this.catalogItem().label, output, rows: this.rows() }, null, 2)], { type: 'application/json;charset=utf-8' });
    }
    if (format === 'csv') {
      return new Blob([['field,value', ...this.rows().map((row) => `${this.csv(row.label)},${this.csv(row.value)}`), `output,${this.csv(output)}`].join('\n')], { type: 'text/csv;charset=utf-8' });
    }
    if (format === 'html') {
      const content = this.outputType() === 'HTML' ? output : `<pre>${this.escapeHtml(output)}</pre>`;
      return new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>${this.escapeHtml(this.catalogItem().label)}</title></head><body><h1>${this.escapeHtml(this.catalogItem().label)}</h1>${content}</body></html>`], { type: 'text/html;charset=utf-8' });
    }
    if (format === 'pdf') return new Blob([this.blobPart(this.exportPdf.text(this.catalogItem().label, output, this.rows()))], { type: 'application/pdf' });
    return new Blob([output], { type: 'text/plain;charset=utf-8' });
  }

  private csv(value: string): string {
    return `"${String(value).replace(/"/g, '""')}"`;
  }

  private blobPart(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }
}
