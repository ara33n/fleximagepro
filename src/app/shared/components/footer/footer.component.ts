import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TOOL_CATEGORIES } from '../../../core/content/tool-catalog';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  readonly year = new Date().getFullYear();
  readonly categories = TOOL_CATEGORIES.map((category) => ({
    title: category.title,
    icon: category.icon,
    count: category.tools.filter((tool) => tool.live).length,
    route: category.tools.find((tool) => tool.live)?.route ?? '/',
  }));
  readonly popularTools = [
    { label: 'Image Compressor', route: '/compress' },
    { label: 'PDF to Images', route: '/pdf-to-images' },
    { label: 'QR Code Generator', route: '/qr-code-generator' },
    { label: 'Sitemap Generator', route: '/sitemap-generator' },
    { label: 'JSON Formatter', route: '/json-formatter' },
    { label: 'KML Circle Generator', route: '/kml-circle-generator' },
  ];
}
