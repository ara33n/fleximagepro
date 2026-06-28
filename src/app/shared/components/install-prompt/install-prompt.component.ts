import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PwaInstallService } from '../../../core/services/pwa-install.service';

@Component({
  selector: 'app-install-prompt',
  standalone: true,
  templateUrl: './install-prompt.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallPromptComponent {
  protected readonly installPrompt = inject(PwaInstallService);
}
