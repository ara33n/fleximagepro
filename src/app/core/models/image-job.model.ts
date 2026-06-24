export type ToolMode = 'compress' | 'convert-webp' | 'resize' | 'jpg-png' | 'png-to-svg';
export type OutputFormat = 'original' | 'auto' | 'jpeg' | 'png' | 'webp' | 'svg';

export interface ToolConfig {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  acceptedTypes: string[];
  mode: ToolMode;
  defaultOutput: OutputFormat;
  titleTag: string;
  metaDescription: string;
  keywords: string;
}

export interface ImageJob {
  id: string;
  file: File;
  name: string;
  type: string;
  originalUrl: string;
  originalSize: number;
  width: number;
  height: number;
  status: 'queued' | 'processing' | 'done' | 'error';
  resultUrl?: string;
  resultBlob?: Blob;
  resultName?: string;
  resultSize?: number;
  resultWidth?: number;
  resultHeight?: number;
  error?: string;
}

export interface ProcessOptions {
  mode: ToolMode;
  quality: number;
  width?: number;
  height?: number;
  outputFormat: OutputFormat;
}

export interface ProcessedImage {
  blob: Blob;
  url: string;
  fileName: string;
  width: number;
  height: number;
}
