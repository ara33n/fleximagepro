export type ToolMode = 'compress' | 'convert-webp' | 'resize' | 'jpg-png' | 'png-to-svg';
export type OutputFormat = 'original' | 'auto' | 'jpeg' | 'png' | 'webp' | 'svg';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  shareStatus?: 'idle' | 'uploading' | 'ready' | 'error';
  shareId?: string;
  shareUrl?: string;
  qrCodeDataUrl?: string;
  shareExpiresAt?: string;
  shareError?: string;
  error?: string;
  cropRect?: CropRect;
}

export interface ProcessOptions {
  mode: ToolMode;
  quality: number;
  width?: number;
  height?: number;
  cropRect?: CropRect;
  outputFormat: OutputFormat;
}

export interface ProcessedImage {
  blob: Blob;
  url: string;
  fileName: string;
  width: number;
  height: number;
}
