declare module 'imagetracerjs' {
  const ImageTracer: {
    imagedataToSVG(imageData: ImageData, options?: Record<string, unknown>): string;
    imageToSVG(url: string, callback: (svgstring: string) => void, options?: Record<string, unknown>): void;
  };
  export = ImageTracer;
}
