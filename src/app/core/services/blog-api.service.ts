import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BlogPost } from '../content/blog-content';
import { BlogCacheService } from './blog-cache.service';

interface BlogMeta {
  total: number;
  latestUpdatedAt: string;
  version: string;
}

@Injectable({ providedIn: 'root' })
export class BlogApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(BlogCacheService);
  private readonly apiBase = `${environment.apiBaseUrl}/api/blogs`;

  getCachedBlogs(): Promise<BlogPost[]> {
    return this.cache.get<BlogPost[]>('blogs').then((blogs) => blogs || []);
  }

  async syncBlogs(): Promise<BlogPost[]> {
    const [remoteMeta, cachedMeta] = await Promise.all([
      this.getMeta(),
      this.cache.get<BlogMeta>('blogs-meta'),
    ]);
    const cachedBlogs = await this.getCachedBlogs();
    if (cachedMeta?.version === remoteMeta.version && cachedBlogs.length) {
      return cachedBlogs;
    }

    const blogs = await firstValueFrom(this.http.get<{ blogs: BlogPost[] }>(this.apiBase)).then((res) => res.blogs || []);
    await Promise.all([
      this.cache.set('blogs', blogs),
      this.cache.set('blogs-meta', remoteMeta),
      ...blogs.map((blog) => this.cache.set(`blog:${blog.slug}`, blog)),
    ]);
    return blogs;
  }

  async getCachedBlog(slug: string): Promise<BlogPost | null> {
    const cached = await this.cache.get<BlogPost>(`blog:${slug}`);
    if (cached) return cached;
    const blogs = await this.getCachedBlogs();
    return blogs.find((blog) => blog.slug === slug) || null;
  }

  async syncBlog(slug: string): Promise<BlogPost> {
    const [remoteMeta, cachedMeta] = await Promise.all([
      this.getMeta(),
      this.cache.get<BlogMeta>('blogs-meta'),
    ]);
    const cached = await this.getCachedBlog(slug);
    if (cachedMeta?.version === remoteMeta.version && cached) {
      return cached;
    }

    const blog = await firstValueFrom(this.http.get<{ blog: BlogPost }>(`${this.apiBase}/${encodeURIComponent(slug)}`)).then((res) => res.blog);
    await Promise.all([
      this.cache.set(`blog:${blog.slug}`, blog),
      this.cache.set('blogs-meta', remoteMeta),
    ]);
    return blog;
  }

  trackView(slug: string): Promise<void> {
    return firstValueFrom(this.http.post(`${this.apiBase}/${encodeURIComponent(slug)}/view`, {})).then(() => undefined);
  }

  private getMeta(): Promise<BlogMeta> {
    return firstValueFrom(this.http.get<{ meta: BlogMeta }>(`${this.apiBase}/meta`)).then((res) => res.meta);
  }
}
