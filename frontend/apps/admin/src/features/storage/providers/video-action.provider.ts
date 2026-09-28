import { unwrapActionResult } from '@/features/grpc/helpers/unwrap-action-result';
import { createManyVideos, createVideo } from '@/features/storage/actions';
import { StorageData, StorageUploadItem } from '@/features/storage/types';
import { getGenericVideTitle } from '@/features/video/helpers';
import type { BrowserStorage } from '@packages/proto';

type VideoItem = Pick<StorageUploadItem, 'file'> & {
  title: string;
  description?: string;
};

/**
 * The wire keeps the entity and its pre-signed TUS credentials apart so the credentials never
 * leak into the read model. The upload hooks read `id`/`upload` off a flat record, so the pair
 * is flattened here — at the boundary — and nowhere else.
 */
export type CreatedVideo = BrowserStorage.Video & {
  upload: BrowserStorage.VideoTusUpload;
};

const flatten = ({ video, upload }: BrowserStorage.VideoCreated): CreatedVideo => ({
  ...video!,
  upload: upload!,
});

export class VideoActionProvider {
  async createOne(userId: string, item: VideoItem, storage?: StorageData): Promise<CreatedVideo> {
    const data: BrowserStorage.VideoCreateOne = {
      file: {
        originalName: item.file.name,
        size: item.file.size,
        mimeType: item.file.type,
      },
      video: {
        title: item.title,
        description: item.description,
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

    return flatten(unwrapActionResult(await createVideo(data)));
  }

  async createMany(
    userId: string,
    items: StorageUploadItem[],
    storage?: Omit<StorageData, 'name'>,
  ): Promise<CreatedVideo[]> {
    const data: BrowserStorage.VideoCreateMany = {
      items: items.map((item) => {
        return {
          file: {
            originalName: item.file.name,
            size: item.file.size,
            mimeType: item.file.type,
          },
          video: {
            title: getGenericVideTitle(item.file.name),
          },
        };
      }),
      userId,
    };

    if (storage?.parent) {
      data.storage = {
        parent: storage.parent,
        isPublic: storage.isPublic ?? false,
      };
    }

    return unwrapActionResult(await createManyVideos(data)).map(flatten);
  }
}
