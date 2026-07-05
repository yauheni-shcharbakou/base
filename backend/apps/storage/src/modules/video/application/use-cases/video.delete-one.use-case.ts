import { NestStorage } from '@backend/proto';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

@Injectable()
export class VideoDeleteOneUseCase {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly storageVideoService: StorageVideoService,
  ) {}

  async execute(
    query: NestStorage.VideoQuery,
  ): Promise<Either<NotFoundException, NestStorage.Video>> {
    const video = await this.videoRepository.getOne<NestStorage.VideoPopulated>(query, {
      populate: ['file'],
    });

    if (video.isLeft()) {
      return video;
    }

    const deletedVideo = await this.videoRepository.deleteById(video.value.id);
    const isFileReady = video.value.file.uploadStatus === NestStorage.FileUploadStatus.READY;
    const providerId = video.value.file.providerId;

    if (deletedVideo.isLeft() || !isFileReady || !providerId) {
      return deletedVideo;
    }

    await this.storageVideoService.deleteVideo(providerId);
    return video;
  }
}
