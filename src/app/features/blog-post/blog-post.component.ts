import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { BLOG_POSTS, BlogPost, findBlogPost } from '../../core/content/blog-content';
import { SeoService } from '../../core/services/seo.service';
import { environment } from '../../../environments/environment';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-blog-post',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './blog-post.component.html',
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
export class BlogPostComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  readonly post = signal<BlogPost | undefined>(findBlogPost(this.route.snapshot.data['slug'] ?? this.route.snapshot.paramMap.get('slug')));
  readonly openFaq = signal<number | null>(0);
  readonly relatedPosts = BLOG_POSTS.filter((post) => post.slug !== this.post()?.slug).slice(0, 3);
  readonly practicalSections = [
    {
      heading: 'Before you use the tool',
      paragraphs: [
        'Start with one real example before processing a full batch or publishing final output. A small test makes it easier to understand how the settings behave and whether the result matches the destination. Check file names, dimensions, page order, URLs, code formatting, color contrast, units, or generated fields before repeating the workflow at scale.',
        'Keep the original input available until the final output has been accepted by the place where it will be used. If a file upload portal rejects the result, a website layout needs a different size, or a validator reports an issue, you can return to the source and adjust the settings without rebuilding the entire task from memory.',
      ],
    },
    {
      heading: 'How to review the final result',
      paragraphs: [
        'Preview the result in context, not only inside the generator. Images should be checked at their real display size, PDFs should be opened after download, QR codes should be scanned from the final export, and structured data should be validated after it is added to the page. This final review catches problems that a tool preview cannot always reveal.',
        'If the output will be shared with clients, customers, search engines, upload portals, or another team member, use clear names and simple formats. A readable file name, clean page order, valid JSON, accurate metadata, or well-labeled generated code makes the result easier to trust and easier to fix later.',
      ],
    },
    {
      heading: 'Related workflow tips',
      paragraphs: [
        'Most web and file tasks are connected. After finishing this guide, you may need a second tool for the next step: compress an image after resizing it, generate schema after writing a page, create a sitemap after publishing new routes, or format JSON after decoding a token. Moving through related tools in order prevents repeated manual cleanup.',
        'Use the related guides and popular tools on this page as a workflow map. They are chosen to keep nearby tasks close together, so you can move from reading to creating, checking, downloading, and publishing without searching the entire site again.',
      ],
    },
    {
      heading: 'Publishing checklist',
      paragraphs: [
        'Before you publish or share the result, do one last check for readability, accuracy, and compatibility. Confirm that the output opens in the target app, the copied code stays valid after pasting, the generated file has the expected extension, and the final page or document still looks right on mobile and desktop.',
        'If the task affects SEO, performance, accessibility, or user trust, keep notes about the settings that worked. Those notes make repeat work faster when you return later to update another image, PDF, schema block, QR code, CSS snippet, JSON response, or sitemap file.',
      ],
    },
  ];

  constructor() {
    const post = this.post();
    if (!post) {
      void this.router.navigateByUrl('/blog', { replaceUrl: true });
      return;
    }

    this.seo.update(
      `${post.title} | FlexImagePro Blog`,
      post.metaDescription,
      post.tags.join(', '),
    );
    this.seo.updateFaqSchema(post.faqs);
    this.seo.updateBreadcrumbSchema([
      { name: 'Home', item: environment.siteUrl },
      { name: 'Blog', item: `${environment.siteUrl}/blog` },
      { name: post.title, item: `${environment.siteUrl}/blog/${post.slug}` },
    ]);
  }

  toggleFaq(index: number): void {
    this.openFaq.update((current) => current === index ? null : index);
  }

  trackByHeading(_: number, section: { heading: string }): string {
    return section.heading;
  }

  trackByParagraph(_: number, paragraph: string): string {
    return paragraph;
  }

  trackByPost(_: number, post: BlogPost): string {
    return post.slug;
  }

  trackByValue(_: number, value: string): string {
    return value;
  }
}
