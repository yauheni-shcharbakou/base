import { NestStorage } from '@backend/proto';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { Injectable } from '@nestjs/common';
import _ from 'lodash';

@Injectable()
export class VideoGetUrlMapUseCase {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly storageVideoService: StorageVideoService,
  ) {}

  async execute(query: Partial<NestStorage.VideoQuery>, ip?: string): Promise<Map<string, string>> {
    const videos = await this.videoRepository.getMany(query);
    const urlMap = new Map<string, string>();

    await Promise.all(
      _.map(videos, async (video) => {
        if (!video.providerId) {
          return;
        }

        const url = await this.storageVideoService.getPlayerUrl(video.providerId, ip);

        if (url.isRight()) {
          urlMap.set(video.id, url.value);
        }
      }),
    );

    return urlMap;
  }
}
