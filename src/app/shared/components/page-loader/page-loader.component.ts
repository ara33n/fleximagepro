import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageLoaderService } from '../../../core/services/page-loader.service';

@Component({
  selector: 'app-page-loader',
  standalone: true,
  templateUrl: './page-loader.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageLoaderComponent {
  readonly loader = inject(PageLoaderService);
}
