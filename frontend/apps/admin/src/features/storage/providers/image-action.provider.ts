import { unwrapActionResult } from '@/features/grpc/helpers/unwrap-action-result';
import { getImageDimensions } from '@/features/image/helpers';
import { createImage, createManyImages } from '@/features/storage/actions';
import { StorageData, StorageUploadItem } from '@/features/storage/types';
import type { BrowserStorage } from '@packages/proto';

/**
 * A created image with the pre-signed PUT for its file's bytes, flattened like `CreatedVideo`.
 * The upload is completed by `fileId`, not by the image's own id.
 */
export type CreatedImage = BrowserStorage.Image & {
  upload: BrowserStorage.FilePresignedUpload;
};

const flatten = ({ image, upload }: BrowserStorage.ImageCreated): CreatedImage => ({
  ...image!,
  upload: upload!,
});

type ImageItem = Pick<StorageUploadItem, 'file'> & {
  alt: string;
};

export class ImageActionProvider {
  async createOne(userId: string, item: ImageItem, storage?: StorageData): Promise<CreatedImage> {
    const dimensions = await getImageDimensions(item.file);

    const data: BrowserStorage.ImageCreateOne = {
      file: {
        originalName: item.file.name,
        size: item.file.size,
        mimeType: item.file.type,
      },
      image: {
        ...dimensions,
        alt: item.alt,
      },
      userId,
    };

    if (storage?.parent) {
      data.storage = {
        parent: storage.parent,
        name: storage.name || item.file.name,
        isPublic: storage.isPublic ?? false,
      };
    }

    return flatten(unwrapActionResult(await createImage(data)));
  }

  async createMany(
    userId: string,
    items: StorageUploadItem[],
    storage?: Omit<StorageData, 'name'>,
  ): Promise<CreatedImage[]> {
    const data: BrowserStorage.ImageCreateMany = {
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
      userId,
    };

    if (storage?.parent) {
      data.storage = {
        parent: storage.parent,
        isPublic: storage.isPublic ?? false,
      };
    }

    return unwrapActionResult(await createManyImages(data)).map(flatten);
  }
}
