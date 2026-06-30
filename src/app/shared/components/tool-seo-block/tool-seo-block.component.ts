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
        style({ height: 0, opacity: 0 }),
        animate('260ms cubic-bezier(0.4,0,0.2,1)', style({ height: '*', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.4,0,0.2,1)', style({ height: 0, opacity: 0 })),
      ]),
    ]),
  ],
})
export class ToolSeoBlockComponent {
  readonly item = input.required<ToolCatalogItem>();
  readonly category = input.required<ToolCatalogCategory>();
  readonly content = computed(() => generateToolSeo(this.item(), this.category()));
  readonly depthSections = computed(() => {
    const item = this.item();
    const category = this.category();
    const keyword = item.label;
    const categoryName = category.title.toLowerCase();
    const related = this.content().relatedTools.slice(0, 4).map((tool) => tool.label);
    const relatedText = related.length ? related.join(', ') : `other ${categoryName} pages`;

    return [
      {
        heading: `${keyword} workflow guide`,
        paragraphs: [
          `${keyword} is most useful when the input, settings, and final output all match the job you are trying to finish. Start with the smallest complete example you can test, check the preview or generated result carefully, and then repeat the same settings for the full task. This approach keeps everyday work faster because you can catch formatting mistakes, missing values, broken URLs, invalid code, or unsuitable export settings before they affect a larger batch or a live project.`,
          `For professional use, treat the result as a ready-to-review draft rather than a black-box answer. If the page creates code, schema, color values, map data, text output, PDF content, or image files, compare it with the requirement from your CMS, design tool, client brief, app, or search platform. A quick review of labels, numbers, casing, file names, page order, units, dimensions, and links usually prevents the small errors that slow down publishing later.`,
        ],
      },
      {
        heading: `Quality checks before using ${keyword}`,
        paragraphs: [
          `Before copying or downloading the result, confirm that the output is complete and fits the destination where it will be used. Website owners should check titles, URLs, metadata, schema fields, redirects, and crawl hints. Designers should check colors, dimensions, contrast, image clarity, and spacing. Developers should validate formatting, escaping, indentation, hashes, tokens, or generated CSS before pasting it into production code.`,
          `If the page offers options, change one setting at a time so the effect is easy to understand. This is especially helpful for converters, calculators, generators, GIS tools, and developer utilities where two similar controls can produce different output. After the result looks right, use the related tools on this page to complete the next step, such as formatting data, generating a supporting file, checking color accessibility, or preparing a cleaner download.`,
        ],
      },
      {
        heading: `How ${keyword} fits into ${category.title}`,
        paragraphs: [
          `${category.title} often includes several connected jobs, and ${keyword} is one part of that larger workflow. A search task may need metadata, robots rules, sitemap files, and structured data. A developer task may need formatting, validation, minification, encoding, and decoding. A design task may need colors, gradients, shadows, responsive sizing, and accessible contrast. Keeping these steps close together makes it easier to move from a rough input to a finished result without switching websites.`,
          `Useful nearby tools for this workflow include ${relatedText}. Open the tool that matches the next action instead of repeating work manually. For example, after generating structured content you may need to validate JSON, after creating a color you may need to check contrast, and after building a map shape you may need to export KML or GeoJSON. FlexImagePro keeps those related steps discoverable so each page can support a complete task, not just a single button click.`,
        ],
      },
      {
        heading: `Common use cases for ${keyword}`,
        paragraphs: [
          `People usually open ${keyword} when they are trying to finish a practical job quickly: preparing content for a website, cleaning data for a document, checking a value before publishing, creating a file for a client, or generating code that can be pasted into another tool. The page is written to support that direct intent, so the main controls stay close to the top while the guidance below explains what to check and why each option matters.`,
          `If you are comparing multiple outputs, save the version that has the clearest name and the least extra work required later. For text and code results, copy the output into the destination and test it there. For visual, PDF, color, map, or generator results, inspect the preview at the size where it will be used. A result that looks correct in the tool should still be confirmed inside the real page, app, presentation, listing, or report.`,
        ],
      },
      {
        heading: `${keyword} accuracy and publishing tips`,
        paragraphs: [
          `Accuracy depends on both the input and the final review. Use complete URLs instead of partial domains, include required units for measurements, check decimal points in calculator and GIS tools, keep capitalization consistent for text tools, and validate generated markup before adding it to a production website. Small input details can change the output, especially on pages that generate structured data, hashes, coordinates, styles, or downloadable files.`,
          `When the result will be published online, also think about search, accessibility, and user experience. Clear names, readable values, valid formats, meaningful headings, crawlable content, and accessible colors make generated output easier for both people and search engines to understand. This is why FlexImagePro pages combine a working tool with supporting guidance, FAQs, related links, and structured page data instead of presenting a bare form with no context.`,
        ],
      },
    ];
  });
  readonly openFaq = signal<number | null>(0);

  toggleFaq(index: number): void {
    this.openFaq.update((current) => current === index ? null : index);
  }
}
