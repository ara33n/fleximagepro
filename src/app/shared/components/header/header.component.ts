import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { AdSlotComponent } from '../ad-slot/ad-slot.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AdSlotComponent],
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  readonly theme = inject(ThemeService);

  readonly links = [
    { label: 'Compress', path: '/compress' },
    { label: 'WebP', path: '/convert-webp' },
    { label: 'Resize', path: '/resize' },
    { label: 'JPG/PNG', path: '/jpg-to-png' },
  ];

  trackByPath(_: number, item: { path: string }): string {
    return item.path;
  }
}
