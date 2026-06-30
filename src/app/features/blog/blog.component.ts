import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BLOG_POSTS, BlogPost } from '../../core/content/blog-content';
import { SeoService } from '../../core/services/seo.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './blog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogComponent {
  private readonly seo = inject(SeoService);

  readonly posts = BLOG_POSTS;
  readonly featuredPost = BLOG_POSTS[0];
  readonly categories = [...new Set(BLOG_POSTS.map((post) => post.category))];
  readonly editorialSections = [
    {
      heading: 'Why FlexImagePro publishes practical tool guides',
      paragraphs: [
        'FlexImagePro has many focused tools, but a tool is easier to use when the surrounding guidance explains the best settings, common mistakes, and next steps. The blog is designed for people who want to finish real work: compressing images for faster pages, merging PDFs in the right order, creating structured data for search engines, building QR codes that scan reliably, or cleaning developer data before it is pasted into a project.',
        'Each article connects directly to a matching tool because the goal is not only to read. The goal is to understand the workflow, open the correct page, test one example, preview the result, and download or copy a clean output. That structure helps beginners make better choices and gives experienced users a quick checklist before publishing.',
      ],
    },
    {
      heading: 'How to use these guides with the tool catalog',
      paragraphs: [
        'Start with the guide that matches your task, then follow the internal link to the related tool. If you are optimizing a website, you may read about image compression, convert files to WebP, generate a sitemap, create robots.txt, and add FAQ schema. If you are preparing documents, you may merge PDFs, convert images to PDF, export PDF pages as images, and check metadata before sending the file.',
        'The blog and catalog work together. Articles explain why a setting matters, while tool pages provide the actual controls, previews, downloads, and copy actions. This keeps the blog useful without turning every article into a long manual, and it keeps tool pages focused without removing the context search engines and users need.',
      ],
    },
    {
      heading: 'Best topics to learn first',
      paragraphs: [
        'For site owners, start with image compression, WebP conversion, sitemap generation, robots.txt, and schema guides. These topics affect discovery, speed, and search presentation. For designers and creators, start with JPG vs PNG vs WebP, QR code generation, color contrast, CSS shadows, gradients, and border radius. For developers, start with JSON formatting, JWT decoding, URL encoding, Base64, hashes, and minifiers.',
        'A good workflow usually combines several small utilities. For example, a product page may need compressed images, Open Graph tags, product schema, clean slugs, a QR code, and a final PDF spec sheet. Reading the guides in groups helps you understand how those tasks connect instead of treating every tool as an isolated button.',
      ],
    },
  ];

  constructor() {
    this.seo.update(
      'FlexImagePro Blog - Image, PDF, SEO and Tool Guides',
      'Read practical guides for image optimization, PDF workflows, SEO tools, QR codes, CSS generators, JSON formatting, and online utility workflows.',
      'FlexImagePro blog, image optimization guide, PDF tools guide, SEO guide, QR code guide, CSS tools, JSON formatter guide',
    );
    this.seo.updateBreadcrumbSchema([
      { name: 'Home', item: environment.siteUrl },
      { name: 'Blog', item: `${environment.siteUrl}/blog` },
    ]);
  }

  trackByPost(_: number, post: BlogPost): string {
    return post.slug;
  }

  trackByValue(_: number, value: string): string {
    return value;
  }

  trackByHeading(_: number, section: { heading: string }): string {
    return section.heading;
  }
}
