import { UpdateUseCase } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

@Injectable()
export class VideoUpdateUseCase extends UpdateUseCase<NestStorage.Video, NestStorage.VideoQuery> {
  constructor(
    protected readonly repository: VideoRepository,
    private readonly storagVideoService: StorageVideoService,
  ) {
    super(repository);
  }

  protected async afterSingleUpdate(
    result: Either<NotFoundException, NestStorage.Video>,
  ): Promise<void> {
    if (result.isLeft()) {
      return;
    }

    const providerId = result.value.providerId;

    if (providerId) {
      await this.storagVideoService.updateVideo(providerId, result.value);
    }
  }
}
