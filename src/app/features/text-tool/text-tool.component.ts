import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TOOL_CATEGORIES, findToolBySlug, ToolCatalogItem } from '../../core/content/tool-catalog';
import { findCategoryForTool, generateToolSeo } from '../../core/content/generated-tool-seo';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { ToolSeoBlockComponent } from '../../shared/components/tool-seo-block/tool-seo-block.component';

type TextToolKind =
  | 'word-counter'
  | 'character-counter'
  | 'text-compare'
  | 'text-repeater'
  | 'random-text-generator'
  | 'remove-duplicate-lines'
  | 'remove-empty-lines'
  | 'remove-extra-spaces'
  | 'sort-lines'
  | 'reverse-text'
  | 'case-converter'
  | 'slug-generator';

interface ResultRow {
  label: string;
  value: string;
}

const SAMPLE_TEXT = 'Paste or type your text here.';
const WORD_BANK = [
  'image', 'tool', 'quick', 'clean', 'browser', 'local', 'format', 'simple', 'smart', 'pixel',
  'copy', 'create', 'text', 'online', 'private', 'fast', 'modern', 'useful', 'clear', 'flex',
];

@Component({
  selector: 'app-text-tool',
  standalone: true,
  imports: [ToolSeoBlockComponent],
  templateUrl: './text-tool.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextToolComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);

  readonly slug = this.route.snapshot.data['slug'] as TextToolKind;
  readonly kind = this.slug;
  readonly category = findCategoryForTool(this.slug) ?? TOOL_CATEGORIES[0];
  readonly catalogItem = signal<ToolCatalogItem>(
    findToolBySlug(this.slug) ?? {
      label: 'Text Tool',
      slug: this.slug,
      route: `/${this.slug}`,
      description: 'Free text tool.',
    },
  );

  readonly input = signal('');
  readonly compareInput = signal('');
  readonly output = signal('');
  readonly rows = signal<ResultRow[]>([]);
  readonly error = signal<string | null>(null);

  readonly repeatCount = signal(5);
  readonly repeatSeparator = signal('newline');
  readonly randomCount = signal(80);
  readonly randomMode = signal('words');
  readonly sortDirection = signal('asc');
  readonly caseMode = signal('sentence');
  readonly reverseMode = signal('characters');
  readonly slugSeparator = signal('-');

  readonly needsInput = computed(() => this.kind !== 'random-text-generator');
  readonly needsCompareInput = computed(() => this.kind === 'text-compare');
  readonly hasOptions = computed(() => [
    'text-repeater',
    'random-text-generator',
    'sort-lines',
    'reverse-text',
    'case-converter',
    'slug-generator',
  ].includes(this.kind));
  readonly hasOutputText = computed(() => Boolean(this.output()));
  readonly inputLabel = computed(() => this.kind === 'text-compare' ? 'First text' : 'Input text');
  readonly outputTitle = computed(() => {
    if (this.kind === 'word-counter' || this.kind === 'character-counter') return 'Details';
    if (this.kind === 'text-compare') return 'Comparison';
    return 'Output';
  });

  ngOnInit(): void {
    const item = this.catalogItem();
    const seoContent = generateToolSeo(item, this.category);
    this.seo.update(seoContent.title, seoContent.metaDescription);
    this.seo.updateFaqSchema(seoContent.faqs);
    this.seo.updateBreadcrumbSchema(seoContent.breadcrumb);
    if (this.kind === 'random-text-generator') {
      this.process();
    }
  }

  updateInput(event: Event): void {
    this.input.set((event.target as HTMLTextAreaElement).value);
  }

  updateCompareInput(event: Event): void {
    this.compareInput.set((event.target as HTMLTextAreaElement).value);
  }

  updateNumber(signalRef: { set(value: number): void }, event: Event): void {
    signalRef.set(Number((event.target as HTMLInputElement).value));
  }

  process(): void {
    this.error.set(null);
    const text = this.input();
    if (this.needsInput() && !text.trim() && !['remove-empty-lines', 'remove-extra-spaces'].includes(this.kind)) {
      this.error.set('Please enter some text first.');
      this.output.set('');
      this.rows.set([]);
      return;
    }

    switch (this.kind) {
      case 'word-counter':
        this.countWords(text);
        break;
      case 'character-counter':
        this.countCharacters(text);
        break;
      case 'text-compare':
        this.compareText(text, this.compareInput());
        break;
      case 'text-repeater':
        this.output.set(this.repeatText(text));
        this.rows.set([{ label: 'Repeated', value: `${this.repeatCount()} time${this.repeatCount() === 1 ? '' : 's'}` }]);
        break;
      case 'random-text-generator':
        this.output.set(this.randomText());
        this.rows.set([{ label: 'Generated', value: `${this.randomCount()} ${this.randomMode()}` }]);
        break;
      case 'remove-duplicate-lines':
        this.output.set(this.removeDuplicateLines(text));
        break;
      case 'remove-empty-lines':
        this.output.set(text.split(/\r?\n/).filter((line) => line.trim()).join('\n'));
        break;
      case 'remove-extra-spaces':
        this.output.set(text.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim());
        break;
      case 'sort-lines':
        this.output.set(this.sortLines(text));
        break;
      case 'reverse-text':
        this.output.set(this.reverseText(text));
        break;
      case 'case-converter':
        this.output.set(this.convertCase(text));
        break;
      case 'slug-generator':
        this.output.set(this.slugify(text));
        break;
    }

    if (!['word-counter', 'character-counter', 'text-compare', 'text-repeater', 'random-text-generator'].includes(this.kind)) {
      this.rows.set(this.transformRows(text, this.output()));
    }
  }

  clear(): void {
    this.input.set('');
    this.compareInput.set('');
    this.output.set('');
    this.rows.set([]);
    this.error.set(null);
  }

  loadSample(): void {
    this.input.set(SAMPLE_TEXT);
    if (this.kind === 'text-compare') {
      this.compareInput.set('Paste or type your changed text here.');
    }
    this.process();
  }

  async copyOutput(): Promise<void> {
    const text = this.output() || this.rows().map((row) => `${row.label}: ${row.value}`).join('\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success('Copied to clipboard.');
    } catch {
      this.toast.error('Copy failed. Select and copy manually.');
    }
  }

  downloadOutput(): void {
    const text = this.output() || this.rows().map((row) => `${row.label}: ${row.value}`).join('\n');
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.slug}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private countWords(text: string): void {
    const words = text.trim().match(/\S+/g) ?? [];
    const sentences = text.split(/[.!?]+/).filter((item) => item.trim()).length;
    const paragraphs = text.split(/\n\s*\n/).filter((item) => item.trim()).length;
    this.rows.set([
      { label: 'Words', value: words.length.toLocaleString() },
      { label: 'Characters', value: text.length.toLocaleString() },
      { label: 'Characters without spaces', value: text.replace(/\s/g, '').length.toLocaleString() },
      { label: 'Sentences', value: sentences.toLocaleString() },
      { label: 'Paragraphs', value: paragraphs.toLocaleString() },
      { label: 'Reading time', value: `${Math.max(1, Math.ceil(words.length / 200))} min` },
    ]);
    this.output.set('');
  }

  private countCharacters(text: string): void {
    this.rows.set([
      { label: 'Characters', value: text.length.toLocaleString() },
      { label: 'Characters without spaces', value: text.replace(/\s/g, '').length.toLocaleString() },
      { label: 'Spaces', value: (text.match(/ /g) ?? []).length.toLocaleString() },
      { label: 'Lines', value: text ? text.split(/\r?\n/).length.toLocaleString() : '0' },
      { label: 'Bytes', value: new Blob([text]).size.toLocaleString() },
    ]);
    this.output.set('');
  }

  private compareText(left: string, right: string): void {
    const leftLines = left.split(/\r?\n/);
    const rightLines = right.split(/\r?\n/);
    const max = Math.max(leftLines.length, rightLines.length);
    let changed = 0;
    const diff: string[] = [];
    for (let index = 0; index < max; index++) {
      if ((leftLines[index] ?? '') === (rightLines[index] ?? '')) {
        diff.push(`  ${leftLines[index] ?? ''}`);
      } else {
        changed++;
        if (leftLines[index] !== undefined) diff.push(`- ${leftLines[index]}`);
        if (rightLines[index] !== undefined) diff.push(`+ ${rightLines[index]}`);
      }
    }
    this.rows.set([
      { label: 'First text lines', value: leftLines.filter((line) => line.length || left.length).length.toLocaleString() },
      { label: 'Second text lines', value: rightLines.filter((line) => line.length || right.length).length.toLocaleString() },
      { label: 'Changed line positions', value: changed.toLocaleString() },
      { label: 'Status', value: changed === 0 ? 'Texts match' : 'Differences found' },
    ]);
    this.output.set(diff.join('\n'));
  }

  private repeatText(text: string): string {
    const count = Math.max(1, Math.min(1000, Math.round(this.repeatCount())));
    const separator = this.repeatSeparator() === 'space' ? ' ' : this.repeatSeparator() === 'comma' ? ', ' : '\n';
    return Array.from({ length: count }, () => text).join(separator);
  }

  private randomText(): string {
    const count = Math.max(1, Math.min(1000, Math.round(this.randomCount())));
    if (this.randomMode() === 'sentences') {
      return Array.from({ length: count }, () => this.randomSentence()).join(' ');
    }
    if (this.randomMode() === 'paragraphs') {
      return Array.from({ length: count }, () => `${this.randomSentence()} ${this.randomSentence()} ${this.randomSentence()}`).join('\n\n');
    }
    return Array.from({ length: count }, () => WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)]).join(' ');
  }

  private randomSentence(): string {
    const length = 6 + Math.floor(Math.random() * 8);
    const words = Array.from({ length }, () => WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)]);
    const sentence = words.join(' ');
    return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
  }

  private removeDuplicateLines(text: string): string {
    const seen = new Set<string>();
    return text.split(/\r?\n/).filter((line) => {
      const key = line.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).join('\n');
  }

  private sortLines(text: string): string {
    const lines = text.split(/\r?\n/);
    lines.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    if (this.sortDirection() === 'desc') lines.reverse();
    return lines.join('\n');
  }

  private reverseText(text: string): string {
    if (this.reverseMode() === 'words') return text.split(/(\s+)/).reverse().join('');
    if (this.reverseMode() === 'lines') return text.split(/\r?\n/).reverse().join('\n');
    return Array.from(text).reverse().join('');
  }

  private convertCase(text: string): string {
    switch (this.caseMode()) {
      case 'upper':
        return text.toUpperCase();
      case 'lower':
        return text.toLowerCase();
      case 'title':
        return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
      case 'camel':
        return this.words(text).map((word, index) => index === 0 ? word.toLowerCase() : this.capitalize(word)).join('');
      case 'snake':
        return this.words(text).map((word) => word.toLowerCase()).join('_');
      default:
        return text.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (char) => char.toUpperCase());
    }
  }

  private slugify(text: string): string {
    return this.words(text.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''))
      .map((word) => word.toLowerCase())
      .join(this.slugSeparator());
  }

  private words(text: string): string[] {
    return text.match(/[a-zA-Z0-9]+/g) ?? [];
  }

  private capitalize(word: string): string {
    return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
  }

  private transformRows(input: string, output: string): ResultRow[] {
    return [
      { label: 'Input characters', value: input.length.toLocaleString() },
      { label: 'Output characters', value: output.length.toLocaleString() },
      { label: 'Lines', value: (output ? output.split(/\r?\n/).length : 0).toLocaleString() },
    ];
  }
}
