import { environment } from '../../../environments/environment';
import { TOOL_CATEGORIES, ToolCatalogCategory, ToolCatalogItem } from './tool-catalog';
import { ToolFaq } from '../models/image-job.model';

export interface GeneratedToolSeo {
  title: string;
  metaDescription: string;
  slug: string;
  h1: string;
  intro: string[];
  howTo: string[];
  features: string[];
  benefits: string[];
  faqs: ToolFaq[];
  relatedTools: ToolCatalogItem[];
  cta: string;
  breadcrumb: { name: string; item: string }[];
}

export function generateToolSeo(item: ToolCatalogItem, category: ToolCatalogCategory): GeneratedToolSeo {
  const keyword = item.label;
  const title = trimTo(`${keyword} - Free Online Tool`, 60);
  const metaDescription = trimTo(`${item.description} Use ${keyword} to create clean results quickly with preview, copy, and download options on FlexImagePro.`, 158);
  const relatedTools = category.tools
    .filter((tool) => tool.live && tool.slug !== item.slug)
    .slice(0, 6);

  return {
    title,
    metaDescription,
    slug: item.slug,
    h1: item.label,
    intro: [
      `${keyword} helps you complete a focused ${category.title.toLowerCase()} task without jumping between different utilities. The page is designed around the main action first, with clear inputs, practical defaults, and an output area that is easy to copy, download, or review before using it in your project.`,
      `Use this tool when you need a quick result for publishing, development, content cleanup, SEO preparation, or everyday workflow support. The interface stays simple, but the generated output is structured so it can be reused in websites, documents, apps, and marketing tasks.`,
    ],
    howTo: [
      `Open the ${keyword} page from the tools menu or search bar.`,
      'Add the required text, URL, image, or settings in the input fields.',
      'Review the generated result or preview area.',
      'Adjust options if the page offers tool-specific controls.',
      'Copy or download the final output when it is ready.',
    ],
    features: [
      `Purpose-built workflow for ${keyword}.`,
      'Clean input fields with practical defaults.',
      'Instant output preview where supported.',
      'Copy and download actions for reusable results.',
      'Responsive layout for mobile and desktop screens.',
      'Related tool links for similar tasks.',
    ],
    benefits: [
      'Saves time on repetitive manual formatting.',
      'Keeps the workflow focused on one clear task.',
      'Helps reduce mistakes in generated output.',
      'Makes results easier to reuse across projects.',
      'Works well for quick checks and production prep.',
      'Pairs naturally with other FlexImagePro utilities.',
    ],
    faqs: [
      {
        question: `What is ${keyword}?`,
        answer: `${keyword} is a focused ${category.title.toLowerCase()} page for ${item.description.toLowerCase()}`,
      },
      {
        question: `How do I use ${keyword}?`,
        answer: 'Enter the required information, review the output, adjust any available options, then copy or download the result.',
      },
      {
        question: `Who should use ${keyword}?`,
        answer: 'It is useful for creators, developers, marketers, site owners, students, and anyone who needs a quick utility for a specific task.',
      },
      {
        question: 'Can I use the output in a live project?',
        answer: 'Yes. Review the generated output first, then use it in your website, document, app, or publishing workflow as needed.',
      },
      {
        question: 'Does this tool support mobile screens?',
        answer: 'Yes. The layout is responsive and keeps inputs, previews, and actions usable on small and large screens.',
      },
      {
        question: 'Can I copy the result?',
        answer: 'Most generated outputs include a copy action, and downloadable tools include a direct download button.',
      },
      {
        question: 'What should I check before using the result?',
        answer: 'Check spelling, URLs, formatting, values, and any page-specific requirements before publishing or sharing the result.',
      },
      {
        question: 'Which tools are related?',
        answer: relatedTools.length
          ? `Related options include ${relatedTools.slice(0, 3).map((tool) => tool.label).join(', ')}.`
          : `Other ${category.title.toLowerCase()} pages can help with nearby tasks.`,
      },
    ],
    relatedTools,
    cta: `Try ${keyword} now, then use the related tools below to finish the next step in your workflow.`,
    breadcrumb: [
      { name: 'Home', item: environment.siteUrl },
      { name: category.title, item: environment.siteUrl },
      { name: item.label, item: `${environment.siteUrl}${item.route}` },
    ],
  };
}

export function findCategoryForTool(slug: string): ToolCatalogCategory | undefined {
  return TOOL_CATEGORIES.find((category) => category.tools.some((tool) => tool.slug === slug || tool.route === `/${slug}`));
}

function trimTo(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}`;
}
