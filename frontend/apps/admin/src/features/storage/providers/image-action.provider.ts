import { getImageDimensions } from '@/features/image/helpers';
import { createImage, createManyImages } from '@/features/storage/actions';
import { StorageData, StorageUploadItem } from '@/features/storage/types';
import type { BrowserStorage } from '@packages/proto';

type ImageItem = Pick<StorageUploadItem, 'file'> & {
  alt: string;
};

export class ImageActionProvider {
  async createOne(item: ImageItem, storage?: StorageData): Promise<BrowserStorage.Image> {
    const dimensions = await getImageDimensions(item.file);

    const data: BrowserStorage.ImageCreateRequest = {
      file: {
        originalName: item.file.name,
        size: item.file.size,
        mimeType: item.file.type,
      },
      image: {
        ...dimensions,
        alt: item.alt,
      },
    };

    if (storage?.parent) {
      data.storage = {
        parent: storage.parent,
        name: storage.name || item.file.name,
        isPublic: storage.isPublic ?? false,
      };
    }

    const response = await createImage(data);

    if ('error' in response) {
      throw new Error(response.error);
    }

    return response.entity;
  }

  async createMany(
    items: StorageUploadItem[],
    storage?: Omit<StorageData, 'name'>,
  ): Promise<BrowserStorage.Image[]> {
    const data: BrowserStorage.ImageCreateManyRequest = {
      items: await Promise.all(
        items.map(async (item) => {
          const dimensions = await getImageDimensions(item.file);

          return {
            file: {
              originalName: item.file.name,
              size: item.file.size,
              mimeType: item.file.type,
            },
            image: {
              ...dimensions,
              alt: item.file.name,
            },
            uploadId: item.uploadId,
          };
        }),
      ),
    };

    if (storage?.parent) {
      data.storage = {
        parent: storage.parent,
        isPublic: storage.isPublic ?? false,
      };
    }

    const response = await createManyImages(data);

    if ('error' in response) {
      throw new Error(response.error);
    }

    return response.data;
  }
}
