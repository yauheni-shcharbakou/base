import { FilePurgeType } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { FileMapper } from '@modules/file/application/mappers/file.mapper';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { StorageObjectPlacementService } from '@modules/storage-object/application/services/storage-object.placement.service';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

/**
 * Unlike a file's key, a Stream object exists from `createVideo` on, before any row names it. So the
 * folder is checked before the provider is called — a create that cannot be placed never reaches
 * Bunny — and checked again, with the names, under the owner's tree lock, where a deletion queued
 * in between can still refuse it. A video whose row is not saved is purged at once: no row, no
 * cleanup cron would ever find it.
 */
@Injectable()
export class VideoCreateOneUseCase {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly storageVideoService: StorageVideoService,
    private readonly fileMapper: FileMapper,
    private readonly filePurgeService: FilePurgeService,
    private readonly storageObjectValidationService: StorageObjectValidationService,
    private readonly storageObjectPlacementService: StorageObjectPlacementService,
  ) {}

  async execute(
    createData: NestStorage.VideoCreateOne,
  ): Promise<Either<Error, NestStorage.VideoCreated>> {
    if (createData.storage) {
      const placement = await this.storageObjectValidationService.validatePlacement(
        createData.storage.parent,
        createData.userId,
      );

      if (placement.isLeft()) {
        return left(placement.value);
      }
    }

    const providerId = await this.storageVideoService.createVideo({
      ...createData.video,
      userId: createData.userId,
    });

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const videoData = {
      ...createData.video,
      userId: createData.userId,
      providerId: providerId.value,
    };
    const fileData = this.fileMapper.toCreateData(createData.file);

    const video = await this.storageObjectPlacementService.placeLeaves(
      createData.storage
        ? {
            userId: createData.userId,
            parent: createData.storage.parent,
            isPublic: createData.storage.isPublic,
            type: NestStorage.StorageObjectType.VIDEO,
            names: [createData.storage.name],
          }
        : undefined,
      (leaves) =>
        this.videoRepository.saveAndPlaceOne({
          video: videoData,
          file: fileData,
          storageObject: leaves?.[0],
        }),
    );

    if (video.isLeft()) {
      await this.filePurgeService.purge([
        { type: FilePurgeType.VIDEO, providerId: providerId.value },
      ]);
      return left(video.value);
    }

    // The bytes never reach us: the caller uploads straight to Bunny with these credentials,
    // and the provider reports the outcome back through the status webhook.
    const upload = this.storageVideoService.getTusUpload(video.value.providerId, {
      title: video.value.title,
      mimeType: createData.file.mimeType,
    });

    if (upload.isLeft()) {
      return left(upload.value);
    }

    return right({ video: video.value, upload: upload.value });
  }
}
