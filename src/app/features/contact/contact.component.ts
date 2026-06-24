import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [],
  templateUrl: './contact.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactComponent {
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.update(
      'Contact Us | FlexImagePro',
      'Contact FlexImagePro for support, feedback, or business inquiries.',
    );
  }
}
