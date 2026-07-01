import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  QueryList,
  ViewChild,
  ViewChildren,
  inject,
  signal,
  effect,
  computed,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TOOL_CATEGORIES, ToolCatalogCategory, ToolCatalogItem } from '../../../core/content/tool-catalog';
import { ThemeService } from '../../../core/services/theme.service';

interface SearchResult {
  item: ToolCatalogItem;
  category: ToolCatalogCategory;
  score: number;
  reason: string;
  matchedTerms: string[];
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);
  readonly menuOpen = signal(false);
  readonly menuVisible = signal(false);
  readonly menuClosing = signal(false);
  readonly activePath = signal(this.cleanPath(this.router.url));
  readonly activeDesktopCategory = signal<string | null>(null);
  readonly visibleDesktopCategory = signal<string | null>(null);
  readonly desktopCategoryClosing = signal(false);
  readonly activeMoreCategory = signal<string | null>(null);
  readonly openMobileCategory = signal<string | null>('Image Tools');
  readonly searchQuery = signal('');
  readonly searchOpen = signal(false);
  readonly searchVisible = signal(false);
  readonly searchClosing = signal(false);
  readonly activeSearchIndex = signal(0);
  readonly categories = TOOL_CATEGORIES;
  readonly primaryCategories = TOOL_CATEGORIES.slice(0, 4);
  readonly moreCategories = TOOL_CATEGORIES.slice(4);
  readonly liveTools = TOOL_CATEGORIES.flatMap((category) => category.tools
    .filter((item) => item.live)
    .map((item) => ({ item, category })));
  readonly quickSearches = [
    'compress image',
    'pdf to images',
    'qr code',
    'json formatter',
    'sitemap',
    'kml circle',
  ];
  private menuCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private searchCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private desktopCloseTimer: ReturnType<typeof setTimeout> | null = null;
  readonly searchResults = computed<SearchResult[]>(() => {
    const rawQuery = this.searchQuery();
    const query = this.normalizeSearch(rawQuery);
    if (!query) return [];
    const terms = query.split(' ').filter(Boolean);
    const queryCompact = this.compact(query);
    const queryAcronym = this.acronym(query);
    return this.liveTools
      .map(({ item, category }) => {
        const aliases = this.searchAliases(item, category);
        const haystack = this.normalizeSearch(`${item.label} ${item.slug} ${item.description} ${category.title} ${aliases.join(' ')}`);
        const label = this.normalizeSearch(item.label);
        const slug = this.normalizeSearch(item.slug);
        const categoryTitle = this.normalizeSearch(category.title);
        const words = haystack.split(' ').filter(Boolean);
        const labelWords = label.split(' ').filter(Boolean);
        const slugWords = slug.split(' ').filter(Boolean);
        const haystackCompact = this.compact(haystack);
        const labelCompact = this.compact(label);
        const slugCompact = this.compact(slug);
        const categoryCompact = this.compact(categoryTitle);
        const labelAcronym = this.acronym(label);
        const slugAcronym = this.acronym(slug);
        const categoryAcronym = this.acronym(categoryTitle);
        const matchedTerms = new Set<string>();
        let score = 0;
        let reason = 'Related match';

        if (label === query || slug === query) {
          score += 200;
          reason = 'Exact tool match';
        }
        if (labelCompact === queryCompact || slugCompact === queryCompact) {
          score += 180;
          reason = 'Exact compact match';
        }
        if (label.startsWith(query) || slug.startsWith(query)) {
          score += 120;
          reason = 'Starts with your search';
        }
        if (label.includes(query)) {
          score += 95;
          reason = 'Tool name match';
        }
        if (slug.includes(query)) {
          score += 80;
          reason = 'URL match';
        }
        if (haystack.includes(query)) {
          score += 60;
          reason = reason === 'Related match' ? 'Phrase match' : reason;
        }
        if (queryCompact.length >= 3 && (labelCompact.includes(queryCompact) || slugCompact.includes(queryCompact) || haystackCompact.includes(queryCompact))) {
          score += 70;
          reason = reason === 'Related match' ? 'No-space match' : reason;
        }
        if (queryAcronym.length >= 2 && (labelAcronym.includes(queryAcronym) || slugAcronym.includes(queryAcronym) || categoryAcronym.includes(queryAcronym))) {
          score += 55;
          reason = reason === 'Related match' ? 'Initials match' : reason;
        }
        for (const term of terms) {
          const bestWordDistance = this.bestDistance(term, words);
          const isTypoMatch = term.length >= 4 && bestWordDistance <= (term.length > 7 ? 2 : 1);

          if (labelWords.some((word) => word === term) || slugWords.some((word) => word === term)) {
            score += 34;
            matchedTerms.add(term);
          } else if (label.includes(term)) {
            score += 26;
            matchedTerms.add(term);
          } else if (slug.includes(term)) {
            score += 22;
            matchedTerms.add(term);
          } else if (categoryTitle.includes(term)) {
            score += 18;
            matchedTerms.add(term);
          } else if (haystack.includes(term)) {
            score += 12;
            matchedTerms.add(term);
          } else if (isTypoMatch) {
            score += 16;
            matchedTerms.add(term);
            reason = reason === 'Related match' ? 'Typo-tolerant match' : reason;
          } else if (this.isSubsequence(term, labelCompact) || this.isSubsequence(term, slugCompact)) {
            score += 9;
            matchedTerms.add(term);
          }
        }
        if (terms.length > 1 && terms.every((term) => matchedTerms.has(term))) {
          score += 45;
          reason = reason === 'Related match' ? 'All words matched' : reason;
        }
        score += this.orderBoost(terms, haystack) * 8;
        return { item, category, score, reason, matchedTerms: [...matchedTerms] };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .slice(0, 14);
  });

  readonly links = [
    { label: 'Home', path: '/' },
    { label: 'Blog', path: '/blog' },
  ];

  @ViewChild('toolSearchInput') private readonly toolSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChildren('searchResultButton') private readonly searchResultButtons?: QueryList<ElementRef<HTMLElement>>;

  constructor() {
    effect((onCleanup) => {
      if (typeof window === 'undefined') {
        return;
      }

      const shouldLockScroll = this.menuVisible() || this.searchVisible() || this.visibleDesktopCategory() !== null;
      const body = this.document.body;
      const previousOverflow = body.style.overflow;
      const previousPaddingRight = body.style.paddingRight;

      if (shouldLockScroll) {
        const scrollbarWidth = window.innerWidth - this.document.documentElement.clientWidth;
        body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
          body.style.paddingRight = `${scrollbarWidth}px`;
        }
      }

      onCleanup(() => {
        body.style.overflow = previousOverflow;
        body.style.paddingRight = previousPaddingRight;
      });
    });

    this.router.events
      .subscribe((event) => {
        if (!(event instanceof NavigationEnd)) return;
        this.activePath.set(this.cleanPath(event.urlAfterRedirects));
        this.openMobileCategory.set(this.activeCategoryTitle() ?? 'Image Tools');
        this.closeMenu();
        this.closeDesktopCategory();
        this.closeSearch();
      });
  }

  @HostListener('document:click', ['$event'])
  closeToolsOnOutsideClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.activeDesktopCategory.set(null);
      this.closeSearch();
    }
  }

  toggleMenu(): void {
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    this.openMenu();
  }

  openMenu(): void {
    this.clearMenuCloseTimer();
    this.menuOpen.set(true);
    this.menuVisible.set(true);
    this.menuClosing.set(false);
    this.openMobileCategory.set(this.activeCategoryTitle() ?? 'Image Tools');
    this.activeDesktopCategory.set(null);
    this.closeSearch();
  }

  closeMenu(): void {
    if (!this.menuVisible() && !this.menuOpen()) return;
    this.menuOpen.set(false);
    this.menuClosing.set(true);
    this.clearMenuCloseTimer();
    this.menuCloseTimer = setTimeout(() => {
      this.menuVisible.set(false);
      this.menuClosing.set(false);
      this.menuCloseTimer = null;
    }, 230);
  }

  openDesktopCategory(title: string): void {
    this.clearDesktopCloseTimer();
    this.activeDesktopCategory.set(title);
    this.visibleDesktopCategory.set(title);
    this.desktopCategoryClosing.set(false);
    if (title === 'More Tools' && !this.activeMoreCategory()) {
      this.activeMoreCategory.set(this.activeMoreCategoryTitle() ?? this.moreCategories[0]?.title ?? null);
    }
  }

  toggleDesktopCategory(event: MouseEvent, title: string): void {
    event.stopPropagation();
    if (this.activeDesktopCategory() === title) {
      this.closeDesktopCategory();
      return;
    }
    this.openDesktopCategory(title);
  }

  closeDesktopCategory(): void {
    if (!this.visibleDesktopCategory() && !this.activeDesktopCategory()) return;
    this.activeDesktopCategory.set(null);
    this.desktopCategoryClosing.set(true);
    this.clearDesktopCloseTimer();
    this.desktopCloseTimer = setTimeout(() => {
      this.visibleDesktopCategory.set(null);
      this.desktopCategoryClosing.set(false);
      this.desktopCloseTimer = null;
    }, 170);
  }

  openMoreCategory(title: string): void {
    this.activeMoreCategory.set(title);
  }

  isToolActive(item: ToolCatalogItem): boolean {
    return item.live === true && this.activePath() === item.route;
  }

  isCategoryActive(category: ToolCatalogCategory): boolean {
    return category.tools.some((item) => this.isToolActive(item));
  }

  isMoreToolsActive(): boolean {
    return this.moreCategories.some((category) => this.isCategoryActive(category));
  }

  activeMoreToolsCategory(): ToolCatalogCategory | undefined {
    return this.moreCategories.find((category) => category.title === this.activeMoreCategory()) ?? this.moreCategories[0];
  }

  activeCategoryTitle(): string | null {
    return this.categories.find((category) => this.isCategoryActive(category))?.title ?? null;
  }

  activeMoreCategoryTitle(): string | null {
    return this.moreCategories.find((category) => this.isCategoryActive(category))?.title ?? null;
  }

  toggleMobileCategory(title: string): void {
    this.openMobileCategory.update((current) => (current === title ? null : title));
  }

  navigate(path: string): void {
    this.closeMenu();
    this.closeDesktopCategory();
    this.closeSearch();
    void this.router.navigateByUrl(path);
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.showSearch();
    this.closeDesktopCategory();
    this.activeSearchIndex.set(0);
  }

  useQuickSearch(query: string): void {
    this.searchQuery.set(query);
    this.showSearch();
    this.activeSearchIndex.set(0);
    window.setTimeout(() => this.toolSearchInput?.nativeElement.focus(), 0);
  }

  onSearchFocus(): void {
    this.showSearch();
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const results = this.searchResults();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!results.length) return;
      this.showSearch();
      this.activeSearchIndex.update((index) => Math.min(results.length - 1, index + 1));
      this.scrollActiveSearchResult();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!results.length) return;
      this.activeSearchIndex.update((index) => Math.max(0, index - 1));
      this.scrollActiveSearchResult();
      return;
    }
    if (event.key === 'Enter') {
      const result = results[this.activeSearchIndex()] ?? results[0];
      if (result) {
        event.preventDefault();
        this.navigate(result.item.route);
      }
      return;
    }
    if (event.key === 'Escape') {
      this.closeSearch();
    }
  }

  chooseSearchResult(result: SearchResult): void {
    this.navigate(result.item.route);
  }

  isSearchResultActive(index: number): boolean {
    return this.activeSearchIndex() === index;
  }

  closeSearch(): void {
    if (!this.searchVisible() && !this.searchOpen()) return;
    this.searchOpen.set(false);
    this.activeSearchIndex.set(0);
    this.searchClosing.set(true);
    this.clearSearchCloseTimer();
    this.searchCloseTimer = setTimeout(() => {
      this.searchVisible.set(false);
      this.searchClosing.set(false);
      this.searchCloseTimer = null;
    }, 210);
  }

  openSearch(): void {
    this.closeMenu();
    this.closeDesktopCategory();
    this.showSearch();
    window.setTimeout(() => this.toolSearchInput?.nativeElement.focus(), 0);
  }

  trackByPath(_: number, item: { path: string }): string {
    return item.path;
  }

  trackByCategory(_: number, category: ToolCatalogCategory): string {
    return category.title;
  }

  trackByTool(index: number, item: ToolCatalogItem): string {
    return `${item.slug}-${index}`;
  }

  private cleanPath(path: string): string {
    return path.split('?')[0].split('#')[0];
  }

  private normalizeSearch(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\+/g, ' plus ')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private compact(value: string): string {
    return value.replace(/\s+/g, '');
  }

  private acronym(value: string): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join('');
  }

  private showSearch(): void {
    this.clearSearchCloseTimer();
    this.searchOpen.set(true);
    this.searchVisible.set(true);
    this.searchClosing.set(false);
  }

  private clearMenuCloseTimer(): void {
    if (this.menuCloseTimer) {
      clearTimeout(this.menuCloseTimer);
      this.menuCloseTimer = null;
    }
  }

  private clearSearchCloseTimer(): void {
    if (this.searchCloseTimer) {
      clearTimeout(this.searchCloseTimer);
      this.searchCloseTimer = null;
    }
  }

  private clearDesktopCloseTimer(): void {
    if (this.desktopCloseTimer) {
      clearTimeout(this.desktopCloseTimer);
      this.desktopCloseTimer = null;
    }
  }

  private searchAliases(item: ToolCatalogItem, category: ToolCatalogCategory): string[] {
    const base = this.normalizeSearch(`${item.label} ${item.slug} ${category.title}`);
    const aliases = new Set<string>();
    const add = (...values: string[]) => values.forEach((value) => aliases.add(value));

    if (base.includes('jpg') || base.includes('jpeg')) add('jpeg photo picture');
    if (base.includes('png')) add('transparent image picture');
    if (base.includes('webp')) add('web p next gen image');
    if (base.includes('pdf')) add('document file pages');
    if (base.includes('qr')) add('qrcode quick response scan wifi vcard business card');
    if (base.includes('barcode')) add('bar code ean upc code128 product code');
    if (base.includes('json')) add('javascript object data api pretty print');
    if (base.includes('xml')) add('markup data');
    if (base.includes('jwt')) add('token claims header payload decode');
    if (base.includes('kml') || base.includes('gis') || base.includes('map')) add('map coordinates latitude longitude geo geographic');
    if (base.includes('sitemap')) add('site map xml crawl routes pages');
    if (base.includes('robots')) add('robot txt crawler googlebot disallow allow');
    if (base.includes('schema')) add('structured data rich results json ld');
    if (base.includes('color') || base.includes('hex') || base.includes('rgb') || base.includes('hsl')) add('colour palette picker contrast');
    if (base.includes('compress')) add('reduce optimize smaller size');
    if (base.includes('resize')) add('dimensions width height crop scale');
    if (base.includes('metadata')) add('exif info details properties');
    if (base.includes('dpi')) add('ppi resolution print density');
    if (base.includes('base64')) add('b64 encode decode data uri');
    return [...aliases];
  }

  private bestDistance(term: string, words: string[]): number {
    let best = Number.POSITIVE_INFINITY;
    for (const word of words) {
      if (Math.abs(word.length - term.length) > 2) continue;
      best = Math.min(best, this.levenshtein(term, word));
      if (best === 0) return 0;
    }
    return best;
  }

  private levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = Array.from({ length: b.length + 1 }, () => 0);
    for (let i = 1; i <= a.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      }
      previous.splice(0, previous.length, ...current);
    }
    return previous[b.length];
  }

  private isSubsequence(needle: string, haystack: string): boolean {
    if (needle.length < 3) return false;
    let index = 0;
    for (const char of haystack) {
      if (char === needle[index]) index += 1;
      if (index === needle.length) return true;
    }
    return false;
  }

  private orderBoost(terms: string[], haystack: string): number {
    let lastIndex = -1;
    let boost = 0;
    for (const term of terms) {
      const index = haystack.indexOf(term, lastIndex + 1);
      if (index === -1) return boost;
      boost += 1;
      lastIndex = index;
    }
    return boost;
  }

  private scrollActiveSearchResult(): void {
    window.setTimeout(() => {
      const button = this.searchResultButtons?.get(this.activeSearchIndex())?.nativeElement;
      button?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }
}
