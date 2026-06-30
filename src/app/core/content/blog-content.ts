import { ToolFaq } from '../models/image-job.model';

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
