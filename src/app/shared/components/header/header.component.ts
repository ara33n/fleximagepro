import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';

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
  readonly menuOpen = signal(false);

  readonly links = [
    { label: 'Compress', path: '/compress' },
    { label: 'WebP', path: '/convert-webp' },
    { label: 'Resize', path: '/resize' },
    { label: 'JPG / PNG', path: '/jpg-to-png' },
    { label: 'PNG → SVG', path: '/png-to-svg' },
  ];

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  navigate(path: string): void {
    this.menuOpen.set(false);
    void this.router.navigateByUrl(path);
  }

  trackByPath(_: number, item: { path: string }): string {
    return item.path;
  }
}
