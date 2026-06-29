import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { generateToolSeo } from '../../../core/content/generated-tool-seo';
import { ToolCatalogCategory, ToolCatalogItem } from '../../../core/content/tool-catalog';

@Component({
  selector: 'app-tool-seo-block',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './tool-seo-block.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
