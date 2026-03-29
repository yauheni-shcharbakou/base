import { getImageDimensions } from '@/features/image/helpers';
import { createImage, createManyImages } from '@/features/storage/actions';
import { StorageData } from '@/features/storage/types';
import { GrpcImage, GrpcImageCreateRequest, GrpcImageCreateManyRequest } from '@packages/grpc';

type ImageItem = {
  file: File;
  alt: string;
};

type ImageManyItem = Pick<ImageItem, 'file'> & {
  uploadId: string;
};

export class ImageActionClient {
  async createOne(item: ImageItem, storage?: StorageData): Promise<GrpcImage> {
    const dimensions = await getImageDimensions(item.file);

    const data: GrpcImageCreateRequest = {
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
    items: ImageManyItem[],
    storage?: Omit<StorageData, 'name'>,
  ): Promise<GrpcImage[]> {
    const data: GrpcImageCreateManyRequest = {
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
