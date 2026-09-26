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

    const deletedVideo = await this.videoRepository.deleteWithFile(video.value.id);
    // The Bunny guid lives on the video, not on its backing file row — `file.providerId` names an
    // object in Bunny Storage (plain files and images) and stays unset for a video, so reading it
    // here left every video behind at the provider.
    //
    // And no READY gate: `createVideo` runs before the row is saved, so the Stream object exists
    // from creation rather than from the first byte. Waiting for READY orphaned the object of every
    // video deleted mid-upload — permanently, because the cleanup cron reaches Bunny Stream only
    // through `file.video.providerId`, and that row is what we just deleted.
    const providerId = video.value.providerId;

    if (deletedVideo.isLeft() || !providerId) {
      return deletedVideo;
    }

    await this.storageVideoService.deleteVideo(providerId);
    return video;
  }
}
