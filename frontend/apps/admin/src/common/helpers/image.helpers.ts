import { ImageLoader, ImageLoaderProps } from 'next/image';

export const imageLoader: ImageLoader = ({ src, width, quality }: ImageLoaderProps) => {
  return `${src}?width=${width}&quality=${quality || 75}`;
};
