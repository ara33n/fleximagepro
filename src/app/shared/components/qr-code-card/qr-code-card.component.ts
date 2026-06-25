import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-qr-code-card',
  standalone: true,
  templateUrl: './qr-code-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrCodeCardComponent {
  readonly qrCodeDataUrl = input.required<string>();
  readonly title = input('Share QR code');
  readonly description = input('Scan to open this shared file link.');
  readonly download = output<void>();
}
