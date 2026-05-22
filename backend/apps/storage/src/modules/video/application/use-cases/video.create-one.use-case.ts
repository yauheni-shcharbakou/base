import { NestStorage } from '@backend/proto';
import { FileCreateService } from '@modules/file/application/services/file.create.service';
import { StorageObjectCreateService } from '@modules/storage-object/application/services/storage-object.create.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';

@Injectable()
export class VideoCreateOneUseCase {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly storageVideoService: StorageVideoService,
    private readonly fileCreateService: FileCreateService,
    private readonly storageObjectCreateService: StorageObjectCreateService,
  ) {}

  async execute(createData: NestStorage.VideoCreateOne): Promise<Either<Error, NestStorage.Video>> {
    const providerId = await this.storageVideoService.createVideo({
      ...createData.video,
      userId: createData.userId,
    });

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const file = await this.fileCreateService.createOne({
      ...createData.file,
      userId: createData.userId,
      uploadId: providerId.value,
    });

    if (file.isLeft()) {
      return left(file.value);
    }

    const video = await this.videoRepository.saveOne({
      ...createData.video,
      userId: createData.userId,
      file: file.value.id,
      providerId: providerId.value,
      uploadId: providerId.value,
    });

    if (video.isLeft() || !createData.storage) {
      return video;
    }

    const storage = await this.storageObjectCreateService.createOne({
      ...createData.storage,
      type: NestStorage.StorageObjectType.VIDEO,
      file: video.value.fileId,
      video: video.value.id,
      userId: createData.userId,
    });

    if (storage.isLeft()) {
      await this.videoRepository.deleteById(video.value.id);
      return left(storage.value);
    }

    return video;
  }
}
