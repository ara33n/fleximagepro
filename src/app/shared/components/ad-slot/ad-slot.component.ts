import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-ad-slot',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdSlotComponent {
  readonly label = input.required<string>();
  readonly adSlot = input<string>('');
}
