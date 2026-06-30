import { ToolFaq } from '../models/image-job.model';
import blogPostsJson from './blog-posts.json';

export interface BlogSection {
  heading: string;
  paragraphs: string[];
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  metaDescription: string;
  category: string;
  date: string;
  readTime: string;
  tags: string[];
  heroTool: {
    label: string;
    route: string;
  };
  sections: BlogSection[];
  faqs: ToolFaq[];
}

export const BLOG_POSTS = blogPostsJson as BlogPost[];

export function findBlogPost(slug: string | null | undefined): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
