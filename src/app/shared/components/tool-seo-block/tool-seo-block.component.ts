import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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
}
