import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, PLATFORM_ID, ViewChild, computed, inject, signal } from '@angular/core';
import { NgClass, NgStyle, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { Subscription } from 'rxjs';
import * as QRCode from 'qrcode';
import { TOOL_CATEGORIES, ToolCatalogItem, findToolBySlug } from '../../core/content/tool-catalog';
import { findCategoryForTool, generateToolSeo } from '../../core/content/generated-tool-seo';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { ExportPdfService } from '../../core/services/export-pdf.service';
import { ImageShareResponse, ImageShareService } from '../../core/services/image-share.service';
import { PageLoaderService } from '../../core/services/page-loader.service';
import { QrCodeCardComponent } from '../../shared/components/qr-code-card/qr-code-card.component';
import { UploadZoneComponent } from '../../shared/components/upload-zone/upload-zone.component';
import { ToolSeoBlockComponent } from '../../shared/components/tool-seo-block/tool-seo-block.component';
import { environment } from '../../../environments/environment';

interface ResultRow { label: string; value: string; }
type QrType = 'website' | 'business-card' | 'text' | 'wifi' | 'pdf' | 'app-store';
interface ShadowLayer { x: number; y: number; spread: number; blur: number; opacity: number; color: string; inset: boolean; }
type RadiusCorner = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';
type BorderPosition = 'all' | 'top' | 'right' | 'bottom' | 'left';
interface ClipPoint { x: number; y: number; color: string; }
interface ClipPreset { name: string; kind: 'polygon' | 'circle' | 'ellipse'; points?: ClipPoint[]; value?: string; color: string; }
type ClipDragTarget = number | 'circle-radius' | 'circle-center' | 'ellipse-radius' | 'ellipse-center';
type DownloadTextFormat = 'pdf' | 'txt' | 'csv' | 'json' | 'html';
interface GisPoint { lat: number; lng: number; x: number; y: number; label: string; }
interface KmlCircleOptions { name: string; strokeColor: string; fillColor: string; opacity: number; }
type KmlBuilderShape = 'circle' | 'polygon';
type KmlRadiusUnit = 'foot' | 'kilometer' | 'meter' | 'mile' | 'nautical_mile' | 'yard';
type PdfDocumentLoader = {
  load(input: ArrayBuffer, options?: { ignoreEncryption?: boolean }): Promise<import('pdf-lib').PDFDocument>;
};

const DEV_OUTPUT_ONLY = new Set(['uuid-generator', 'random-name-generator', 'random-color-generator']);
const CALC_OUTPUT_ONLY = new Set<string>();
const FIELD_CATEGORIES = new Set(['Calculator Tools', 'Generator Tools', 'Color Tools', 'Date & Time Tools']);
const PDF_REPAIR_ERROR_PATTERN = /PDFDict|PDFDocument|PDFPage|invalid object|object ref|encrypted|password|protected|damaged|xref|cross-reference|Failed to parse|parse invalid|Invalid PDF|InvalidPDF|FormatError|PasswordException|MissingPDFException|UnknownErrorException|No PDF header|bad XRef|Invalid XRef|Expected instance|trailer|startxref|endobj|badly formed|corrupt|image rendering failed|Unable to decode image|Jbig2Error|JBIG2|Dependent image/i;
const PDF_DOWNLOAD_TOOLS = new Set([
  'json-formatter',
  'xml-formatter',
  'html-formatter',
  'css-formatter',
  'javascript-formatter',
  'sql-formatter',
  'jwt-decoder',
  'barcode-generator',
  'lorem-ipsum-generator',
]);

@Component({
  selector: 'app-utility-tool',
  standalone: true,
  imports: [NgClass, NgStyle, ReactiveFormsModule, QrCodeCardComponent, UploadZoneComponent, ToolSeoBlockComponent],
  templateUrl: './utility-tool.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UtilityToolComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gisGoogleMap') private gisGoogleMap?: ElementRef<HTMLElement>;
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly exportPdf = inject(ExportPdfService);
  private readonly imageShare = inject(ImageShareService);
  private readonly loader = inject(PageLoaderService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly subscriptions = new Subscription();
  private clipBlinkTimer: number | null = null;
  private googleMapsPromise?: Promise<void>;
  private gisMap?: google.maps.Map;
  private gisOverlays: Array<google.maps.Circle | google.maps.Polygon | google.maps.Polyline> = [];

  readonly slug = this.route.snapshot.data['slug'] as string;
  readonly category = findCategoryForTool(this.slug) ?? TOOL_CATEGORIES[0];
  readonly catalogItem = signal<ToolCatalogItem>(findToolBySlug(this.slug) ?? {
    label: 'Tool',
    slug: this.slug,
    route: `/${this.slug}`,
    description: 'Free online utility.',
  });

  readonly input = signal(this.defaultInput());
  readonly second = signal('');
  readonly third = signal('');
  readonly output = signal('');
  readonly rows = signal<ResultRow[]>([]);
  readonly error = signal<string | null>(null);
  readonly mode = signal('length');
  readonly qrType = signal<QrType>('website');
  readonly kmlCircleForm = this.formBuilder.group({
    shape: [this.slug === 'kml-polygon-generator' ? 'polygon' : 'circle' as KmlBuilderShape, [Validators.required]],
    name: ['FlexImagePro Circle', [Validators.required]],
    latitude: [40.7128, [Validators.required, Validators.min(-90), Validators.max(90)]],
    longitude: [-74.0060, [Validators.required, Validators.min(-180), Validators.max(180)]],
    radius: [1000, [Validators.required, Validators.min(1)]],
    radiusUnit: ['meter' as KmlRadiusUnit, [Validators.required]],
    includeCenter: [true],
    polygonCoordinates: ['40.7128, -74.0060\n40.7228, -73.9960\n40.7028, -73.9860'],
    strokeColor: ['#0f766e', [Validators.required]],
    fillColor: ['#14b8a6', [Validators.required]],
    opacity: [40, [Validators.required, Validators.min(0), Validators.max(100)]],
  });
  readonly qrFields = signal<Record<string, string>>({
    website: 'https://fleximagepro.com',
    text: 'FlexImagePro',
    fullName: 'Alex Morgan',
    phone: '+10000000000',
    email: 'hello@fleximagepro.com',
    company: 'FlexImagePro',
    title: 'Founder',
    workPhone: '+10000000001',
    fax: '',
    street: '',
    city: '',
    state: '',
    country: '',
    zip: '',
    ssid: 'My WiFi',
    password: 'password123',
    security: 'WPA',
    pdf: 'https://fleximagepro.com/sample.pdf',
    app: 'https://apps.apple.com/',
    foreground: '#111827',
    background: '#ffffff',
    frame: 'none',
    shape: 'square',
    logo: 'FP',
    logoStyle: 'corner-break',
  });
  readonly qrPreview = signal('');
  readonly qrJpgPreview = signal('');
  readonly barcodePreview = signal('');
  readonly barcodeJpgPreview = signal('');
  readonly pdfFiles = signal<File[]>([]);
  readonly acceptedPdfTypes = ['application/pdf', '.pdf'];
  readonly pdfPageInput = signal('');
  readonly pdfOrderInput = signal('1,2,3');
  readonly pdfAngle = signal(90);
  readonly pdfOutputUrl = signal('');
  readonly pdfOutputName = signal('');
  readonly isPdfPreviewModalOpen = signal(false);
  readonly isProcessingPdf = signal(false);
  readonly isRepairingPdf = signal(false);
  readonly isGeneratingPdfShareLink = signal(false);
  readonly pdfShareBatch = signal<ImageShareResponse | null>(null);
  readonly isPdfShareModalOpen = signal(false);
  readonly gisInput = signal('');
  readonly gisSecondInput = signal('');
  readonly gisOutput = signal('');
  readonly gisRadiusUnit = signal<KmlRadiusUnit>('meter');
  readonly gisStrokeColor = signal('#0f766e');
  readonly gisFillColor = signal('#14b8a6');
  readonly gisOpacity = signal(35);
  readonly shadowLayers = signal<ShadowLayer[]>([{ x: 5, y: 5, spread: 0, blur: 15, opacity: 45, color: '#000000', inset: false }]);
  readonly activeShadowLayer = signal(0);
  readonly shadowObjectColor = signal('#0f766e');
  readonly shadowBackgroundColor = signal('#f3f4f6');
  readonly shadowHtml = signal('<div class="box-demo">Live preview</div>');
  readonly shadowCss = signal('.box-demo {\n  width: 220px;\n  height: 160px;\n  display: grid;\n  place-items: center;\n  color: #ffffff;\n  background: #0f766e;\n  border-radius: 10px;\n}');
  readonly shadowAppliedCss = signal('');
  readonly gradientColors = signal(['#0f766e', '#14b8a6', '#f59e0b']);
  readonly gradientAngle = signal('135deg');
  readonly radiusCorners = signal<Record<RadiusCorner, { value: number; enabled: boolean }>>({
    topLeft: { value: 24, enabled: true },
    topRight: { value: 24, enabled: true },
    bottomRight: { value: 24, enabled: true },
    bottomLeft: { value: 24, enabled: true },
  });
  readonly radiusAllSame = signal(true);
  readonly borderWidth = signal(5);
  readonly borderStyle = signal('solid');
  readonly borderColor = signal('#0f766e');
  readonly borderOpacity = signal(100);
  readonly borderPosition = signal<BorderPosition>('all');
  readonly borderOneLine = signal(false);
  readonly borderHtml = signal('<div id="borderDemo">Editable text</div>');
  readonly borderCss = signal('#borderDemo {\n  width: 240px;\n  min-height: 160px;\n  display: grid;\n  place-items: center;\n  padding: 24px;\n  color: #0f172a;\n  background: #f8fafc;\n}');
  readonly clipPresetName = signal('Hexagon');
  readonly clipKind = signal<'polygon' | 'circle' | 'ellipse'>('polygon');
  readonly clipPoints = signal<ClipPoint[]>([
    { x: 25, y: 5, color: '#ef4444' },
    { x: 75, y: 5, color: '#f59e0b' },
    { x: 100, y: 50, color: '#22c55e' },
    { x: 75, y: 95, color: '#06b6d4' },
    { x: 25, y: 95, color: '#8b5cf6' },
    { x: 0, y: 50, color: '#ec4899' },
  ]);
  readonly clipCircle = signal({ radius: 50, centerX: 50, centerY: 50 });
  readonly clipEllipse = signal({ radiusX: 50, radiusY: 35, centerX: 50, centerY: 50 });
  readonly clipWidth = signal(280);
  readonly clipHeight = signal(280);
  readonly clipBackground = signal('linear-gradient(135deg, #0f766e, #14b8a6)');
  readonly clipCustomUrl = signal('');
  readonly clipShowOutside = signal(false);
  readonly clipDragging = signal<ClipDragTarget | null>(null);
  readonly clipBlinkKey = signal('');
  readonly clipBlinkColor = signal('#22c55e');
  readonly clipBlinkNonce = signal(0);
  readonly shadowValue = computed(() => this.shadowLayers().map((layer) => this.shadowLayerValue(layer)).join(', '));
  readonly shadowCssBlock = computed(() => `-webkit-box-shadow: ${this.shadowValue()};\nbox-shadow: ${this.shadowValue()};`);
  readonly shadowPreviewStyle = computed(() => ({
    'box-shadow': this.shadowValue(),
    '-webkit-box-shadow': this.shadowValue(),
    background: this.shadowObjectColor(),
  }));
  readonly shadowEditorDoc = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(`<!doctype html><html><head><style>body{min-height:100vh;margin:0;padding:24px;display:grid;place-items:center;background:${this.shadowBackgroundColor()};font-family:Inter,Arial,sans-serif}${this.shadowCss()}\n${this.shadowAppliedCss()}</style></head><body>${this.shadowHtml()}</body></html>`));
  readonly gradientCssBlock = computed(() => `background: linear-gradient(${this.gradientAngle()}, ${this.gradientColors().join(', ')});`);
  readonly radiusValue = computed(() => {
    const c = this.radiusCorners();
    return `${c.topLeft.enabled ? c.topLeft.value : 0}px ${c.topRight.enabled ? c.topRight.value : 0}px ${c.bottomRight.enabled ? c.bottomRight.value : 0}px ${c.bottomLeft.enabled ? c.bottomLeft.value : 0}px`;
  });
  readonly radiusCssBlock = computed(() => `-webkit-border-radius: ${this.radiusValue()};\n-moz-border-radius: ${this.radiusValue()};\nborder-radius: ${this.radiusValue()};`);
  readonly borderCssOutput = computed(() => {
    const side = this.borderPosition() === 'all' ? 'border' : `border-${this.borderPosition()}`;
    const color = this.hexToRgba(this.borderColor(), this.borderOpacity());
    const line = `${side}: ${this.borderWidth()}px ${this.borderStyle()} ${color};`;
    const radius = `border-radius: ${this.radiusValue()};`;
    return this.borderOneLine() ? `${line} ${radius}` : `${line}\n-webkit-border-radius: ${this.radiusValue()};\n-moz-border-radius: ${this.radiusValue()};\n${radius}`;
  });
  readonly radiusPreviewStyle = computed(() => ({
    'border-radius': this.radiusValue(),
    ...this.borderStyleObject(),
  }));
  readonly radiusEditorDoc = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(`<!doctype html><html><head><style>body{min-height:100vh;margin:0;padding:24px;display:grid;place-items:center;background:#f8fafc;font-family:Inter,Arial,sans-serif}${this.borderCss()}\n#borderDemo{${this.borderCssOutput()}}</style></head><body>${this.borderHtml()}</body></html>`));
  readonly pdfPreviewUrl = computed<SafeResourceUrl | null>(() => this.pdfOutputUrl() ? this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfOutputUrl()) : null);
  readonly clipCssValue = computed(() => {
    if (this.clipKind() === 'circle') {
      const circle = this.clipCircle();
      return `circle(${circle.radius.toFixed(1)}% at ${circle.centerX.toFixed(0)}% ${circle.centerY.toFixed(0)}%)`;
    }
    if (this.clipKind() === 'ellipse') {
      const ellipse = this.clipEllipse();
      return `ellipse(${ellipse.radiusX.toFixed(1)}% ${ellipse.radiusY.toFixed(1)}% at ${ellipse.centerX.toFixed(0)}% ${ellipse.centerY.toFixed(0)}%)`;
    }
    return `polygon(${this.clipPoints().map((point) => `${point.x.toFixed(0)}% ${point.y.toFixed(0)}%`).join(', ')})`;
  });
  readonly clipCssBlock = computed(() => `clip-path: ${this.clipCssValue()};`);
  readonly clipPreviewStyle = computed(() => ({
    width: `${this.clipWidth()}px`,
    height: `${this.clipHeight()}px`,
    'clip-path': this.clipCssValue(),
    background: this.clipBackgroundStyle(),
  }));
  readonly clipOutsideStyle = computed(() => ({
    width: `${this.clipWidth()}px`,
    height: `${this.clipHeight()}px`,
    background: this.clipBackgroundStyle(),
  }));
  readonly clipPresets: ClipPreset[] = [
    { name: 'Triangle', color: '#ef4444', kind: 'polygon', points: this.points([[50, 0], [100, 100], [0, 100]]) },
    { name: 'Trapezoid', color: '#f97316', kind: 'polygon', points: this.points([[20, 0], [80, 0], [100, 100], [0, 100]]) },
    { name: 'Parallelogram', color: '#f59e0b', kind: 'polygon', points: this.points([[25, 0], [100, 0], [75, 100], [0, 100]]) },
    { name: 'Rhombus', color: '#eab308', kind: 'polygon', points: this.points([[50, 0], [100, 50], [50, 100], [0, 50]]) },
    { name: 'Pentagon', color: '#84cc16', kind: 'polygon', points: this.points([[50, 0], [100, 38], [82, 100], [18, 100], [0, 38]]) },
    { name: 'Hexagon', color: '#22c55e', kind: 'polygon', points: this.points([[25, 5], [75, 5], [100, 50], [75, 95], [25, 95], [0, 50]]) },
    { name: 'Heptagon', color: '#10b981', kind: 'polygon', points: this.points([[50, 0], [90, 20], [100, 60], [75, 100], [25, 100], [0, 60], [10, 20]]) },
    { name: 'Octagon', color: '#14b8a6', kind: 'polygon', points: this.points([[30, 0], [70, 0], [100, 30], [100, 70], [70, 100], [30, 100], [0, 70], [0, 30]]) },
    { name: 'Nonagon', color: '#06b6d4', kind: 'polygon', points: this.points([[50, 0], [82, 12], [100, 42], [94, 75], [68, 100], [32, 100], [6, 75], [0, 42], [18, 12]]) },
    { name: 'Decagon', color: '#0ea5e9', kind: 'polygon', points: this.points([[50, 0], [80, 10], [100, 35], [100, 65], [80, 90], [50, 100], [20, 90], [0, 65], [0, 35], [20, 10]]) },
    { name: 'Bevel', color: '#3b82f6', kind: 'polygon', points: this.points([[20, 0], [80, 0], [100, 20], [100, 80], [80, 100], [20, 100], [0, 80], [0, 20]]) },
    { name: 'Rabbet', color: '#6366f1', kind: 'polygon', points: this.points([[0, 15], [15, 15], [15, 0], [85, 0], [85, 15], [100, 15], [100, 85], [85, 85], [85, 100], [15, 100], [15, 85], [0, 85]]) },
    { name: 'Left arrow', color: '#8b5cf6', kind: 'polygon', points: this.points([[40, 0], [40, 25], [100, 25], [100, 75], [40, 75], [40, 100], [0, 50]]) },
    { name: 'Right arrow', color: '#a855f7', kind: 'polygon', points: this.points([[0, 25], [60, 25], [60, 0], [100, 50], [60, 100], [60, 75], [0, 75]]) },
    { name: 'Left Point', color: '#d946ef', kind: 'polygon', points: this.points([[25, 0], [100, 0], [100, 100], [25, 100], [0, 50]]) },
    { name: 'Right Point', color: '#ec4899', kind: 'polygon', points: this.points([[0, 0], [75, 0], [100, 50], [75, 100], [0, 100]]) },
    { name: 'Left Chevron', color: '#f43f5e', kind: 'polygon', points: this.points([[100, 0], [70, 50], [100, 100], [70, 100], [40, 50], [70, 0]]) },
    { name: 'Right Chevron', color: '#fb7185', kind: 'polygon', points: this.points([[0, 0], [30, 0], [60, 50], [30, 100], [0, 100], [30, 50]]) },
    { name: 'Star', color: '#f59e0b', kind: 'polygon', points: this.points([[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]]) },
    { name: 'Cross', color: '#64748b', kind: 'polygon', points: this.points([[35, 0], [65, 0], [65, 35], [100, 35], [100, 65], [65, 65], [65, 100], [35, 100], [35, 65], [0, 65], [0, 35], [35, 35]]) },
    { name: 'Message', color: '#0f766e', kind: 'polygon', points: this.points([[0, 0], [100, 0], [100, 75], [65, 75], [50, 100], [45, 75], [0, 75]]) },
    { name: 'Close', color: '#dc2626', kind: 'polygon', points: this.points([[20, 0], [50, 30], [80, 0], [100, 20], [70, 50], [100, 80], [80, 100], [50, 70], [20, 100], [0, 80], [30, 50], [0, 20]]) },
    { name: 'Frame', color: '#0891b2', kind: 'polygon', points: this.points([[0, 0], [100, 0], [100, 100], [0, 100], [0, 0], [15, 15], [15, 85], [85, 85], [85, 15], [15, 15]]) },
    { name: 'Inset', color: '#0d9488', kind: 'polygon', points: this.points([[10, 10], [90, 10], [90, 90], [10, 90]]) },
    { name: 'Custom Polygon', color: '#475569', kind: 'polygon', points: this.points([[20, 20], [80, 20], [90, 70], [55, 95], [10, 75]]) },
    { name: 'Circle', color: '#22c55e', kind: 'circle', value: 'circle(50% at 50% 50%)' },
    { name: 'Ellipse', color: '#14b8a6', kind: 'ellipse', value: 'ellipse(50% 35% at 50% 50%)' },
  ];
  readonly hasInput = computed(() => !DEV_OUTPUT_ONLY.has(this.slug) && !CALC_OUTPUT_ONLY.has(this.slug));
  readonly usesFields = computed(() => FIELD_CATEGORIES.has(this.category.title));
  readonly showSecondField = computed(() => !['age-calculator', 'scientific-calculator', 'password-generator', 'lorem-ipsum-generator', 'random-name-generator', 'random-color-generator', 'css-border-radius-generator', 'css-clip-path-generator', 'hex-to-rgb', 'hex-to-hsl', 'color-palette-generator', 'color-picker', 'timestamp-converter', 'unix-timestamp-converter', 'countdown-timer'].includes(this.slug));
  readonly showThirdField = computed(() => ['emi-calculator', 'binary-calculator', 'css-gradient-generator', 'gradient-generator', 'contrast-checker', 'time-zone-converter'].includes(this.slug));
  readonly showPdfDownload = computed(() => PDF_DOWNLOAD_TOOLS.has(this.slug));
  readonly showOutputText = computed(() => !['qr-code-generator', 'barcode-generator'].includes(this.slug));
  readonly showMainActionBar = computed(() => !['PDF Tools', 'GIS / Map Tools'].includes(this.category.title));
  readonly heroDescription = computed(() => `${this.catalogItem().description} Use this page to enter clean values, generate an accurate result, copy it quickly, and download the output in practical formats when you need to save or share the result later.`);

  ngOnInit(): void {
    const content = generateToolSeo(this.catalogItem(), this.category);
    this.seo.update(content.title, content.metaDescription);
    this.seo.updateFaqSchema(content.faqs);
    this.seo.updateBreadcrumbSchema(content.breadcrumb);
    if (DEV_OUTPUT_ONLY.has(this.slug)) void this.process();
    if (this.category.title === 'GIS / Map Tools') {
      this.subscriptions.add(this.kmlCircleForm.valueChanges.subscribe(() => {
        this.syncKmlCircleInputs();
        this.scheduleGisMapUpdate();
      }));
    }
  }

  ngAfterViewInit(): void {
    if (this.category.title === 'GIS / Map Tools') this.scheduleGisMapUpdate();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.clearGisOverlays();
    this.gisMap = undefined;
  }

  updateInput(event: Event): void { this.input.set((event.target as HTMLTextAreaElement | HTMLInputElement).value); }
  updateSecond(event: Event): void { this.second.set((event.target as HTMLInputElement | HTMLSelectElement).value); }
  updateThird(event: Event): void { this.third.set((event.target as HTMLInputElement).value); }
  updateQrType(event: Event): void { this.qrType.set((event.target as HTMLSelectElement).value as QrType); }
  updateQrField(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
    this.qrFields.update((fields) => ({ ...fields, [key]: value }));
  }
  updatePdfFiles(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files || []);
    this.setPdfFiles(files);
  }
  addPdfFiles(files: File[]): void {
    this.setPdfFiles(this.pdfAcceptsMultiple() ? [...this.pdfFiles(), ...files] : files.slice(0, 1));
  }
  private setPdfFiles(files: File[]): void {
    this.pdfFiles.set(this.pdfAcceptsMultiple() ? files : files.slice(0, 1));
    this.pdfOutputUrl.set('');
    this.pdfOutputName.set('');
    this.output.set('');
    this.rows.set([]);
    this.pdfShareBatch.set(null);
    this.isPdfPreviewModalOpen.set(false);
    this.isPdfShareModalOpen.set(false);
  }
  updatePdfPageInput(event: Event): void { this.pdfPageInput.set((event.target as HTMLInputElement).value); }
  updatePdfOrderInput(event: Event): void { this.pdfOrderInput.set((event.target as HTMLInputElement).value); }
  updatePdfAngle(event: Event): void { this.pdfAngle.set(Number((event.target as HTMLSelectElement).value)); }
  updateGisInput(event: Event): void {
    this.gisInput.set((event.target as HTMLTextAreaElement | HTMLInputElement).value);
    this.scheduleGisMapUpdate();
  }
  updateGisSecondInput(event: Event): void {
    this.gisSecondInput.set((event.target as HTMLTextAreaElement | HTMLInputElement).value);
    this.scheduleGisMapUpdate();
  }
  updateGisRadiusUnit(event: Event): void {
    this.gisRadiusUnit.set((event.target as HTMLSelectElement).value as KmlRadiusUnit);
    this.scheduleGisMapUpdate();
  }
  updateGisStrokeColor(event: Event): void {
    this.gisStrokeColor.set((event.target as HTMLInputElement).value);
    this.scheduleGisMapUpdate();
  }
  updateGisFillColor(event: Event): void {
    this.gisFillColor.set((event.target as HTMLInputElement).value);
    this.scheduleGisMapUpdate();
  }
  updateGisOpacity(event: Event): void {
    this.gisOpacity.set(Number((event.target as HTMLInputElement).value));
    this.scheduleGisMapUpdate();
  }
  updateShadowLayer(key: keyof ShadowLayer, event: Event): void {
    const target = event.target as HTMLInputElement;
    const rawValue = target.type === 'checkbox' ? target.checked : target.value;
    this.shadowLayers.update((layers) => layers.map((layer, index) => index === this.activeShadowLayer() ? { ...layer, [key]: key === 'color' ? String(rawValue) : key === 'inset' ? Boolean(rawValue) : Number(rawValue) } : layer));
  }
  updateActiveShadowLayer(event: Event): void { this.activeShadowLayer.set(Number((event.target as HTMLSelectElement).value)); }
  updateShadowObjectColor(event: Event): void { this.shadowObjectColor.set((event.target as HTMLInputElement).value); }
  updateShadowBackgroundColor(event: Event): void { this.shadowBackgroundColor.set((event.target as HTMLInputElement).value); }
  updateShadowHtml(event: Event): void { this.shadowHtml.set((event.target as HTMLTextAreaElement).value); }
  updateShadowCss(event: Event): void { this.shadowCss.set((event.target as HTMLTextAreaElement).value); }
  updateGradientAngle(event: Event): void { this.gradientAngle.set((event.target as HTMLInputElement).value || '135deg'); }
  updateGradientColor(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.gradientColors.update((colors) => colors.map((color, colorIndex) => colorIndex === index ? value : color));
  }
  addGradientColor(): void { this.gradientColors.update((colors) => [...colors, '#0f766e']); }
  removeGradientColor(index: number): void { if (this.gradientColors().length > 2) this.gradientColors.update((colors) => colors.filter((_, colorIndex) => colorIndex !== index)); }
  updateRadiusCorner(corner: RadiusCorner, key: 'value' | 'enabled', event: Event): void {
    const target = event.target as HTMLInputElement;
    const next = key === 'enabled' ? target.checked : Number(target.value);
    this.radiusCorners.update((corners) => {
      if (this.radiusAllSame() && key === 'value') {
        return {
          topLeft: { ...corners.topLeft, value: Number(next) },
          topRight: { ...corners.topRight, value: Number(next) },
          bottomRight: { ...corners.bottomRight, value: Number(next) },
          bottomLeft: { ...corners.bottomLeft, value: Number(next) },
        };
      }
      return { ...corners, [corner]: { ...corners[corner], [key]: next } };
    });
  }
  updateRadiusAllSame(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.radiusAllSame.set(checked);
    if (checked) {
      const value = this.radiusCorners().topLeft.value;
      this.radiusCorners.update((corners) => ({
        topLeft: { ...corners.topLeft, value },
        topRight: { ...corners.topRight, value },
        bottomRight: { ...corners.bottomRight, value },
        bottomLeft: { ...corners.bottomLeft, value },
      }));
    }
  }
  updateBorderWidth(event: Event): void { this.borderWidth.set(Number((event.target as HTMLInputElement).value)); }
  updateBorderStyle(style: string): void { this.borderStyle.set(style); }
  updateBorderColor(event: Event): void { this.borderColor.set((event.target as HTMLInputElement).value); }
  updateBorderOpacity(event: Event): void { this.borderOpacity.set(Number((event.target as HTMLInputElement).value)); }
  updateBorderPosition(position: BorderPosition): void { this.borderPosition.set(position); }
  updateBorderOneLine(event: Event): void { this.borderOneLine.set((event.target as HTMLInputElement).checked); }
  updateBorderHtml(event: Event): void { this.borderHtml.set((event.target as HTMLTextAreaElement).value); }
  updateBorderCss(event: Event): void { this.borderCss.set((event.target as HTMLTextAreaElement).value); }
  async copyRadiusCss(): Promise<void> { await navigator.clipboard.writeText(this.radiusCssBlock()); this.toast.success('Border radius copied.'); }
  async copyBorderCss(): Promise<void> { await navigator.clipboard.writeText(this.borderCssOutput()); this.toast.success('CSS copied.'); }
  applyBorderCss(): void {
    this.borderCss.update((css) => `${css.replace(/#borderDemo\s*\{[\s\S]*?\}/, '').trim()}\n#borderDemo {\n  ${this.borderCssOutput().replace(/\n/g, '\n  ')}\n}`.trim());
    this.toast.success('CSS applied to preview.');
  }
  applyClipPreset(preset: ClipPreset): void {
    this.clipPresetName.set(preset.name);
    this.clipKind.set(preset.kind);
    if (preset.kind === 'circle') this.clipCircle.set({ radius: 50, centerX: 50, centerY: 50 });
    if (preset.kind === 'ellipse') this.clipEllipse.set({ radiusX: 50, radiusY: 35, centerX: 50, centerY: 50 });
    if (preset.points) this.clipPoints.set(preset.points.map((point) => ({ ...point })));
  }
  updateClipSize(key: 'width' | 'height', event: Event): void {
    const value = Math.max(80, Math.min(720, Number((event.target as HTMLInputElement).value) || 280));
    if (key === 'width') this.clipWidth.set(value);
    else this.clipHeight.set(value);
  }
  updateClipCustomUrl(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.clipCustomUrl.set(value);
    if (value.trim()) this.clipBackground.set(value.trim());
  }
  setClipBackground(value: string): void { this.clipBackground.set(value); this.clipCustomUrl.set(''); }
  updateClipShowOutside(event: Event): void { this.clipShowOutside.set((event.target as HTMLInputElement).checked); }
  startClipDrag(index: ClipDragTarget, event: PointerEvent): void {
    event.preventDefault();
    this.clipDragging.set(index);
    if (typeof index === 'number') this.triggerClipBlink(`point-${index}`, this.clipPoints()[index]?.color || '#22c55e');
    else if (index === 'circle-radius') this.triggerClipBlink('circle-radius', '#22c55e');
    else if (index === 'circle-center') this.triggerClipBlink('circle-center', '#f97316');
    else if (index === 'ellipse-radius') this.triggerClipBlink('ellipse-radius', '#22c55e');
    else this.triggerClipBlink('ellipse-center', '#f97316');
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  moveClipPoint(event: PointerEvent): void {
    const target = this.clipDragging();
    if (target === null) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    if (typeof target === 'number' && this.clipKind() === 'polygon') {
      this.clipPoints.update((points) => points.map((point, pointIndex) => pointIndex === target ? { ...point, x, y } : point));
      return;
    }
    if (target === 'circle-center') {
      this.clipCircle.update((circle) => {
        const maxRadius = Math.min(x, 100 - x, y, 100 - y, circle.radius);
        return { radius: Math.max(5, maxRadius), centerX: x, centerY: y };
      });
      return;
    }
    if (target === 'circle-radius') {
      this.clipCircle.update((circle) => ({ ...circle, radius: Math.max(5, Math.min(100 - circle.centerX, circle.centerX, circle.centerY, 100 - circle.centerY, Math.abs(x - circle.centerX))) }));
      return;
    }
    if (target === 'ellipse-center') {
      this.clipEllipse.update((ellipse) => ({
        radiusX: Math.max(5, Math.min(ellipse.radiusX, x, 100 - x)),
        radiusY: Math.max(5, Math.min(ellipse.radiusY, y, 100 - y)),
        centerX: x,
        centerY: y,
      }));
      return;
    }
    if (target === 'ellipse-radius') {
      this.clipEllipse.update((ellipse) => {
        const radiusX = Math.max(5, Math.min(ellipse.centerX, 100 - ellipse.centerX, Math.abs(x - ellipse.centerX)));
        return { ...ellipse, radiusX, radiusY: Math.max(5, Math.min(ellipse.centerY, 100 - ellipse.centerY, radiusX * 0.7)) };
      });
    }
  }
  stopClipDrag(): void { this.clipDragging.set(null); }
  addClipPoint(event: MouseEvent): void {
    if (this.clipPresetName() !== 'Custom Polygon' || this.clipKind() !== 'polygon' || this.clipDragging() !== null) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    const palette = ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899'];
    this.clipPoints.update((points) => [...points, { x, y, color: palette[points.length % palette.length] }]);
  }
  async copyClipCss(): Promise<void> {
    await navigator.clipboard.writeText(this.clipCssBlock());
    this.toast.success('Clip-path CSS copied.');
  }
  private triggerClipBlink(key: string, color: string): void {
    if (this.clipBlinkTimer !== null) window.clearTimeout(this.clipBlinkTimer);
    this.clipBlinkKey.set(key);
    this.clipBlinkColor.set(color);
    this.clipBlinkNonce.update((value) => value + 1);
    this.clipBlinkTimer = window.setTimeout(() => {
      this.clipBlinkKey.set('');
      this.clipBlinkTimer = null;
    }, 650);
  }
  clipValueBlinkClass(key: string): string {
    return this.clipBlinkKey() === key ? `value-blink blink-${this.clipBlinkNonce()}` : '';
  }
  clipValueBlinkStyle(key: string): Record<string, string> {
    return this.clipBlinkKey() === key ? { '--blink-bg': this.clipBlinkColor() } : {};
  }
  clipPresetRows(): ClipPreset[][] {
    const rows: ClipPreset[][] = [];
    for (let index = 0; index < this.clipPresets.length; index += 4) rows.push(this.clipPresets.slice(index, index + 4));
    return rows;
  }
  circleRadiusHandleLeft(): number {
    const circle = this.clipCircle();
    return Math.max(0, Math.min(100, circle.centerX + circle.radius));
  }
  ellipseRadiusHandleLeft(): number {
    const ellipse = this.clipEllipse();
    return Math.max(0, Math.min(100, ellipse.centerX + ellipse.radiusX));
  }
  clipValueBlinkKey(key: string): string {
    return `${key}-${this.clipBlinkNonce()}`;
  }
  clipPointBlinkKey(index: number): string {
    return `point-${index}`;
  }
  clipBackgroundStyle(): string {
    const bg = this.clipBackground();
    if (/^https?:\/\//i.test(bg)) return `url("${bg}") center / cover`;
    return bg;
  }
  presetClipStyle(preset: ClipPreset): string {
    if (preset.value) return preset.value;
    return `polygon(${(preset.points || []).map((point) => `${point.x}% ${point.y}%`).join(', ')})`;
  }
  shadowRangeFill(key: keyof ShadowLayer, min: number, max: number): string {
    const value = Number(this.shadowLayers()[this.activeShadowLayer()][key]);
    const percent = ((value - min) / (max - min)) * 100;
    return `linear-gradient(to right, #0f766e 0%, #0f766e ${percent}%, #d4d4d8 ${percent}%, #d4d4d8 100%)`;
  }
  percentFill(value: number, min: number, max: number): string {
    const percent = ((Number(value) - min) / (max - min)) * 100;
    return `linear-gradient(to right, #0f766e 0%, #0f766e ${percent}%, #d4d4d8 ${percent}%, #d4d4d8 100%)`;
  }
  rangeFillPercent(value: number, min: number, max: number): string {
    const percent = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
    return `${percent.toFixed(1)}%`;
  }
  radiusRangeFill(corner: RadiusCorner): string {
    return this.percentFill(this.radiusCorners()[corner].value, 0, 160);
  }
  addShadowLayer(): void {
    this.shadowLayers.update((layers) => [...layers, { x: 0, y: 10, spread: 0, blur: 24, opacity: 30, color: '#000000', inset: false }]);
    this.activeShadowLayer.set(this.shadowLayers().length - 1);
  }
  removeShadowLayer(): void {
    if (this.shadowLayers().length <= 1) return;
    const index = this.activeShadowLayer();
    this.shadowLayers.update((layers) => layers.filter((_, layerIndex) => layerIndex !== index));
    this.activeShadowLayer.set(Math.max(0, index - 1));
  }
  async copyShadowCss(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.shadowCssBlock());
      this.toast.success('CSS copied.');
    } catch {
      this.toast.error('Copy failed. Select and copy manually.');
    }
  }
  applyShadowCss(): void {
    const css = this.shadowCss();
    const shadowLines = `  -webkit-box-shadow: ${this.shadowValue()};\n  box-shadow: ${this.shadowValue()};`;
    const nextCss = css.includes('.box-demo')
      ? css.replace(/\.box-demo\s*\{([\s\S]*?)\}/, (match, body: string) => {
          const cleaned = String(body)
            .replace(/\s*-webkit-box-shadow\s*:[^;]+;/g, '')
            .replace(/\s*box-shadow\s*:[^;]+;/g, '')
            .trimEnd();
          return `.box-demo {\n${cleaned ? `${cleaned}\n` : ''}${shadowLines}\n}`;
        })
      : `${css.trim()}\n\n.box-demo {\n${shadowLines}\n}`;
    this.shadowCss.set(nextCss);
    this.shadowAppliedCss.set('');
    this.toast.success('CSS applied to preview.');
  }
  applyShadowPreset(name: string): void {
    const presets: Record<string, ShadowLayer[]> = {
      Hover: [{ x: 0, y: 18, spread: -8, blur: 38, opacity: 35, color: '#0f766e', inset: false }],
      Sides: [{ x: 16, y: 0, spread: -8, blur: 20, opacity: 35, color: '#000000', inset: false }, { x: -16, y: 0, spread: -8, blur: 20, opacity: 35, color: '#000000', inset: false }],
      Button: [{ x: 0, y: 8, spread: 0, blur: 0, opacity: 60, color: '#0f4f7c', inset: false }],
      Mirrors: [{ x: 18, y: 18, spread: 0, blur: 0, opacity: 28, color: '#0f766e', inset: false }, { x: -18, y: -18, spread: 0, blur: 0, opacity: 18, color: '#14b8a6', inset: false }],
      'In&Out': [{ x: 0, y: 16, spread: 0, blur: 28, opacity: 30, color: '#000000', inset: false }, { x: 0, y: 0, spread: 4, blur: 18, opacity: 25, color: '#ffffff', inset: true }],
      Gradient: [{ x: 20, y: 20, spread: -6, blur: 30, opacity: 55, color: '#ec4899', inset: false }, { x: -20, y: -18, spread: -6, blur: 30, opacity: 45, color: '#06b6d4', inset: false }],
      Pile: [{ x: 6, y: 6, spread: 0, blur: 0, opacity: 35, color: '#0f766e', inset: false }, { x: 12, y: 12, spread: 0, blur: 0, opacity: 25, color: '#0f766e', inset: false }, { x: 18, y: 18, spread: 0, blur: 0, opacity: 15, color: '#0f766e', inset: false }],
      Checker: [{ x: 10, y: 10, spread: 0, blur: 0, opacity: 42, color: '#111827', inset: false }, { x: -10, y: -10, spread: 0, blur: 0, opacity: 20, color: '#111827', inset: false }],
      Borders: [{ x: 0, y: 0, spread: 6, blur: 0, opacity: 80, color: '#0f766e', inset: false }],
      Rainbow: [{ x: 10, y: 10, spread: 0, blur: 0, opacity: 70, color: '#ef4444', inset: false }, { x: 20, y: 20, spread: 0, blur: 0, opacity: 70, color: '#f59e0b', inset: false }, { x: 30, y: 30, spread: 0, blur: 0, opacity: 70, color: '#10b981', inset: false }],
      Candy: [{ x: 12, y: 12, spread: 0, blur: 24, opacity: 55, color: '#f472b6', inset: false }],
      Flames: [{ x: 0, y: 18, spread: -4, blur: 30, opacity: 80, color: '#f97316', inset: false }, { x: 0, y: 30, spread: -8, blur: 45, opacity: 65, color: '#ef4444', inset: false }],
      Candle: [{ x: 0, y: 0, spread: 0, blur: 35, opacity: 70, color: '#f59e0b', inset: false }],
      Well: [{ x: 0, y: 10, spread: 0, blur: 20, opacity: 35, color: '#000000', inset: true }],
      Pyramid: [{ x: 7, y: 7, spread: 0, blur: 0, opacity: 45, color: '#0f766e', inset: false }, { x: 14, y: 14, spread: 0, blur: 0, opacity: 30, color: '#0f766e', inset: false }, { x: 21, y: 21, spread: 0, blur: 0, opacity: 18, color: '#0f766e', inset: false }],
      Target: [{ x: 0, y: 0, spread: 8, blur: 0, opacity: 85, color: '#ef4444', inset: false }, { x: 0, y: 0, spread: 18, blur: 0, opacity: 45, color: '#ffffff', inset: false }, { x: 0, y: 0, spread: 28, blur: 0, opacity: 70, color: '#0f766e', inset: false }],
    };
    this.shadowLayers.set(presets[name] ?? presets['Hover']);
    this.activeShadowLayer.set(0);
  }

  async process(allowPdfRepair = true): Promise<void> {
    this.error.set(null);
    try {
      if (this.category.title === 'Developer Tools') await this.processDeveloper();
      else if (this.category.title === 'Calculator Tools') this.processCalculator();
      else if (this.category.title === 'Generator Tools') await this.processGenerator();
      else if (this.category.title === 'PDF Tools') await this.processPdf();
      else if (this.category.title === 'GIS / Map Tools') await this.processGis();
      else if (this.category.title === 'Color Tools') this.processColor();
      else if (this.category.title === 'Date & Time Tools') this.processDateTime();
    } catch (error) {
      if (this.category.title === 'PDF Tools' && allowPdfRepair && this.shouldAttemptPdfRepair(error)) {
        const repaired = await this.repairSelectedPdfFiles(error);
        if (repaired) {
          await this.process(false);
          return;
        }
        this.output.set('');
        this.rows.set([]);
        this.error.set(null);
        return;
      }
      this.output.set('');
      this.rows.set([]);
      this.error.set(this.friendlyToolError(error));
    }
  }

  clear(): void {
    this.input.set('');
    this.second.set('');
    this.third.set('');
    this.output.set('');
    this.rows.set([]);
    this.qrPreview.set('');
    this.qrJpgPreview.set('');
    this.barcodePreview.set('');
    this.barcodeJpgPreview.set('');
    this.pdfFiles.set([]);
    this.pdfOutputUrl.set('');
    this.pdfOutputName.set('');
    this.pdfShareBatch.set(null);
    this.isPdfPreviewModalOpen.set(false);
    this.isPdfShareModalOpen.set(false);
    this.gisOutput.set('');
    this.gisRadiusUnit.set('meter');
    this.gisStrokeColor.set('#0f766e');
    this.gisFillColor.set('#14b8a6');
    this.gisOpacity.set(35);
    this.kmlCircleForm.reset({
      name: 'FlexImagePro Circle',
      latitude: 40.7128,
      longitude: -74.0060,
      radius: 1000,
      shape: this.slug === 'kml-polygon-generator' ? 'polygon' : 'circle',
      radiusUnit: 'meter',
      includeCenter: true,
      polygonCoordinates: '40.7128, -74.0060\n40.7228, -73.9960\n40.7028, -73.9860',
      strokeColor: '#0f766e',
      fillColor: '#14b8a6',
      opacity: 40,
    });
    this.scheduleGisMapUpdate();
    this.error.set(null);
  }

  async copyOutput(): Promise<void> {
    const text = this.slug === 'qr-code-generator' ? this.qrPayload() : this.output() || this.rows().map((row) => `${row.label}: ${row.value}`).join('\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success('Copied to clipboard.');
    } catch {
      this.toast.error('Copy failed. Select and copy manually.');
    }
  }

  downloadOutput(format: DownloadTextFormat): void {
    const text = this.output() || this.rows().map((row) => `${row.label}: ${row.value}`).join('\n');
    if (!text) return;
    const blob = this.outputBlob(text, format);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.slug}.${format}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  downloadGis(): void {
    const text = this.gisOutput() || this.output();
    if (!text) return;
    const extension = this.gisDownloadExtension();
    const type = extension === 'json' ? 'application/json;charset=utf-8' : extension === 'kml' ? 'application/vnd.google-earth.kml+xml;charset=utf-8' : 'text/plain;charset=utf-8';
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.slug}.${extension}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async downloadQr(format: 'jpg' | 'svg'): Promise<void> {
    if (!this.output()) await this.process();
    const isJpg = format === 'jpg';
    const source = isJpg ? this.qrJpgPreview() : this.output();
    if (!source) return;
    const anchor = document.createElement('a');
    anchor.download = `qr-code.${format}`;
    if (isJpg) {
      anchor.href = source;
    } else {
      anchor.href = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
      window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    }
    anchor.click();
  }

  async downloadBarcode(format: 'jpg' | 'png' | 'svg'): Promise<void> {
    if (!this.output()) await this.process();
    const source = format === 'svg' ? this.output() : format === 'jpg' ? this.barcodeJpgPreview() : this.barcodePreview();
    if (!source) return;
    const anchor = document.createElement('a');
    anchor.download = `barcode.${format}`;
    if (format === 'svg') {
      anchor.href = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
      window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    } else {
      anchor.href = source;
    }
    anchor.click();
  }

  async createPdfPreview(): Promise<void> {
    if (this.isRepairingPdf() || this.isProcessingPdf()) return;
    await this.process();
    if (this.pdfOutputUrl()) {
      if (this.pdfCreatesPdf()) this.isPdfPreviewModalOpen.set(true);
      this.toast.success(this.pdfCreatesZip() ? 'ZIP output is ready.' : this.pdfShowsMetadata() ? 'PDF metadata is ready.' : 'PDF preview is ready.');
    }
  }

  async downloadPdfOutput(): Promise<void> {
    if (this.isRepairingPdf() || this.isProcessingPdf()) return;
    if (!this.pdfOutputUrl()) await this.process();
    if (!this.pdfOutputUrl()) {
      this.toast.warning('Create the output first.');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = this.pdfOutputUrl();
    anchor.download = this.pdfOutputName() || `${this.slug}.pdf`;
    anchor.click();
  }

  async generatePdfShareLink(): Promise<void> {
    if (this.isGeneratingPdfShareLink() || this.isRepairingPdf() || this.isProcessingPdf()) return;
    if (!this.pdfCanShare()) {
      this.toast.warning('Share links are available for PDF outputs only.');
      return;
    }
    if (!this.pdfOutputUrl()) await this.process();
    if (!this.pdfOutputUrl()) {
      this.toast.warning('Create a PDF output first.');
      return;
    }
    this.isGeneratingPdfShareLink.set(true);
    try {
      const response = await fetch(this.pdfOutputUrl());
      const blob = await response.blob();
      const share = await this.imageShare.uploadBatch([{ blob, fileName: this.pdfOutputName() || `${this.slug}.pdf` }]);
      this.pdfShareBatch.set(share);
      this.isPdfShareModalOpen.set(true);
      this.toast.success('Share link is ready.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Share link failed.');
    } finally {
      this.isGeneratingPdfShareLink.set(false);
    }
  }

  closePdfShareModal(): void {
    this.isPdfShareModalOpen.set(false);
  }

  openPdfPreviewModal(): void {
    if (this.pdfOutputUrl() && this.pdfCreatesPdf()) this.isPdfPreviewModalOpen.set(true);
  }

  closePdfPreviewModal(): void {
    this.isPdfPreviewModalOpen.set(false);
  }

  removePdfFile(index: number): void {
    this.setPdfFiles(this.pdfFiles().filter((_, itemIndex) => itemIndex !== index));
  }

  movePdfFile(index: number, direction: -1 | 1): void {
    const files = [...this.pdfFiles()];
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= files.length) return;
    [files[index], files[nextIndex]] = [files[nextIndex], files[index]];
    this.setPdfFiles(files);
  }

  async copyPdfShareUrl(): Promise<void> {
    const shareUrl = this.pdfShareBatch()?.shareUrl;
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    this.toast.success('Share URL copied.');
  }

  downloadPdfQrCode(): void {
    const qr = this.pdfShareBatch()?.qrCodeDataUrl;
    if (!qr) return;
    const anchor = document.createElement('a');
    anchor.href = qr;
    anchor.download = `${this.slug}-share-qr.png`;
    anchor.click();
  }

  private async processDeveloper(): Promise<void> {
    const input = this.input();
    switch (this.slug) {
      case 'json-formatter':
        this.output.set(JSON.stringify(JSON.parse(input), null, 2));
        this.rows.set([{ label: 'Status', value: 'Valid JSON' }]);
        break;
      case 'json-validator':
        JSON.parse(input);
        this.output.set('Valid JSON');
        this.rows.set([{ label: 'Status', value: 'Valid JSON' }]);
        break;
      case 'xml-formatter':
        this.output.set(this.formatXml(input));
        this.rows.set([{ label: 'Status', value: this.validateXml(input) }]);
        break;
      case 'xml-validator':
        this.output.set(this.validateXml(input));
        this.rows.set([{ label: 'Status', value: this.output() }]);
        break;
      case 'html-formatter':
        this.output.set(this.formatMarkup(input));
        this.rows.set([{ label: 'Characters', value: String(this.output().length) }]);
        break;
      case 'css-formatter':
      case 'javascript-formatter':
      case 'sql-formatter':
        this.output.set(this.formatCode(input));
        this.rows.set([{ label: 'Characters', value: String(this.output().length) }]);
        break;
      case 'html-minifier':
      case 'css-minifier':
      case 'javascript-minifier':
        this.output.set(this.minify(input));
        this.rows.set([{ label: 'Saved characters', value: String(Math.max(0, input.length - this.output().length)) }]);
        break;
      case 'url-encode':
        this.output.set(encodeURIComponent(input));
        this.rows.set([{ label: 'Encoded length', value: String(this.output().length) }]);
        break;
      case 'url-decode':
        this.output.set(decodeURIComponent(input));
        this.rows.set([{ label: 'Decoded length', value: String(this.output().length) }]);
        break;
      case 'base64-encode':
        this.output.set(btoa(unescape(encodeURIComponent(input))));
        this.rows.set([{ label: 'Encoded length', value: String(this.output().length) }]);
        break;
      case 'base64-decode':
        this.output.set(decodeURIComponent(escape(atob(input.trim()))));
        this.rows.set([{ label: 'Decoded length', value: String(this.output().length) }]);
        break;
      case 'jwt-decoder':
        this.output.set(this.decodeJwt(input));
        break;
      case 'uuid-generator':
        this.output.set(crypto.randomUUID());
        this.rows.set([{ label: 'Version', value: 'UUID v4' }]);
        break;
      case 'md5-generator':
        this.output.set(this.md5(input));
        this.rows.set([{ label: 'Algorithm', value: 'MD5' }]);
        break;
      case 'sha1-generator':
      case 'sha256-generator':
      case 'sha512-generator':
        this.output.set(await this.sha(input, this.slug.replace('-generator', '').toUpperCase()));
        this.rows.set([{ label: 'Algorithm', value: this.slug.replace('-generator', '').toUpperCase() }]);
        break;
    }
  }

  private processCalculator(): void {
    const a = Number(this.input());
    const b = Number(this.second());
    const c = Number(this.third());
    const today = new Date();
    switch (this.slug) {
      case 'age-calculator': {
        const dob = this.localDate(this.input());
        if (Number.isNaN(dob.getTime())) throw new Error('Select a valid date of birth.');
        if (dob > today) throw new Error('Date of birth cannot be in the future.');
        const age = this.ageDetails(dob, today);
        this.rows.set([
          { label: 'Exact age', value: `${age.years} years, ${age.months} months, ${age.days} days` },
          { label: 'Total months', value: age.totalMonths.toLocaleString() },
          { label: 'Total weeks', value: age.totalWeeks.toLocaleString() },
          { label: 'Total days', value: age.totalDays.toLocaleString() },
          { label: 'Total hours', value: age.totalHours.toLocaleString() },
          { label: 'Total minutes', value: age.totalMinutes.toLocaleString() },
          { label: 'Total seconds', value: age.totalSeconds.toLocaleString() },
          { label: 'Next birthday', value: `${age.daysToBirthday} days` },
        ]);
        this.output.set(`Age: ${age.years} years, ${age.months} months, ${age.days} days\nTotal days: ${age.totalDays}\nTotal hours: ${age.totalHours}\nTotal minutes: ${age.totalMinutes}\nTotal seconds: ${age.totalSeconds}\nNext birthday: ${age.daysToBirthday} days`);
        break;
      }
      case 'bmi-calculator': {
        const bmi = a / ((b / 100) ** 2);
        this.rows.set([{ label: 'BMI', value: bmi.toFixed(2) }, { label: 'Category', value: bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese' }]);
        this.output.set(bmi.toFixed(2));
        break;
      }
      case 'percentage-calculator':
        this.rows.set([{ label: `${a}% of ${b}`, value: String((a / 100) * b) }]);
        this.output.set(String((a / 100) * b));
        break;
      case 'discount-calculator': {
        const saved = a * b / 100;
        this.rows.set([{ label: 'Discount amount', value: saved.toFixed(2) }, { label: 'Final price', value: (a - saved).toFixed(2) }]);
        this.output.set((a - saved).toFixed(2));
        break;
      }
      case 'gst-calculator':
      case 'vat-calculator': {
        const tax = a * b / 100;
        this.rows.set([{ label: 'Tax amount', value: tax.toFixed(2) }, { label: 'Total', value: (a + tax).toFixed(2) }]);
        this.output.set((a + tax).toFixed(2));
        break;
      }
      case 'emi-calculator': {
        const r = b / 12 / 100;
        const n = c * 12;
        const emi = r ? a * r * ((1 + r) ** n) / (((1 + r) ** n) - 1) : a / n;
        this.rows.set([{ label: 'Monthly EMI', value: emi.toFixed(2) }, { label: 'Total payment', value: (emi * n).toFixed(2) }, { label: 'Interest', value: (emi * n - a).toFixed(2) }]);
        this.output.set(emi.toFixed(2));
        break;
      }
      case 'unit-converter': {
        const factors: Record<string, number> = { 'm-ft': 3.28084, 'ft-m': 0.3048, 'kg-lb': 2.20462, 'lb-kg': 0.453592, 'c-f': 1, 'f-c': 1 };
        const mode = this.second() || 'm-ft';
        const value = mode === 'c-f' ? (a * 9 / 5) + 32 : mode === 'f-c' ? (a - 32) * 5 / 9 : a * (factors[mode] || 1);
        this.rows.set([{ label: 'Converted value', value: value.toFixed(4) }, { label: 'Mode', value: mode }]);
        this.output.set(value.toFixed(4));
        break;
      }
      case 'scientific-calculator': {
        const expression = this.input().replace(/[^-+*/().0-9 MathsqrtpowabsceilfloorroundminmaxPIE]/g, '');
        const value = Function('Math', `"use strict"; return (${expression})`)(Math);
        this.rows.set([{ label: 'Result', value: String(value) }]);
        this.output.set(String(value));
        break;
      }
      case 'binary-calculator': {
        const left = parseInt(this.input(), 2);
        const right = parseInt(this.second() || '0', 2);
        const op = this.third() || '+';
        const value = op === '-' ? left - right : op === '*' ? left * right : op === '/' ? Math.floor(left / right) : left + right;
        this.rows.set([{ label: 'Binary', value: value.toString(2) }, { label: 'Decimal', value: String(value) }]);
        this.output.set(value.toString(2));
        break;
      }
    }
  }

  private async processGenerator(): Promise<void> {
    const input = this.input().trim() || 'FlexImagePro';
    const second = this.second().trim();
    const third = this.third().trim();
    switch (this.slug) {
      case 'qr-code-generator': {
        const payload = this.qrPayload();
        const fields = this.qrFields();
        const svg = await QRCode.toString(payload, {
          type: 'svg',
          margin: 2,
          width: 900,
          color: { dark: fields['foreground'] || '#111827', light: fields['background'] || '#ffffff' },
        });
        const preview = await QRCode.toDataURL(payload, {
          margin: 2,
          width: 900,
          color: { dark: fields['foreground'] || '#111827', light: fields['background'] || '#ffffff' },
        });
        this.output.set(svg);
        this.qrPreview.set(preview);
        this.qrJpgPreview.set(await this.composeQrJpg(preview));
        this.rows.set([
          { label: 'QR type', value: this.qrTypeLabel() },
          { label: 'Frame', value: fields['frame'] || 'none' },
          { label: 'Logo style', value: fields['logoStyle'] || 'corner-break' },
          { label: 'Logo', value: fields['logo'] ? fields['logo'] : 'No logo text' },
        ]);
        break;
      }
      case 'barcode-generator': {
        const svg = await this.createBarcodeSvg(input);
        const preview = await this.svgToDataUrl(svg, 'image/png');
        this.output.set(svg);
        this.barcodePreview.set(preview);
        this.barcodeJpgPreview.set(await this.svgToDataUrl(svg, 'image/jpeg'));
        this.rows.set([{ label: 'Value', value: input }, { label: 'Format', value: 'CODE128 barcode' }]);
        break;
      }
      case 'password-generator': {
        const length = Math.min(128, Math.max(8, Number(input) || 16));
        const password = this.randomPassword(length);
        this.output.set(password);
        this.rows.set([{ label: 'Length', value: String(length) }, { label: 'Includes', value: 'Uppercase, lowercase, numbers, symbols' }]);
        break;
      }
      case 'lorem-ipsum-generator': {
        const words = Math.min(500, Math.max(10, Number(input) || 80));
        const text = this.lorem(words);
        this.output.set(text);
        this.rows.set([{ label: 'Words', value: String(words) }, { label: 'Paragraphs', value: '1' }]);
        break;
      }
      case 'random-number-generator': {
        const min = Number(input) || 1;
        const max = Number(second) || 100;
        const value = Math.floor(Math.random() * (Math.max(min, max) - Math.min(min, max) + 1)) + Math.min(min, max);
        this.output.set(String(value));
        this.rows.set([{ label: 'Random number', value: String(value) }, { label: 'Range', value: `${Math.min(min, max)} to ${Math.max(min, max)}` }]);
        break;
      }
      case 'random-name-generator': {
        const first = ['Ayan', 'Zara', 'Rayan', 'Maya', 'Daniyal', 'Alina', 'Hamza', 'Noor'];
        const last = ['Khan', 'Malik', 'Ahmed', 'Raza', 'Sheikh', 'Ali', 'Mirza', 'Qureshi'];
        const name = `${this.pick(first)} ${this.pick(last)}`;
        this.output.set(name);
        this.rows.set([{ label: 'Random name', value: name }]);
        break;
      }
      case 'random-color-generator': {
        const hex = this.randomHex();
        const rgb = this.hexToRgb(hex);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        this.output.set(`HEX: ${hex}\nRGB: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\nHSL: hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`);
        this.rows.set([{ label: 'HEX', value: hex }, { label: 'RGB', value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }, { label: 'HSL', value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` }]);
        break;
      }
      case 'css-gradient-generator': {
        const css = `background: linear-gradient(${third || '135deg'}, ${input}, ${second || '#14b8a6'});`;
        this.output.set(css);
        this.rows.set([{ label: 'Start color', value: input }, { label: 'End color', value: second || '#14b8a6' }]);
        break;
      }
      case 'css-box-shadow-generator': {
        const css = `box-shadow: ${input || '0 14px 30px'} ${second || 'rgba(15, 23, 42, 0.18)'};`;
        this.output.set(css);
        this.rows.set([{ label: 'CSS', value: css }]);
        break;
      }
      case 'css-border-radius-generator': {
        const css = `border-radius: ${input || '12px'};`;
        this.output.set(css);
        this.rows.set([{ label: 'CSS', value: css }]);
        break;
      }
      case 'css-clip-path-generator': {
        const css = `clip-path: ${input || 'polygon(50% 0%, 100% 100%, 0% 100%)'};`;
        this.output.set(css);
        this.rows.set([{ label: 'CSS', value: css }]);
        break;
      }
    }
  }

  private async processPdf(): Promise<void> {
    this.isProcessingPdf.set(true);
    this.loader.show();
    try {
    return await this.withPdfWarningsSilenced(async () => {
    const files = this.pdfFiles();
    if (!files.length) throw new Error('Select PDF file first.');
    const { PDFDocument, degrees, rgb, StandardFonts } = await import('pdf-lib');
    const source = await this.loadPdfDocument(PDFDocument, files[0]);
    if (this.slug === 'pdf-metadata-viewer') {
      this.rows.set([
        { label: 'File name', value: files[0].name },
        { label: 'File size', value: this.formatBytes(files[0].size) },
        { label: 'Pages', value: String(source.getPageCount()) },
        { label: 'Title', value: source.getTitle() || 'Not set' },
        { label: 'Author', value: source.getAuthor() || 'Not set' },
        { label: 'Subject', value: source.getSubject() || 'Not set' },
        { label: 'Creator', value: source.getCreator() || 'Not set' },
        { label: 'Producer', value: source.getProducer() || 'Not set' },
        { label: 'Created', value: source.getCreationDate()?.toISOString() || 'Not set' },
        { label: 'Modified', value: source.getModificationDate()?.toISOString() || 'Not set' },
      ]);
      this.output.set(this.rows().map((row) => `${row.label}: ${row.value}`).join('\n'));
      return;
    }
    if (this.slug === 'merge-pdf') {
      const merged = await PDFDocument.create();
      for (const [index, file] of files.entries()) {
        const doc = await this.loadPdfDocument(PDFDocument, file, index);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      }
      this.setDownloadBlob(new Blob([this.blobPart(await merged.save())], { type: 'application/pdf' }), 'merged.pdf');
      this.rows.set([{ label: 'Files merged', value: String(files.length) }, { label: 'Output file', value: 'merged.pdf' }]);
      return;
    }
    if (this.slug === 'split-pdf') {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      for (let index = 0; index < source.getPageCount(); index++) {
        const doc = await PDFDocument.create();
        const [page] = await doc.copyPages(source, [index]);
        doc.addPage(page);
        zip.file(`page-${index + 1}.pdf`, await doc.save());
      }
      this.setDownloadBlob(await zip.generateAsync({ type: 'blob' }), 'split-pages.zip');
      this.rows.set([{ label: 'Pages split', value: String(source.getPageCount()) }, { label: 'Output', value: 'ZIP' }]);
      return;
    }
    if (this.slug === 'pdf-to-images') {
      const JSZip = (await import('jszip')).default;
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const zip = new JSZip();
      const renderFile = files[0];
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await renderFile.arrayBuffer()), verbosity: pdfjs.VerbosityLevel.ERRORS });
      const pdf = await loadingTask.promise;
      const pagesToRender = this.parsePages(this.pdfPageInput(), pdf.numPages);
      if (!pagesToRender.length) throw new Error('No valid pages selected.');
      for (const pageIndex of pagesToRender) {
        const page = await pdf.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is not available in this browser.');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not render PDF page.')), 'image/png'));
        zip.file(`page-${pageIndex + 1}.png`, blob);
        if ((pagesToRender.indexOf(pageIndex) + 1) % 5 === 0) {
          await this.nextFrame();
        }
      }
      this.setDownloadBlob(await zip.generateAsync({ type: 'blob' }), 'pdf-images.zip');
      this.rows.set([{ label: 'Pages rendered', value: String(pagesToRender.length) }, { label: 'Output', value: 'PNG ZIP' }]);
      return;
    }
    const doc = await PDFDocument.create();
    let indices = this.parsePages(this.pdfPageInput(), source.getPageCount());
    if (this.slug === 'rearrange-pdf-pages') indices = this.parsePages(this.pdfOrderInput(), source.getPageCount());
    if (this.slug === 'delete-pdf-pages') {
      const remove = new Set(indices);
      indices = source.getPageIndices().filter((index) => !remove.has(index));
    }
    if (!indices.length) throw new Error('No valid pages selected.');
    const pages = await doc.copyPages(source, indices);
    pages.forEach((page) => {
      if (this.slug === 'rotate-pdf') page.setRotation(degrees(this.pdfAngle()));
      doc.addPage(page);
    });
    if (this.slug === 'add-page-numbers') {
      const font = await doc.embedFont(StandardFonts.Helvetica);
      doc.getPages().forEach((page, index) => page.drawText(String(index + 1), { x: page.getWidth() / 2 - 8, y: 24, size: 12, color: rgb(0.05, 0.46, 0.43), font }));
    }
    const name = this.slug === 'extract-pdf-pages' ? 'extracted-pages.pdf' : this.slug === 'delete-pdf-pages' ? 'deleted-pages.pdf' : this.slug === 'rearrange-pdf-pages' ? 'rearranged-pages.pdf' : this.slug === 'rotate-pdf' ? 'rotated.pdf' : 'numbered.pdf';
    this.setDownloadBlob(new Blob([this.blobPart(await doc.save())], { type: 'application/pdf' }), name);
    this.rows.set([{ label: 'Input pages', value: String(source.getPageCount()) }, { label: 'Output file', value: name }]);
    }, this.slug === 'pdf-to-images');
    } finally {
      this.isProcessingPdf.set(false);
      this.loader.hide();
    }
  }

  private async processGis(): Promise<void> {
    const input = this.gisInput() || this.input();
    const second = this.gisSecondInput() || this.second();
    if (this.slug === 'coordinate-converter') {
      const [lat, lng] = this.parseLatLng(input);
      this.gisOutput.set(JSON.stringify({ decimal: { lat, lng }, dms: { lat: this.toDms(lat, 'lat'), lng: this.toDms(lng, 'lng') } }, null, 2));
    } else if (this.slug === 'latitude-longitude-finder') {
      const [lat, lng] = await this.findLatLng(input);
      this.gisInput.set(`${lat}, ${lng}`);
      this.gisOutput.set(`Latitude: ${lat}\nLongitude: ${lng}\nCoordinate: ${lat}, ${lng}`);
    } else if (this.slug === 'distance-calculator') {
      const [a, b] = input.split('|');
      const distance = this.haversine(this.parseLatLng(a), this.parseLatLng(b || second));
      this.gisOutput.set(`Distance: ${distance.toFixed(3)} km\nMiles: ${(distance * 0.621371).toFixed(3)}`);
    } else if (this.slug === 'area-calculator') {
      const points = this.parsePoints(input);
      this.gisOutput.set(`Area: ${this.polygonArea(points).toFixed(3)} square km\nPoints: ${points.length}`);
    } else if (this.slug === 'kml-circle-generator' || this.slug === 'kml-polygon-generator') {
      this.generateKmlCircle();
      return;
    } else if (this.slug === 'buffer-generator') {
      const radiusMeters = this.radiusToMeters(Number(second) || 1000, this.gisRadiusUnit());
      this.gisOutput.set(this.kmlCircle(this.parseLatLng(input), radiusMeters, this.gisShapeOptions('FlexImagePro Buffer'), true));
    } else if (this.slug === 'geojson-to-kml') {
      this.gisOutput.set(this.geoJsonToKml(input));
    } else if (this.slug === 'kml-to-geojson') {
      this.gisOutput.set(JSON.stringify(this.kmlToGeoJson(input), null, 2));
    } else if (this.slug === 'gpx-to-kml') {
      this.gisOutput.set(this.gpxToKml(input));
    } else {
      this.gisOutput.set(`Latitude / Longitude: ${input || 'Paste coordinates like 40.7128, -74.0060'}`);
    }
    this.output.set(this.gisOutput());
    this.rows.set([{ label: 'Output type', value: this.slug.includes('kml') || this.slug.includes('buffer') ? 'KML' : 'Text / JSON' }]);
    this.scheduleGisMapUpdate();
  }

  generateKmlCircle(): void {
    this.error.set(null);
    if (this.kmlCircleForm.invalid) {
      this.kmlCircleForm.markAllAsTouched();
      this.error.set('Enter a valid latitude, longitude, and radius.');
      return;
    }
    const value = this.kmlCircleForm.getRawValue();
    const isPolygon = value.shape === 'polygon';
    const center: [number, number] = [value.latitude, value.longitude];
    this.syncKmlCircleInputs();
    if (isPolygon) {
      const points = this.parsePoints(value.polygonCoordinates);
      this.gisOutput.set(this.kmlPolygon(points, this.kmlCircleOptions()));
    } else {
      this.gisOutput.set(this.kmlCircle(center, this.radiusToMeters(value.radius, value.radiusUnit), this.kmlCircleOptions(), value.includeCenter));
    }
    this.output.set(this.gisOutput());
    this.rows.set([
      { label: 'Shape', value: isPolygon ? 'KML Polygon' : 'KML Circle' },
      { label: 'Name', value: value.name },
      ...(isPolygon ? [{ label: 'Polygon points', value: String(this.parsePoints(value.polygonCoordinates).length) }] : [
        { label: 'Center', value: `${value.latitude}, ${value.longitude}` },
        { label: 'Radius', value: `${value.radius} ${this.radiusUnitLabel(value.radiusUnit)}` },
      ]),
      { label: 'Output type', value: 'KML' },
    ]);
    this.scheduleGisMapUpdate();
  }

  clearKmlCircle(): void {
    this.clear();
  }

  private processColor(): void {
    const input = this.input().trim() || '#14b8a6';
    const second = this.second().trim() || '#ffffff';
    const third = this.third().trim() || '#111827';
    switch (this.slug) {
      case 'hex-to-rgb': {
        const rgb = this.hexToRgb(input);
        this.output.set(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
        this.rows.set([{ label: 'Red', value: String(rgb.r) }, { label: 'Green', value: String(rgb.g) }, { label: 'Blue', value: String(rgb.b) }]);
        break;
      }
      case 'rgb-to-hex': {
        const rgb = this.parseRgb(input);
        const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
        this.output.set(hex);
        this.rows.set([{ label: 'HEX', value: hex }, { label: 'RGB', value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }]);
        break;
      }
      case 'hex-to-hsl': {
        const rgb = this.hexToRgb(input);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        this.output.set(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`);
        this.rows.set([{ label: 'Hue', value: String(hsl.h) }, { label: 'Saturation', value: `${hsl.s}%` }, { label: 'Lightness', value: `${hsl.l}%` }]);
        break;
      }
      case 'hsl-to-hex': {
        const hsl = this.parseHsl(input);
        const rgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
        const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
        this.output.set(hex);
        this.rows.set([{ label: 'HEX', value: hex }, { label: 'RGB', value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }]);
        break;
      }
      case 'color-palette-generator': {
        const colors = this.palette(input);
        this.output.set(colors.join('\n'));
        this.rows.set(colors.map((color, index) => ({ label: `Color ${index + 1}`, value: color })));
        break;
      }
      case 'gradient-generator': {
        const css = `linear-gradient(${third || '90deg'}, ${input}, ${second})`;
        this.output.set(`background: ${css};`);
        this.rows.set([{ label: 'Gradient', value: css }]);
        break;
      }
      case 'contrast-checker': {
        const ratio = this.contrastRatio(input, second);
        this.output.set(`Contrast ratio: ${ratio.toFixed(2)}:1`);
        this.rows.set([{ label: 'Contrast ratio', value: `${ratio.toFixed(2)}:1` }, { label: 'Normal text', value: ratio >= 4.5 ? 'Pass' : 'Fail' }, { label: 'Large text', value: ratio >= 3 ? 'Pass' : 'Fail' }]);
        break;
      }
      case 'color-picker': {
        const rgb = this.hexToRgb(input);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        this.output.set(`HEX: ${input}\nRGB: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\nHSL: hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`);
        this.rows.set([{ label: 'HEX', value: input }, { label: 'RGB', value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }, { label: 'HSL', value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` }]);
        break;
      }
    }
  }

  private processDateTime(): void {
    switch (this.slug) {
      case 'timestamp-converter':
      case 'unix-timestamp-converter': {
        const value = this.input().trim();
        const date = /^\d+$/.test(value) ? new Date(Number(value) * (value.length <= 10 ? 1000 : 1)) : new Date(value);
        if (Number.isNaN(date.getTime())) throw new Error('Enter a valid timestamp or date.');
        this.output.set(date.toISOString());
        this.rows.set([{ label: 'UTC date', value: date.toUTCString() }, { label: 'ISO', value: date.toISOString() }, { label: 'Unix seconds', value: String(Math.floor(date.getTime() / 1000)) }, { label: 'Milliseconds', value: String(date.getTime()) }]);
        break;
      }
      case 'time-zone-converter': {
        const date = new Date(this.input());
        if (Number.isNaN(date.getTime())) throw new Error('Enter a valid date and time.');
        const from = this.offsetMinutes(this.second() || '+00:00');
        const to = this.offsetMinutes(this.third() || '+05:00');
        const converted = new Date(date.getTime() - from * 60000 + to * 60000);
        this.output.set(converted.toISOString().replace('Z', this.third() || '+05:00'));
        this.rows.set([{ label: 'From offset', value: this.second() || '+00:00' }, { label: 'To offset', value: this.third() || '+05:00' }, { label: 'Converted time', value: this.output() }]);
        break;
      }
      case 'date-difference-calculator': {
        const start = new Date(this.input());
        const end = new Date(this.second());
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('Enter two valid dates.');
        const days = Math.abs(end.getTime() - start.getTime()) / 86400000;
        this.output.set(`${Math.floor(days)} days`);
        this.rows.set([{ label: 'Days', value: String(Math.floor(days)) }, { label: 'Weeks', value: (days / 7).toFixed(2) }, { label: 'Months approx.', value: (days / 30.4375).toFixed(2) }]);
        break;
      }
      case 'countdown-timer': {
        const target = new Date(this.input());
        if (Number.isNaN(target.getTime())) throw new Error('Enter a valid future date.');
        const diff = Math.max(0, target.getTime() - Date.now());
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        this.output.set(`${days} days, ${hours} hours, ${minutes} minutes`);
        this.rows.set([{ label: 'Days', value: String(days) }, { label: 'Hours', value: String(hours) }, { label: 'Minutes', value: String(minutes) }]);
        break;
      }
    }
  }

  primaryLabel(): string {
    const labels: Record<string, string> = {
      'age-calculator': 'Date of birth',
      'bmi-calculator': 'Weight (kg)',
      'emi-calculator': 'Loan amount',
      'scientific-calculator': 'Expression',
      'password-generator': 'Password length',
      'lorem-ipsum-generator': 'Word count',
      'random-number-generator': 'Minimum number',
      'css-gradient-generator': 'Start color',
      'css-box-shadow-generator': 'Shadow values',
      'css-border-radius-generator': 'Radius value',
      'css-clip-path-generator': 'Clip-path value',
      'hsl-to-hex': 'HSL value',
      'rgb-to-hex': 'RGB value',
      'time-zone-converter': 'Date and time',
      'date-difference-calculator': 'Start date',
      'countdown-timer': 'Target date',
    };
    return labels[this.slug] || (this.category.title === 'Color Tools' ? 'Color value' : 'Value');
  }

  secondLabel(): string {
    const labels: Record<string, string> = {
      'bmi-calculator': 'Height (cm)',
      'emi-calculator': 'Interest %',
      'unit-converter': 'Convert mode',
      'binary-calculator': 'Second binary',
      'random-number-generator': 'Maximum number',
      'css-gradient-generator': 'End color',
      'css-box-shadow-generator': 'Shadow color',
      'gradient-generator': 'End color',
      'contrast-checker': 'Background color',
      'time-zone-converter': 'From offset',
      'date-difference-calculator': 'End date',
    };
    return labels[this.slug] || 'Second value';
  }

  thirdLabel(): string {
    const labels: Record<string, string> = {
      'emi-calculator': 'Years',
      'binary-calculator': 'Operator',
      'css-gradient-generator': 'Angle',
      'gradient-generator': 'Angle',
      'contrast-checker': 'Optional note',
      'time-zone-converter': 'To offset',
    };
    return labels[this.slug] || 'Third value';
  }

  inputType(): string {
    if (['age-calculator', 'date-difference-calculator', 'countdown-timer'].includes(this.slug)) return 'date';
    if (this.slug === 'time-zone-converter') return 'datetime-local';
    if (['hex-to-rgb', 'hex-to-hsl', 'color-palette-generator', 'color-picker', 'gradient-generator', 'contrast-checker', 'css-gradient-generator'].includes(this.slug)) return 'color';
    return 'text';
  }

  rowCardStyle(value: string): Record<string, string> {
    const color = this.extractColor(value);
    if (!color) return {};
    return {
      background: color,
      color: this.readableTextColor(color),
      border: '1px solid rgba(15, 23, 42, 0.12)',
    };
  }

  rowLabelStyle(value: string): Record<string, string> {
    return this.extractColor(value) ? { color: 'currentColor', opacity: '0.82' } : {};
  }

  rowTextColor(value: string): string | null {
    const color = this.extractColor(value);
    return color ? this.readableTextColor(color) : null;
  }

  visualPreviewStyle(): Record<string, string> {
    if (this.slug === 'css-gradient-generator' || this.slug === 'gradient-generator') {
      return { background: this.gradientPreviewValue() };
    }
    if (this.slug === 'css-border-radius-generator') {
      return {
        background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
        'border-radius': this.input() || '12px',
      };
    }
    if (this.slug === 'css-clip-path-generator') {
      return {
        background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
        'clip-path': this.input() || 'polygon(50% 0%, 100% 100%, 0% 100%)',
      };
    }
    return {};
  }

  hasVisualPreview(): boolean {
    return ['css-gradient-generator', 'gradient-generator', 'css-border-radius-generator', 'css-clip-path-generator'].includes(this.slug);
  }

  private gradientPreviewValue(): string {
    const start = this.input().trim() || '#0f766e';
    const end = this.second().trim() || '#14b8a6';
    const angle = this.third().trim() || (this.slug === 'css-gradient-generator' ? '135deg' : '90deg');
    return `linear-gradient(${angle}, ${start}, ${end})`;
  }

  private defaultInput(): string {
    if (this.slug === 'age-calculator') return new Date(2000, 0, 1).toISOString().slice(0, 10);
    if (this.slug === 'scientific-calculator') return 'Math.sqrt(144) + Math.pow(2, 3)';
    if (this.slug === 'binary-calculator') return '1010';
    if (this.slug === 'date-difference-calculator') return new Date().toISOString().slice(0, 10);
    if (this.slug === 'countdown-timer') return new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10);
    if (this.slug === 'time-zone-converter') return new Date().toISOString().slice(0, 16);
    if (this.slug === 'bmi-calculator') return '70';
    if (this.slug === 'password-generator') return '16';
    if (this.slug === 'lorem-ipsum-generator') return '80';
    if (this.slug === 'qr-code-generator') return 'https://fleximagepro.com';
    if (this.slug === 'barcode-generator') return '123456789012';
    if (this.slug === 'css-border-radius-generator') return '24px';
    if (this.slug === 'css-clip-path-generator') return 'polygon(50% 0%, 100% 100%, 0% 100%)';
    if (this.slug.includes('color') || this.slug.includes('hex') || this.slug.includes('gradient') || this.slug === 'contrast-checker') return '#14b8a6';
    if (this.slug.includes('timestamp')) return String(Math.floor(Date.now() / 1000));
    if (this.slug.includes('calculator') || this.slug.includes('converter')) return '100';
    if (this.slug === 'jwt-decoder') return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.signature';
    if (this.slug.includes('json')) return '{\"name\":\"FlexImagePro\",\"tools\":121}';
    if (this.slug.includes('xml')) return '<root><tool>FlexImagePro</tool></root>';
    if (this.slug.includes('html')) return '<main><h1>Hello</h1><p>World</p></main>';
    if (this.slug.includes('css')) return 'body{color:#111;background:#fff}';
    if (this.slug.includes('sql')) return 'select id,name from users where active=1 order by name';
    return 'FlexImagePro';
  }

  pdfAcceptsMultiple(): boolean {
    return this.slug === 'merge-pdf';
  }

  pdfNeedsPageRange(): boolean {
    return ['rotate-pdf', 'extract-pdf-pages', 'delete-pdf-pages', 'add-page-numbers', 'pdf-to-images'].includes(this.slug);
  }

  pdfNeedsOrder(): boolean {
    return this.slug === 'rearrange-pdf-pages';
  }

  pdfNeedsAngle(): boolean {
    return this.slug === 'rotate-pdf';
  }

  pdfHasOptions(): boolean {
    return this.pdfNeedsPageRange() || this.pdfNeedsOrder() || this.pdfNeedsAngle();
  }

  pdfLayoutClass(): string {
    return this.pdfHasOptions() ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : 'lg:grid-cols-1';
  }

  pdfCreatesPdf(): boolean {
    return ['merge-pdf', 'rotate-pdf', 'extract-pdf-pages', 'rearrange-pdf-pages', 'delete-pdf-pages', 'add-page-numbers'].includes(this.slug);
  }

  pdfCreatesZip(): boolean {
    return ['split-pdf', 'pdf-to-images'].includes(this.slug);
  }

  pdfShowsMetadata(): boolean {
    return this.slug === 'pdf-metadata-viewer';
  }

  pdfCanShare(): boolean {
    return this.pdfCreatesPdf();
  }

  pdfCanDownload(): boolean {
    return this.pdfCreatesPdf() || this.pdfCreatesZip();
  }

  pdfPrimaryButtonLabel(): string {
    if (this.isProcessingPdf() && this.slug === 'pdf-to-images') return 'Creating ZIP...';
    if (this.isProcessingPdf() && this.pdfCreatesZip()) return 'Creating ZIP...';
    if (this.isProcessingPdf()) return 'Processing PDF...';
    if (this.pdfShowsMetadata()) return 'View Metadata';
    if (this.pdfCreatesZip()) return 'Create ZIP';
    return 'Create Preview';
  }

  pdfDownloadButtonLabel(): string {
    return this.pdfCreatesZip() ? 'Download ZIP' : 'Download PDF';
  }

  pdfActionLabel(): string {
    const labels: Record<string, string> = {
      'merge-pdf': 'Merge PDF',
      'split-pdf': 'Split PDF',
      'rotate-pdf': 'Rotate PDF',
      'extract-pdf-pages': 'Extract Pages',
      'rearrange-pdf-pages': 'Rearrange Pages',
      'delete-pdf-pages': 'Delete Pages',
      'add-page-numbers': 'Add Page Numbers',
      'pdf-to-images': 'Convert to Images',
      'pdf-metadata-viewer': 'View Metadata',
    };
    return labels[this.slug] || 'Process PDF';
  }

  gisPrimaryLabel(): string {
    const labels: Record<string, string> = {
      'kml-circle-generator': 'Center coordinate',
      'buffer-generator': 'Center coordinate',
      'kml-polygon-generator': 'Polygon coordinates',
      'geojson-to-kml': 'GeoJSON',
      'kml-to-geojson': 'KML',
      'gpx-to-kml': 'GPX',
      'coordinate-converter': 'Coordinate',
      'latitude-longitude-finder': 'Place or coordinate',
      'distance-calculator': 'Start coordinate',
      'area-calculator': 'Polygon coordinates',
    };
    return labels[this.slug] || 'Map data';
  }

  gisSecondaryLabel(): string {
    if (this.slug === 'distance-calculator') return 'End coordinate';
    if (this.slug === 'kml-circle-generator' || this.slug === 'buffer-generator') return 'Radius';
    return 'Optional value';
  }

  gisPlaceholder(): string {
    if (['kml-polygon-generator', 'area-calculator'].includes(this.slug)) return '40.7128, -74.0060\n40.7228, -73.9960\n40.7028, -73.9860';
    if (this.slug === 'geojson-to-kml') return '{"type":"Polygon","coordinates":[[[74.35,31.52],[74.36,31.53],[74.37,31.51],[74.35,31.52]]]}';
    if (this.slug === 'kml-to-geojson') return '<kml><Document><Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>74.35,31.52,0 74.36,31.53,0 74.35,31.52,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>';
    if (this.slug === 'gpx-to-kml') return '<gpx><trk><trkseg><trkpt lat="40.7128" lon="-74.0060"></trkpt><trkpt lat="40.7228" lon="-73.9960"></trkpt></trkseg></trk></gpx>';
    return '40.7128, -74.0060';
  }

  gisShowSecond(): boolean {
    return ['kml-circle-generator', 'buffer-generator'].includes(this.slug);
  }

  gisDownloadExtension(): 'kml' | 'json' | 'txt' {
    if (['kml-circle-generator', 'kml-polygon-generator', 'geojson-to-kml', 'gpx-to-kml', 'buffer-generator'].includes(this.slug)) return 'kml';
    if (this.slug === 'kml-to-geojson' || this.slug === 'coordinate-converter') return 'json';
    return 'txt';
  }

  gisMapPoints(): GisPoint[] {
    const raw = this.gisRawPoints();
    if (!raw.length) return [];
    const lats = raw.map((point) => point.lat);
    const lngs = raw.map((point) => point.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;
    return raw.map((point, index) => ({
      ...point,
      label: point.label || String(index + 1),
      x: 12 + ((point.lng - minLng) / lngRange) * 76,
      y: 88 - ((point.lat - minLat) / latRange) * 76,
    }));
  }

  gisMapPolyline(): string {
    return this.gisMapPoints().map((point) => `${point.x},${point.y}`).join(' ');
  }

  gisMapMode(): 'circle' | 'polygon' | 'line' | 'points' {
    if (this.slug === 'kml-circle-generator' || this.slug === 'kml-polygon-generator') return this.kmlCircleForm.controls.shape.value === 'polygon' ? 'polygon' : 'circle';
    if (['kml-circle-generator', 'buffer-generator'].includes(this.slug)) return 'circle';
    if (['kml-polygon-generator', 'area-calculator', 'geojson-to-kml', 'kml-to-geojson'].includes(this.slug)) return 'polygon';
    if (['distance-calculator', 'gpx-to-kml'].includes(this.slug)) return 'line';
    return 'points';
  }

  gisMapCircleRadius(): number {
    const radius = Math.max(250, Number(this.gisSecondInput() || this.second()) || 1000);
    return Math.max(10, Math.min(34, Math.log10(radius) * 8));
  }

  kmlCirclePreviewRadius(): number {
    const radius = Math.max(1, Number(this.kmlCircleForm.controls.radius.value) || 1000);
    return Math.max(12, Math.min(74, Math.log10(radius + 10) * 16));
  }

  kmlCirclePreviewOpacity(): number {
    return Math.max(0, Math.min(1, (Number(this.kmlCircleForm.controls.opacity.value) || 0) / 100));
  }

  kmlCircleCenterLabel(): string {
    const value = this.kmlCircleForm.getRawValue();
    if (value.shape === 'polygon') return `${this.parsePoints(value.polygonCoordinates).length} polygon points`;
    return `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`;
  }

  private syncKmlCircleInputs(): void {
    if (this.slug !== 'kml-circle-generator' && this.slug !== 'kml-polygon-generator') return;
    const value = this.kmlCircleForm.getRawValue();
    if (value.shape === 'polygon') {
      this.gisInput.set(value.polygonCoordinates);
      this.gisSecondInput.set('');
    } else {
      this.gisInput.set(`${value.latitude}, ${value.longitude}`);
      this.gisSecondInput.set(String(this.radiusToMeters(value.radius, value.radiusUnit)));
    }
  }

  private scheduleGisMapUpdate(): void {
    if (this.category.title !== 'GIS / Map Tools' || !isPlatformBrowser(this.platformId)) return;
    window.setTimeout(() => void this.updateGoogleMap(), 0);
  }

  private async ensureGoogleMap(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId) || !this.gisGoogleMap?.nativeElement || !environment.googleMapsApiKey) return false;
    await this.loadGoogleMaps();
    if (!this.gisMap) {
      this.gisMap = new google.maps.Map(this.gisGoogleMap.nativeElement, {
        center: { lat: 40.7128, lng: -74.0060 },
        zoom: 11,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        styles: [
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        ],
      });
    }
    window.setTimeout(() => {
      if (this.gisMap) google.maps.event.trigger(this.gisMap, 'resize');
      this.fitGoogleMapToData();
    }, 80);
    return true;
  }

  private loadGoogleMaps(): Promise<void> {
    if (window.google?.maps) return Promise.resolve();
    if (this.googleMapsPromise) return this.googleMapsPromise;
    this.googleMapsPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById('google-maps-js') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Google Maps could not load.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-maps-js';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(environment.googleMapsApiKey)}&language=en&region=US&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Maps could not load.'));
      document.head.appendChild(script);
    });
    return this.googleMapsPromise;
  }

  private async updateGoogleMap(): Promise<void> {
    if (!(await this.ensureGoogleMap()) || !this.gisMap) return;
    this.clearGisOverlays();
    const points = this.gisRawPoints().filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    if (!points.length) {
      this.gisMap.setCenter({ lat: 40.7128, lng: -74.0060 });
      this.gisMap.setZoom(11);
      return;
    }
    const teal = '#0f766e';
    const usesKmlBuilder = this.slug === 'kml-circle-generator' || this.slug === 'kml-polygon-generator';
    const fill = usesKmlBuilder ? this.kmlCircleForm.controls.fillColor.value : this.slug === 'buffer-generator' ? this.gisFillColor() : '#14b8a6';
    const stroke = usesKmlBuilder ? this.kmlCircleForm.controls.strokeColor.value : this.slug === 'buffer-generator' ? this.gisStrokeColor() : teal;
    const opacity = usesKmlBuilder ? this.kmlCirclePreviewOpacity() : this.slug === 'buffer-generator' ? Math.max(0, Math.min(1, this.gisOpacity() / 100)) : 0.24;
    const latLngs = points.map((point) => ({ lat: point.lat, lng: point.lng }));
    if (this.gisMapMode() === 'circle') {
      const center = latLngs[0];
      const value = this.kmlCircleForm.getRawValue();
      const radius = usesKmlBuilder ? this.radiusToMeters(value.radius, value.radiusUnit) : this.slug === 'buffer-generator' ? this.radiusToMeters(Number(this.gisSecondInput() || this.second()) || 1000, this.gisRadiusUnit()) : Math.max(1, Number(this.gisSecondInput() || this.second()) || 1000);
      const circle = new google.maps.Circle({
        map: this.gisMap,
        center,
        radius,
        strokeColor: stroke,
        strokeOpacity: 1,
        strokeWeight: 3,
        fillColor: fill,
        fillOpacity: opacity,
      });
      this.gisOverlays.push(circle);
      if (!usesKmlBuilder || value.includeCenter) {
        const marker = new google.maps.Circle({
          map: this.gisMap,
          center,
          radius: Math.max(18, Math.min(80, radius * 0.025)),
          strokeColor: '#ffffff',
          strokeOpacity: 1,
          strokeWeight: 3,
          fillColor: stroke,
          fillOpacity: 1,
        });
        this.gisOverlays.push(marker);
      }
      const bounds = circle.getBounds();
      if (bounds) this.gisMap.fitBounds(bounds, 34);
      return;
    }
    if (this.gisMapMode() === 'polygon' && latLngs.length > 2) {
      const polygon = new google.maps.Polygon({
        map: this.gisMap,
        paths: latLngs,
        strokeColor: stroke,
        strokeOpacity: 1,
        strokeWeight: 3,
        fillColor: fill,
        fillOpacity: opacity,
      });
      this.gisOverlays.push(polygon);
      this.fitGoogleBounds(latLngs);
    } else if (this.gisMapMode() === 'line' && latLngs.length > 1) {
      const line = new google.maps.Polyline({
        map: this.gisMap,
        path: latLngs,
        strokeColor: teal,
        strokeOpacity: 1,
        strokeWeight: 4,
      });
      this.gisOverlays.push(line);
      this.fitGoogleBounds(latLngs);
    } else {
      this.gisMap.setCenter(latLngs[0]);
      this.gisMap.setZoom(13);
    }
    points.forEach((point) => {
      this.gisOverlays.push(new google.maps.Circle({
        map: this.gisMap,
        center: { lat: point.lat, lng: point.lng },
        radius: 35,
        strokeColor: '#ffffff',
        strokeOpacity: 1,
        strokeWeight: 3,
        fillColor: teal,
        fillOpacity: 1,
      }));
    });
  }

  private fitGoogleMapToData(): void {
    if (!this.gisMap || !window.google?.maps) return;
    const points = this.gisRawPoints().filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    if (!points.length) return;
    const latLngs = points.map((point) => ({ lat: point.lat, lng: point.lng }));
    if (this.gisMapMode() === 'circle') {
      const center = latLngs[0];
      const value = this.kmlCircleForm.getRawValue();
      const usesKmlBuilder = this.slug === 'kml-circle-generator' || this.slug === 'kml-polygon-generator';
      const radius = usesKmlBuilder ? this.radiusToMeters(value.radius, value.radiusUnit) : this.slug === 'buffer-generator' ? this.radiusToMeters(Number(this.gisSecondInput() || this.second()) || 1000, this.gisRadiusUnit()) : Math.max(1, Number(this.gisSecondInput() || this.second()) || 1000);
      const circle = new google.maps.Circle({ center, radius });
      const bounds = circle.getBounds();
      if (bounds) this.gisMap.fitBounds(bounds, 34);
      return;
    }
    if (latLngs.length === 1) {
      this.gisMap.setCenter(latLngs[0]);
      this.gisMap.setZoom(13);
      return;
    }
    this.fitGoogleBounds(latLngs);
  }

  private fitGoogleBounds(points: Array<{ lat: number; lng: number }>): void {
    if (!this.gisMap || !window.google?.maps || !points.length) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    this.gisMap.fitBounds(bounds, 34);
  }

  private clearGisOverlays(): void {
    this.gisOverlays.forEach((overlay) => overlay.setMap(null));
    this.gisOverlays = [];
  }

  private async findLatLng(value: string): Promise<[number, number]> {
    try {
      return this.parseLatLng(value);
    } catch {
      if (!isPlatformBrowser(this.platformId)) throw new Error('Enter coordinates like 40.7128, -74.0060');
      await this.loadGoogleMaps();
      return new Promise<[number, number]>((resolve, reject) => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: value }, (results, status) => {
          if (status !== 'OK' || !results?.[0]) {
            reject(new Error('Place not found. Try a more specific location.'));
            return;
          }
          const location = results[0].geometry.location;
          resolve([Number(location.lat().toFixed(6)), Number(location.lng().toFixed(6))]);
        });
      });
    }
  }

  private gisRawPoints(): Array<{ lat: number; lng: number; label: string }> {
    const input = this.gisInput() || this.input();
    const second = this.gisSecondInput() || this.second();
    try {
      if (this.slug === 'distance-calculator') {
        const [a, b] = input.split('|');
        return [
          this.rawPoint(this.parseLatLng(a), 'A'),
          this.rawPoint(this.parseLatLng(b || second), 'B'),
        ];
      }
      if (this.slug === 'kml-polygon-generator' || (this.slug === 'kml-circle-generator' && this.kmlCircleForm.controls.shape.value === 'polygon')) {
        return this.parsePoints(this.kmlCircleForm.controls.polygonCoordinates.value).map((point, index) => this.rawPoint(point, String(index + 1)));
      }
      if (['area-calculator'].includes(this.slug)) {
        return this.parsePoints(input).map((point, index) => this.rawPoint(point, String(index + 1)));
      }
      if (['kml-circle-generator', 'buffer-generator', 'coordinate-converter', 'latitude-longitude-finder'].includes(this.slug)) {
        return [this.rawPoint(this.parseLatLng(input), '1')];
      }
      if (this.slug === 'geojson-to-kml') {
        const geo = JSON.parse(input);
        const coords = geo.type === 'Feature' ? geo.geometry.coordinates : geo.coordinates;
        const ring = Array.isArray(coords?.[0]?.[0]) ? coords[0] : coords;
        return (ring || []).map((pair: number[], index: number) => ({ lat: Number(pair[1]), lng: Number(pair[0]), label: String(index + 1) })).filter((point: { lat: number; lng: number }) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
      }
      if (this.slug === 'kml-to-geojson') {
        return this.kmlCoordinatePairs(input).map((point, index) => this.rawPoint(point, String(index + 1)));
      }
      if (this.slug === 'gpx-to-kml') {
        return [...input.matchAll(/<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"/g)].map((match, index) => ({ lat: Number(match[1]), lng: Number(match[2]), label: String(index + 1) }));
      }
    } catch {
      return [];
    }
    return [];
  }

  private rawPoint(point: [number, number], label: string): { lat: number; lng: number; label: string } {
    return { lat: point[0], lng: point[1], label };
  }

  private outputBlob(text: string, format: DownloadTextFormat): Blob {
    if (format === 'pdf') return new Blob([this.blobPart(this.exportPdf.text(this.catalogItem().label, text, this.rows()))], { type: 'application/pdf' });
    if (format === 'json') return new Blob([JSON.stringify({ tool: this.catalogItem().label, output: text, rows: this.rows() }, null, 2)], { type: 'application/json;charset=utf-8' });
    if (format === 'csv') return new Blob([['field,value', ...this.rows().map((row) => `${this.csv(row.label)},${this.csv(row.value)}`), `output,${this.csv(text)}`].join('\n')], { type: 'text/csv;charset=utf-8' });
    if (format === 'html') return new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>${this.escape(this.catalogItem().label)}</title></head><body><h1>${this.escape(this.catalogItem().label)}</h1><pre>${this.escape(text)}</pre></body></html>`], { type: 'text/html;charset=utf-8' });
    return new Blob([text], { type: 'text/plain;charset=utf-8' });
  }
  private async loadPdfDocument(loader: PdfDocumentLoader, file: File, failedPdfIndex = 0): Promise<import('pdf-lib').PDFDocument> {
    try {
      return await this.withPdfWarningsSilenced(async () => loader.load(await file.arrayBuffer(), { ignoreEncryption: true }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const pdfError = error instanceof Error ? error : new Error(message || 'PDF could not be processed.');
      (pdfError as Error & { failedPdfIndex?: number }).failedPdfIndex = failedPdfIndex;
      if (/encrypted/i.test(message)) {
        const encryptedError = new Error('This encrypted PDF could not be processed. Try an unlocked copy of the PDF.');
        (encryptedError as Error & { failedPdfIndex?: number }).failedPdfIndex = failedPdfIndex;
        throw encryptedError;
      }
      throw pdfError;
    }
  }

  private shouldAttemptPdfRepair(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error || '');
    return PDF_REPAIR_ERROR_PATTERN.test(message);
  }

  private async repairSelectedPdfFiles(error: unknown): Promise<boolean> {
    const files = this.pdfFiles();
    if (!files.length || this.isRepairingPdf()) return false;

    this.isRepairingPdf.set(true);
    this.error.set(null);
    this.toast.info('Preparing your PDF...');
    try {
      const failedIndex = this.failedPdfIndex(error, files.length);
      const repairedFile = await this.repairPdfFile(files[failedIndex]);
      const repairedFiles = [...files];
      repairedFiles[failedIndex] = repairedFile;
      this.setPdfFiles(repairedFiles);
      this.toast.success('PDF processed successfully');
      return true;
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'This PDF could not be repaired');
      this.error.set(null);
      return false;
    } finally {
      this.isRepairingPdf.set(false);
    }
  }

  private async repairPdfFile(file: File): Promise<File> {
    const formData = new FormData();
    formData.append('pdf', file, file.name);
    if (this.slug === 'pdf-to-images') {
      formData.append('repairMode', 'ghostscript');
    }
    const endpoint = `${environment.apiBaseUrl.replace(/\/+$/, '')}/api/pdf/repair`;
    const response = await this.loader.track(fetch(endpoint, {
      method: 'POST',
      body: formData,
    }));

    if (!response.ok) {
      const message = await this.pdfRepairErrorMessage(response);
      throw new Error(message);
    }

    const blob = await response.blob();
    if (!blob.size || !/pdf/i.test(blob.type || response.headers.get('Content-Type') || 'application/pdf')) {
      throw new Error('This PDF could not be repaired');
    }

    const originalName = file.name.replace(/\.pdf$/i, '') || 'document';
    const repaired = response.headers.get('X-PDF-Repaired') === 'true';
    const outputName = repaired ? `${originalName}-repaired.pdf` : file.name;
    return new File([blob], outputName, { type: 'application/pdf', lastModified: Date.now() });
  }

  private async pdfRepairErrorMessage(response: Response): Promise<string> {
    try {
      const payload = await response.json() as { error?: string; status?: string };
      return payload.error || payload.status || 'This PDF could not be repaired';
    } catch {
      return 'This PDF could not be repaired';
    }
  }

  private failedPdfIndex(error: unknown, fileCount: number): number {
    const index = Number((error as { failedPdfIndex?: number } | null)?.failedPdfIndex);
    if (Number.isInteger(index) && index >= 0 && index < fileCount) return index;
    return 0;
  }

  private nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  private async withPdfWarningsSilenced<T>(task: () => Promise<T>, throwOnRenderWarning = false): Promise<T> {
    const originalWarn = console.warn;
    let repairWarning = '';
    console.warn = (...args: unknown[]) => {
      const text = args.map((arg) => String(arg)).join(' ');
      if (/Unable to decode image|Jbig2Error|JBIG2|Dependent image isn't ready yet/i.test(text)) {
        repairWarning ||= 'PDF image rendering failed in this browser. Preparing a repaired PDF...';
        return;
      }
      if (/Trying to parse invalid object|Invalid object ref|Expected instance of PDFDict|Indexing all PDF objects|Invalid PDF|bad XRef|FormatError/i.test(text)) return;
      originalWarn(...args);
    };
    try {
      const result = await task();
      if (throwOnRenderWarning && repairWarning) {
        throw new Error(repairWarning);
      }
      return result;
    } finally {
      console.warn = originalWarn;
    }
  }
  private friendlyToolError(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Could not process this tool.';
    if (this.category.title === 'PDF Tools' && this.shouldAttemptPdfRepair(error)) {
      return 'This PDF is strongly encrypted or badly damaged. Please upload an unlocked or freshly exported copy.';
    }
    return message;
  }
  private setDownloadBlob(blob: Blob, name: string): void {
    if (this.pdfOutputUrl()) URL.revokeObjectURL(this.pdfOutputUrl());
    this.pdfOutputUrl.set(URL.createObjectURL(blob));
    this.pdfOutputName.set(name);
  }
  private parsePages(input: string, total: number): number[] {
    const values = (input || `1-${total}`).split(',').flatMap((part) => {
      const [start, end] = part.trim().split('-').map(Number);
      if (!Number.isFinite(start)) return [];
      if (Number.isFinite(end)) return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
      return [start];
    });
    return [...new Set(values.filter((page) => page >= 1 && page <= total).map((page) => page - 1))];
  }
  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
  }
  private parseLatLng(value = ''): [number, number] {
    const nums = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    if (nums.length < 2) throw new Error('Enter coordinates like 40.7128, -74.0060');
    return [nums[0], nums[1]];
  }
  private parsePoints(value = ''): Array<[number, number]> {
    return value.split(/\n|;/).map((line) => line.trim()).filter(Boolean).map((line) => this.parseLatLng(line));
  }
  private toDms(value: number, axis: 'lat' | 'lng'): string {
    const dir = axis === 'lat' ? value >= 0 ? 'N' : 'S' : value >= 0 ? 'E' : 'W';
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(2);
    return `${deg}° ${min}' ${sec}" ${dir}`;
  }
  private haversine(a: [number, number], b: [number, number]): number {
    const r = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180;
    const dLng = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180;
    const lat2 = b[0] * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(h));
  }
  private polygonArea(points: Array<[number, number]>): number {
    if (points.length < 3) throw new Error('Enter at least three coordinates.');
    const origin = points[0];
    const projected = points.map(([lat, lng]) => {
      const x = this.haversine(origin, [origin[0], lng]) * (lng < origin[1] ? -1 : 1);
      const y = this.haversine(origin, [lat, origin[1]]) * (lat < origin[0] ? -1 : 1);
      return [x, y];
    });
    let sum = 0;
    projected.forEach(([x1, y1], index) => {
      const [x2, y2] = projected[(index + 1) % projected.length];
      sum += x1 * y2 - x2 * y1;
    });
    return Math.abs(sum) / 2;
  }
  private radiusToMeters(radius: number, unit: KmlRadiusUnit): number {
    const value = Math.max(1, Number(radius) || 1);
    const factors: Record<KmlRadiusUnit, number> = {
      foot: 0.3048,
      kilometer: 1000,
      meter: 1,
      mile: 1609.344,
      nautical_mile: 1852,
      yard: 0.9144,
    };
    return value * factors[unit];
  }
  private radiusUnitLabel(unit: KmlRadiusUnit): string {
    const labels: Record<KmlRadiusUnit, string> = {
      foot: 'feet',
      kilometer: 'kilometers',
      meter: 'meters',
      mile: 'miles',
      nautical_mile: 'nautical miles',
      yard: 'yards',
    };
    return labels[unit];
  }
  private gisShapeOptions(name: string): KmlCircleOptions {
    return {
      name,
      strokeColor: this.gisStrokeColor(),
      fillColor: this.gisFillColor(),
      opacity: this.gisOpacity(),
    };
  }
  private kmlCircle(center: [number, number], radiusMeters: number, options: KmlCircleOptions = this.kmlCircleOptions(), includeCenter = false): string {
    const coords = Array.from({ length: 73 }, (_, index) => {
      const angle = (index / 72) * Math.PI * 2;
      const dx = radiusMeters * Math.cos(angle);
      const dy = radiusMeters * Math.sin(angle);
      const lat = center[0] + (dy / 111320);
      const lng = center[1] + (dx / (111320 * Math.cos(center[0] * Math.PI / 180)));
      return `${lng},${lat},0`;
    }).join(' ');
    return this.kmlWrap(coords, options, includeCenter ? center : null);
  }
  private kmlPolygon(points: Array<[number, number]>, options: KmlCircleOptions = { name: 'FlexImagePro Polygon', strokeColor: '#0f766e', fillColor: '#14b8a6', opacity: 35 }): string {
    const closed = [...points, points[0]];
    return this.kmlWrap(closed.map(([lat, lng]) => `${lng},${lat},0`).join(' '), options);
  }
  private kmlWrap(coords: string, options: KmlCircleOptions = { name: 'FlexImagePro Shape', strokeColor: '#0f766e', fillColor: '#14b8a6', opacity: 35 }, center: [number, number] | null = null): string {
    const stroke = this.kmlColor(options.strokeColor, 100);
    const fill = this.kmlColor(options.fillColor, options.opacity);
    const centerPlacemark = center ? `\n    <Placemark>\n      <name>${this.escapeXmlText(options.name)} Center</name>\n      <Point><coordinates>${center[1]},${center[0]},0</coordinates></Point>\n    </Placemark>` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <Style id="fleximagepro-shape">\n      <LineStyle><color>${stroke}</color><width>3</width></LineStyle>\n      <PolyStyle><color>${fill}</color></PolyStyle>\n    </Style>\n    <Placemark>\n      <name>${this.escapeXmlText(options.name)}</name>\n      <styleUrl>#fleximagepro-shape</styleUrl>\n      <Polygon>\n        <outerBoundaryIs>\n          <LinearRing>\n            <coordinates>${coords}</coordinates>\n          </LinearRing>\n        </outerBoundaryIs>\n      </Polygon>\n    </Placemark>${centerPlacemark}\n  </Document>\n</kml>`;
  }
  private kmlCircleOptions(): KmlCircleOptions {
    const value = this.kmlCircleForm.getRawValue();
    return {
      name: value.name || 'FlexImagePro Circle',
      strokeColor: value.strokeColor || '#0f766e',
      fillColor: value.fillColor || '#14b8a6',
      opacity: Number(value.opacity) || 40,
    };
  }
  private kmlColor(hex: string, opacity: number): string {
    const clean = (hex || '#14b8a6').replace('#', '').padEnd(6, '0').slice(0, 6);
    const alpha = Math.round(Math.max(0, Math.min(100, opacity)) * 2.55).toString(16).padStart(2, '0');
    return `${alpha}${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}`;
  }
  private escapeXmlText(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
  private geoJsonToKml(input: string): string {
    const geo = JSON.parse(input);
    const coords = geo.type === 'Feature' ? geo.geometry.coordinates : geo.coordinates;
    const ring = (Array.isArray(coords[0][0]) ? coords[0] : coords).map((pair: number[]) => `${pair[0]},${pair[1]},0`).join(' ');
    return this.kmlWrap(ring);
  }
  private kmlToGeoJson(input: string): unknown {
    const ring = this.kmlCoordinatePairs(input).map(([lat, lng]) => [lng, lat]);
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} };
  }
  private kmlCoordinatePairs(input: string): Array<[number, number]> {
    const coords = input.match(/<coordinates>([\s\S]*?)<\/coordinates>/)?.[1]?.trim() || '';
    return coords.split(/\s+/).filter(Boolean).map((item) => {
      const [lng, lat] = item.split(',').map(Number);
      return [lat, lng] as [number, number];
    }).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }
  private gpxToKml(input: string): string {
    const points = [...input.matchAll(/<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"/g)].map((match) => `${match[2]},${match[1]},0`).join(' ');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><LineString><coordinates>${points}</coordinates></LineString></Placemark></Document></kml>`;
  }
  private points(values: Array<[number, number]>): ClipPoint[] {
    const palette = ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    return values.map(([x, y], index) => ({ x, y, color: palette[index % palette.length] }));
  }
  private shadowLayerValue(layer: ShadowLayer): string {
    const alpha = Math.max(0, Math.min(1, layer.opacity / 100));
    const rgb = this.hexToRgb(layer.color || '#000000');
    const color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha.toFixed(2)})`;
    return `${layer.inset ? 'inset ' : ''}${layer.x}px ${layer.y}px ${layer.blur}px ${layer.spread}px ${color}`;
  }
  private borderStyleObject(): Record<string, string> {
    const value = `${this.borderWidth()}px ${this.borderStyle()} ${this.hexToRgba(this.borderColor(), this.borderOpacity())}`;
    const position = this.borderPosition();
    if (position === 'all') return { border: value };
    return { [`border-${position}`]: value };
  }
  private hexToRgba(hex: string, opacity: number): string {
    const rgb = this.hexToRgb(hex || '#0f766e');
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(opacity / 100).toFixed(2)})`;
  }

  private validateXml(input: string): string {
    const doc = new DOMParser().parseFromString(input, 'application/xml');
    const error = doc.querySelector('parsererror');
    if (error) throw new Error(error.textContent || 'Invalid XML');
    return 'Valid XML';
  }
  private formatXml(input: string): string { this.validateXml(input); return input.replace(/></g, '>\n<'); }
  private formatMarkup(input: string): string { return input.replace(/></g, '>\n<').replace(/\n\s*/g, '\n'); }
  private formatCode(input: string): string { return input.replace(/([{};])/g, '$1\n').replace(/\n+/g, '\n').trim(); }
  private minify(input: string): string { return input.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,:<>])\s*/g, '$1').trim(); }
  private decodeJwt(input: string): string {
    const [header, payload] = input.split('.');
    const headerJson = this.base64UrlJson(header) as Record<string, unknown>;
    const payloadJson = this.base64UrlJson(payload) as Record<string, unknown>;
    const rows: ResultRow[] = [
      { label: 'Token parts', value: String(input.split('.').length) },
      { label: 'Algorithm', value: String(headerJson['alg'] ?? 'Not set') },
      { label: 'Type', value: String(headerJson['typ'] ?? 'Not set') },
    ];
    const claimLabels: Record<string, string> = { sub: 'Subject', iss: 'Issuer', aud: 'Audience', exp: 'Expires at', iat: 'Issued at', nbf: 'Not before', jti: 'JWT ID' };
    Object.entries(payloadJson).forEach(([key, value]) => {
      const display = ['exp', 'iat', 'nbf'].includes(key) && typeof value === 'number' ? new Date(value * 1000).toISOString() : this.formatValue(value);
      rows.push({ label: claimLabels[key] || `Claim: ${key}`, value: display });
    });
    this.rows.set(rows);
    const decoded = { header: headerJson, payload: payloadJson, signature: input.split('.')[2] || '' };
    return JSON.stringify(decoded, null, 2);
  }
  private base64UrlJson(value = ''): unknown {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    return JSON.parse(atob(normalized));
  }
  private async sha(input: string, algorithm: string): Promise<string> {
    const hash = await crypto.subtle.digest(algorithm.replace('SHA', 'SHA-'), new TextEncoder().encode(input));
    return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  private md5(input: string): string {
    let h = 0x67452301 ^ input.length;
    for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 0x45d9f3b) >>> 0;
    return [h, h ^ 0xefcdab89, h ^ 0x98badcfe, h ^ 0x10325476].map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('');
  }
  private csv(value: string): string { return `"${String(value).replace(/"/g, '""')}"`; }
  private escape(value: string): string { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  private blobPart(bytes: Uint8Array): ArrayBuffer { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; }
  private formatValue(value: unknown): string { return typeof value === 'object' ? JSON.stringify(value) : String(value); }
  private pick(values: string[]): string { return values[Math.floor(Math.random() * values.length)]; }
  private randomHex(): string { return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`; }
  private randomPassword(length: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((byte) => chars[byte % chars.length]).join('');
  }
  private lorem(words: number): string {
    const bank = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua flex image pro clean fast useful simple modern reliable'.split(' ');
    return Array.from({ length: words }, (_, index) => bank[index % bank.length]).join(' ').replace(/^./, (char) => char.toUpperCase()) + '.';
  }
  private qrTypeLabel(): string {
    const labels: Record<QrType, string> = {
      website: 'Website',
      'business-card': 'Digital Business Card',
      text: 'Text',
      wifi: 'WiFi',
      pdf: 'PDF',
      'app-store': 'App Store',
    };
    return labels[this.qrType()];
  }
  private qrPayload(): string {
    const f = this.qrFields();
    switch (this.qrType()) {
      case 'website':
        return this.withProtocol(f['website'] || 'https://fleximagepro.com');
      case 'business-card':
        return [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `N:${this.vcardNamePart(f['fullName'], 'last')};${this.vcardNamePart(f['fullName'], 'first')};;;`,
          `FN:${this.vcardEscape(f['fullName'] || 'Contact')}`,
          `ORG:${f['company'] || ''}`,
          `TITLE:${f['title'] || ''}`,
          `TEL;TYPE=CELL:${f['phone'] || ''}`,
          `TEL;TYPE=WORK:${f['workPhone'] || ''}`,
          `TEL;TYPE=FAX:${f['fax'] || ''}`,
          `EMAIL:${this.vcardEscape(f['email'] || '')}`,
          `ADR;TYPE=WORK:;;${this.vcardEscape(f['street'] || '')};${this.vcardEscape(f['city'] || '')};${this.vcardEscape(f['state'] || '')};${this.vcardEscape(f['zip'] || '')};${this.vcardEscape(f['country'] || '')}`,
          `URL:${this.withProtocol(f['website'] || '')}`,
          'END:VCARD',
        ].join('\n');
      case 'text':
        return f['text'] || 'FlexImagePro';
      case 'wifi':
        return `WIFI:T:${f['security'] || 'WPA'};S:${this.qrEscape(f['ssid'] || '')};P:${this.qrEscape(f['password'] || '')};H:false;;`;
      case 'pdf':
        return this.withProtocol(f['pdf'] || '');
      case 'app-store':
        return this.withProtocol(f['app'] || '');
    }
  }
  private async composeQrJpg(qrDataUrl: string): Promise<string> {
    const fields = this.qrFields();
    const canvas = document.createElement('canvas');
    const size = 1200;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return qrDataUrl;
    context.fillStyle = fields['background'] || '#ffffff';
    context.fillRect(0, 0, size, size);
    this.drawQrFrame(context, size, fields);
    const image = await this.loadImage(qrDataUrl);
    const framedTop = ['scan-me', 'badge', 'ticket'].includes(fields['frame'] || '');
    const qrSize = framedTop ? 840 : 900;
    const offset = (size - qrSize) / 2 + (framedTop ? 42 : 0);
    context.drawImage(image, offset, offset, qrSize, qrSize);
    const logo = (fields['logo'] || '').trim().slice(0, 4);
    if (logo) {
      context.fillStyle = fields['foreground'] || '#111827';
      this.drawLogoBadge(context, size / 2, size / 2, logo, fields);
    }
    return canvas.toDataURL('image/jpeg', 0.92);
  }
  qrFrameClass(): string {
    return `qr-frame qr-frame-${this.qrFields()['frame'] || 'none'}`;
  }
  qrFrameStyle(): Record<string, string> {
    return {
      color: this.qrFields()['foreground'] || '#111827',
      background: this.qrFields()['background'] || '#ffffff',
      borderColor: this.qrFields()['foreground'] || '#111827',
    };
  }
  private drawQrFrame(context: CanvasRenderingContext2D, size: number, fields: Record<string, string>): void {
    const fg = fields['foreground'] || '#111827';
    const frame = fields['frame'] || 'none';
    context.strokeStyle = fg;
    context.fillStyle = fg;
    context.lineWidth = 22;
    context.setLineDash([]);
    if (frame === 'rounded') {
      this.roundRect(context, 48, 48, size - 96, size - 96, 64);
      context.stroke();
    } else if (frame === 'scan-me' || frame === 'badge') {
      context.font = '800 60px Inter, Arial, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      if (frame === 'badge') {
        this.roundRect(context, 320, 44, 560, 110, 55);
        context.fill();
        context.fillStyle = fields['background'] || '#ffffff';
        context.fillText('SCAN ME', size / 2, 102);
      } else {
        context.fillText('SCAN ME', size / 2, 102);
      }
    } else if (frame === 'phone') {
      this.roundRect(context, 180, 40, size - 360, size - 80, 84);
      context.stroke();
      context.beginPath();
      context.arc(size / 2, size - 88, 18, 0, Math.PI * 2);
      context.stroke();
    } else if (frame === 'ticket') {
      context.setLineDash([28, 18]);
      this.roundRect(context, 90, 70, size - 180, size - 140, 36);
      context.stroke();
      context.setLineDash([]);
      context.font = '800 34px Inter, Arial, sans-serif';
      context.textAlign = 'center';
      context.fillText('ADMIT TO LINK', size / 2, size - 84);
    } else if (frame === 'corner') {
      const len = 145;
      const inset = 64;
      [[inset, inset, 1, 1], [size - inset, inset, -1, 1], [inset, size - inset, 1, -1], [size - inset, size - inset, -1, -1]].forEach(([x, y, sx, sy]) => {
        context.beginPath();
        context.moveTo(x, y + sy * len);
        context.lineTo(x, y);
        context.lineTo(x + sx * len, y);
        context.stroke();
      });
    } else if (frame === 'shadow') {
      context.shadowColor = `${fg}55`;
      context.shadowBlur = 38;
      context.shadowOffsetY = 18;
      this.roundRect(context, 86, 86, size - 172, size - 172, 42);
      context.stroke();
      context.shadowColor = 'transparent';
    }
  }
  private drawLogoBadge(context: CanvasRenderingContext2D, cx: number, cy: number, logo: string, fields: Record<string, string>): void {
    const bg = fields['background'] || '#ffffff';
    const fg = fields['foreground'] || '#111827';
    const style = fields['logoStyle'] || 'corner-break';
    const x = cx - 86;
    const y = cy - 86;
    context.fillStyle = bg;
    if (style === 'circle') {
      context.beginPath();
      context.arc(cx, cy, 86, 0, Math.PI * 2);
      context.fill();
    } else {
      this.roundRect(context, x, y, 172, 172, 24);
      context.fill();
    }
    context.strokeStyle = fg;
    context.lineWidth = 8;
    context.setLineDash(style === 'dashed' ? [18, 12] : []);
    if (style === 'dashed' || style === 'minimal') {
      this.roundRect(context, x + 7, y + 7, 158, 158, 18);
      context.stroke();
    } else if (style === 'circle') {
      context.beginPath();
      context.arc(cx, cy, 76, 0, Math.PI * 2);
      context.stroke();
    } else {
      const len = style === 'bracket' ? 46 : 34;
      const gap = 8;
      [[x + gap, y + gap, 1, 1], [x + 172 - gap, y + gap, -1, 1], [x + gap, y + 172 - gap, 1, -1], [x + 172 - gap, y + 172 - gap, -1, -1]].forEach(([px, py, sx, sy]) => {
        context.beginPath();
        context.moveTo(px, py + sy * len);
        context.lineTo(px, py);
        context.lineTo(px + sx * len, py);
        context.stroke();
      });
      if (style === 'double-corner') {
        context.lineWidth = 4;
        const inner = 25;
        [[x + inner, y + inner, 1, 1], [x + 172 - inner, y + inner, -1, 1], [x + inner, y + 172 - inner, 1, -1], [x + 172 - inner, y + 172 - inner, -1, -1]].forEach(([px, py, sx, sy]) => {
          context.beginPath();
          context.moveTo(px, py + sy * 24);
          context.lineTo(px, py);
          context.lineTo(px + sx * 24, py);
          context.stroke();
        });
      }
    }
    context.setLineDash([]);
    context.fillStyle = fg;
    context.font = '800 52px Inter, Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(logo, cx, cy + 2);
  }
  logoBorderClass(): string {
    const style = this.qrFields()['logoStyle'] || 'corner-break';
    return `qr-logo-badge qr-logo-${style}`;
  }
  logoBorderStyle(): Record<string, string> {
    return {
      color: this.qrFields()['foreground'] || '#111827',
      background: this.qrFields()['background'] || '#ffffff',
      borderColor: this.qrFields()['foreground'] || '#111827',
    };
  }
  private async createBarcodeSvg(value: string): Promise<string> {
    const { default: JsBarcode } = await import('jsbarcode');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, value || '123456789012', {
      format: 'CODE128',
      lineColor: '#111827',
      background: '#ffffff',
      width: 2,
      height: 110,
      margin: 18,
      displayValue: true,
      font: 'monospace',
      fontSize: 18,
    });
    return new XMLSerializer().serializeToString(svg);
  }
  private async svgToDataUrl(svg: string, type: 'image/png' | 'image/jpeg'): Promise<string> {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const image = await this.loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(900, image.width || 900);
    canvas.height = Math.max(320, image.height || 320);
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL(type, 0.92);
  }
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }
  private roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }
  private withProtocol(value: string): string {
    if (!value) return '';
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }
  private qrEscape(value: string): string { return value.replace(/([\\;,:"])/g, '\\$1'); }
  private vcardEscape(value: string): string { return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
  private vcardNamePart(fullName = '', part: 'first' | 'last'): string {
    const pieces = fullName.trim().split(/\s+/).filter(Boolean);
    if (!pieces.length) return '';
    const value = part === 'first' ? pieces.slice(0, -1).join(' ') || pieces[0] : pieces.length > 1 ? pieces.at(-1) || '' : '';
    return this.vcardEscape(value);
  }
  private localDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }
  private ageDetails(dob: Date, today: Date): { years: number; months: number; days: number; totalMonths: number; totalWeeks: number; totalDays: number; totalHours: number; totalMinutes: number; totalSeconds: number; daysToBirthday: number } {
    let years = today.getFullYear() - dob.getFullYear();
    let months = today.getMonth() - dob.getMonth();
    let days = today.getDate() - dob.getDate();
    if (days < 0) {
      months--;
      days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    const diffMs = today.getTime() - dob.getTime();
    const totalDays = Math.floor(diffMs / 86400000);
    let nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
    if (nextBirthday < today) nextBirthday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
    return {
      years,
      months,
      days,
      totalMonths: Math.max(0, years * 12 + months),
      totalWeeks: Math.floor(totalDays / 7),
      totalDays,
      totalHours: Math.floor(diffMs / 3600000),
      totalMinutes: Math.floor(diffMs / 60000),
      totalSeconds: Math.floor(diffMs / 1000),
      daysToBirthday: Math.ceil((nextBirthday.getTime() - today.getTime()) / 86400000),
    };
  }
  private barcodeSvg(text: string): string {
    let x = 10;
    const bars = Array.from(text).map((char) => {
      const width = (char.charCodeAt(0) % 4) + 1;
      const gap = (char.charCodeAt(0) % 2) + 1;
      const rect = `<rect x="${x}" y="10" width="${width}" height="80"/>`;
      x += width + gap;
      return rect;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + 10} 120"><rect width="100%" height="100%" fill="#fff"/><g fill="#111827">${bars}</g><text x="${(x + 10) / 2}" y="108" text-anchor="middle" font-family="monospace" font-size="10">${this.escape(text)}</text></svg>`;
  }
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '').trim();
    const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
    const value = Number.parseInt(full || '000000', 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }
  private parseRgb(value: string): { r: number; g: number; b: number } {
    const [r = 0, g = 0, b = 0] = value.match(/\d+/g)?.map(Number) ?? [];
    return { r: this.clamp(r, 0, 255), g: this.clamp(g, 0, 255), b: this.clamp(b, 0, 255) };
  }
  private parseHsl(value: string): { h: number; s: number; l: number } {
    const [h = 0, s = 0, l = 0] = value.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    return { h, s: this.clamp(s, 0, 100), l: this.clamp(l, 0, 100) };
  }
  private rgbToHex(r: number, g: number, b: number): string { return `#${[r, g, b].map((n) => this.clamp(n, 0, 255).toString(16).padStart(2, '0')).join('')}`; }
  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360; s /= 100; l /= 100;
    const hue = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    if (s === 0) return { r: Math.round(l * 255), g: Math.round(l * 255), b: Math.round(l * 255) };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return { r: Math.round(hue(p, q, h + 1 / 3) * 255), g: Math.round(hue(p, q, h) * 255), b: Math.round(hue(p, q, h - 1 / 3) * 255) };
  }
  private palette(hex: string): string[] {
    const rgb = this.hexToRgb(hex);
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    return [-40, -20, 0, 20, 40].map((shift) => {
      const next = this.hslToRgb((hsl.h + shift + 360) % 360, hsl.s, hsl.l);
      return this.rgbToHex(next.r, next.g, next.b);
    });
  }
  private contrastRatio(a: string, b: string): number {
    const l1 = this.luminance(this.hexToRgb(a));
    const l2 = this.luminance(this.hexToRgb(b));
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  private extractColor(value: string): string | null {
    const text = String(value).trim();
    const hex = text.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/)?.[0];
    if (hex) return hex;
    const rgb = text.match(/rgba?\([^)]+\)/)?.[0];
    if (rgb) return rgb;
    const hsl = text.match(/hsla?\([^)]+\)/)?.[0];
    if (hsl) return hsl;
    return null;
  }
  private readableTextColor(color: string): string {
    let rgb: { r: number; g: number; b: number };
    if (color.startsWith('#')) rgb = this.hexToRgb(color);
    else if (color.startsWith('rgb')) rgb = this.parseRgb(color);
    else {
      const hsl = this.parseHsl(color);
      rgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    }
    return this.luminance(rgb) > 0.52 ? '#111827' : '#ffffff';
  }
  private luminance(rgb: { r: number; g: number; b: number }): number {
    const channel = (value: number) => {
      const normalized = value / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return channel(rgb.r) * 0.2126 + channel(rgb.g) * 0.7152 + channel(rgb.b) * 0.0722;
  }
  private offsetMinutes(offset: string): number {
    const match = offset.match(/^([+-])(\d{2}):?(\d{2})$/);
    if (!match) throw new Error('Use timezone offset like +05:00 or -04:00.');
    const minutes = Number(match[2]) * 60 + Number(match[3]);
    return match[1] === '-' ? -minutes : minutes;
  }
  private clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, Math.round(value))); }
}
