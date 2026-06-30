import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { RouterLink } from '@angular/router';
import { generateToolSeo } from '../../../core/content/generated-tool-seo';
import { ToolCatalogCategory, ToolCatalogItem } from '../../../core/content/tool-catalog';

@Component({
  selector: 'app-tool-seo-block',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './tool-seo-block.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ height: 0, opacity: 0, overflow: 'hidden' }),
        animate('260ms cubic-bezier(0.4,0,0.2,1)', style({ height: '*', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.4,0,0.2,1)', style({ height: 0, opacity: 0, overflow: 'hidden' })),
      ]),
    ]),
  ],
})
export class ToolSeoBlockComponent {
  readonly item = input.required<ToolCatalogItem>();
  readonly category = input.required<ToolCatalogCategory>();
  readonly content = computed(() => generateToolSeo(this.item(), this.category()));
  readonly openFaq = signal<number | null>(0);

  toggleFaq(index: number): void {
    this.openFaq.update((current) => current === index ? null : index);
  }
}
