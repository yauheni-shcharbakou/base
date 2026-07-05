import { NestStorage } from '@backend/proto';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { Injectable } from '@nestjs/common';
import _ from 'lodash';

@Injectable()
export class VideoGetDownloadMapUseCase {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly storageVideoService: StorageVideoService,
  ) {}

  async execute(
    query: Partial<NestStorage.FileQuery>,
    ip?: string,
  ): Promise<Map<string, NestStorage.DownloadData>> {
    const videos = await this.videoRepository.getMany<NestStorage.VideoPopulated>(query, {
      populate: ['file'],
    });

    const urlMap = new Map<string, NestStorage.DownloadData>();

    await Promise.all(
      _.map(videos, async (video) => {
        if (!video.providerId) {
          return;
        }

        const url = await this.storageVideoService.getDownloadUrl(video.providerId, ip);

        if (url.isRight()) {
          urlMap.set(video.id, {
            url: url.value,
            fileName: `${video.id}.${video.file.extension}`,
          });
        }
      }),
    );

    return urlMap;
  }
}
