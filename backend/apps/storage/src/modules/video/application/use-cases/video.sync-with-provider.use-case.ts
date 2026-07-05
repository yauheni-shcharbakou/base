import { BulkUpdate } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { Injectable } from '@nestjs/common';
import _ from 'lodash';

@Injectable()
export class VideoSyncWithProviderUseCase {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly storageVideoService: StorageVideoService,
  ) {}

  async execute() {
    let page = 1;
    let hasNext = true;
    const limit = 100;

    do {
      const { items, total } = await this.storageVideoService.getList(page, limit);

      await this.videoRepository.bulkUpdate(
        _.map(items, (item): BulkUpdate<NestStorage.Video> => {
          return {
            filter: {
              key: 'providerId',
              value: item.providerId,
            },
            update: {
              set: {
                duration: item.duration,
                views: item.views,
              },
            },
          };
        }),
      );

      hasNext = page * limit < total;
      page += 1;
    } while (hasNext);
  }
}
