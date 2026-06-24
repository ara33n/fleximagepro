import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [],
  templateUrl: './terms-of-service.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsOfServiceComponent {
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.update(
      'Terms of Service | FlexImagePro',
      'Terms and conditions for using FlexImagePro image tools.',
    );
  }
}
