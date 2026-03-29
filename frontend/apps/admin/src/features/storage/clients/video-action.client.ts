import { createManyVideos, createVideo } from '@/features/storage/actions';
import { StorageData } from '@/features/storage/types';
import { getGenericVideTitle } from '@/features/video/helpers';
import { GrpcVideo, GrpcVideoCreateRequest, GrpcVideoCreateManyRequest } from '@packages/grpc';

type VideoItem = {
  file: File;
  title: string;
  description?: string;
};

type VideoManyItem = Pick<VideoItem, 'file'> & {
  uploadId: string;
};

export class VideoActionClient {
  async createOne(item: VideoItem, storage?: StorageData): Promise<GrpcVideo> {
    const data: GrpcVideoCreateRequest = {
      file: {
        originalName: item.file.name,
        size: item.file.size,
        mimeType: item.file.type,
      },
      video: {
        title: item.title,
        description: item.description,
      },
    };

    if (storage?.parent) {
      data.storage = {
        parent: storage.parent,
        name: storage.name || item.file.name,
        isPublic: storage.isPublic ?? false,
      };
    }

    const response = await createVideo(data);

    if ('error' in response) {
      throw new Error(response.error);
    }

    return response.entity;
  }

  async createMany(
    items: VideoManyItem[],
    storage?: Omit<StorageData, 'name'>,
  ): Promise<GrpcVideo[]> {
    const data: GrpcVideoCreateManyRequest = {
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
          uploadId: item.uploadId,
        };
      }),
    };

    if (storage?.parent) {
      data.storage = {
        parent: storage.parent,
        isPublic: storage.isPublic ?? false,
      };
    }

    const response = await createManyVideos(data);

    if ('error' in response) {
      throw new Error(response.error);
    }

    return response.data;
  }
}
