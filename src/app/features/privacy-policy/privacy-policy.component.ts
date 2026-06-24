import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [],
  templateUrl: './privacy-policy.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPolicyComponent {
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.update(
      'Privacy Policy | FlexImagePro',
      'Learn how FlexImagePro protects your privacy. All image processing happens locally in your browser.',
    );
  }
}
