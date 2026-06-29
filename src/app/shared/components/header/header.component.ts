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
import { filter } from 'rxjs';
import { TOOL_CATEGORIES, ToolCatalogCategory, ToolCatalogItem } from '../../../core/content/tool-catalog';
import { ThemeService } from '../../../core/services/theme.service';

interface SearchResult {
  item: ToolCatalogItem;
  category: ToolCatalogCategory;
  score: number;
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
  readonly activePath = signal(this.cleanPath(this.router.url));
  readonly activeDesktopCategory = signal<string | null>(null);
  readonly activeMoreCategory = signal<string | null>(null);
  readonly openMobileCategory = signal<string | null>('Image Tools');
  readonly searchQuery = signal('');
  readonly searchOpen = signal(false);
  readonly activeSearchIndex = signal(0);
  readonly categories = TOOL_CATEGORIES;
  readonly primaryCategories = TOOL_CATEGORIES.slice(0, 4);
  readonly moreCategories = TOOL_CATEGORIES.slice(4);
  readonly liveTools = TOOL_CATEGORIES.flatMap((category) => category.tools
    .filter((item) => item.live)
    .map((item) => ({ item, category })));
  readonly searchResults = computed<SearchResult[]>(() => {
    const query = this.normalizeSearch(this.searchQuery());
    if (!query) return [];
    const terms = query.split(' ').filter(Boolean);
    return this.liveTools
      .map(({ item, category }) => {
        const haystack = this.normalizeSearch(`${item.label} ${item.slug} ${item.description} ${category.title}`);
        const label = this.normalizeSearch(item.label);
        const slug = this.normalizeSearch(item.slug);
        let score = 0;
        if (label === query || slug === query) score += 120;
        if (label.includes(query)) score += 80;
        if (slug.includes(query)) score += 65;
        if (haystack.includes(query)) score += 45;
        for (const term of terms) {
          if (label.includes(term)) score += 18;
          else if (slug.includes(term)) score += 14;
          else if (haystack.includes(term)) score += 8;
        }
        if (terms.every((term) => haystack.includes(term))) score += 30;
        return { item, category, score };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .slice(0, 10);
  });

  readonly links = [
    { label: 'Home', path: '/' },
  ];

  @ViewChild('toolSearchInput') private readonly toolSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChildren('searchResultButton') private readonly searchResultButtons?: QueryList<ElementRef<HTMLElement>>;

  constructor() {
    effect((onCleanup) => {
      if (typeof window === 'undefined') {
        return;
      }

      const shouldLockScroll = this.menuOpen() || this.searchOpen() || this.activeDesktopCategory() !== null;
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
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.activePath.set(this.cleanPath(event.urlAfterRedirects));
        this.openMobileCategory.set(this.activeCategoryTitle() ?? 'Image Tools');
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
    this.menuOpen.update((v) => {
      if (!v) {
        this.openMobileCategory.set(this.activeCategoryTitle() ?? 'Image Tools');
      }
      return !v;
    });
    this.activeDesktopCategory.set(null);
    this.closeSearch();
  }

  openDesktopCategory(title: string): void {
    this.activeDesktopCategory.set(title);
    if (title === 'More Tools' && !this.activeMoreCategory()) {
      this.activeMoreCategory.set(this.activeMoreCategoryTitle() ?? this.moreCategories[0]?.title ?? null);
    }
  }

  toggleDesktopCategory(event: MouseEvent, title: string): void {
    event.stopPropagation();
    this.activeDesktopCategory.update((current) => (current === title ? null : title));
  }

  closeDesktopCategory(): void {
    this.activeDesktopCategory.set(null);
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
    this.menuOpen.set(false);
    this.activeDesktopCategory.set(null);
    this.closeSearch();
    void this.router.navigateByUrl(path);
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.searchOpen.set(true);
    this.activeDesktopCategory.set(null);
    this.activeSearchIndex.set(0);
  }

  onSearchFocus(): void {
    this.searchOpen.set(true);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const results = this.searchResults();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!results.length) return;
      this.searchOpen.set(true);
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
    this.searchOpen.set(false);
    this.activeSearchIndex.set(0);
  }

  openSearch(): void {
    this.menuOpen.set(false);
    this.activeDesktopCategory.set(null);
    this.searchOpen.set(true);
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
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private scrollActiveSearchResult(): void {
    window.setTimeout(() => {
      const button = this.searchResultButtons?.get(this.activeSearchIndex())?.nativeElement;
      button?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }
}
