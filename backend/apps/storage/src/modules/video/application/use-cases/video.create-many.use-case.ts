import { FilePurgeType } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { FileMapper } from '@modules/file/application/mappers/file.mapper';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { StorageObjectPlacementService } from '@modules/storage-object/application/services/storage-object.placement.service';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import {
  VideoRepository,
  VideoSaveAndPlace,
} from '@modules/video/domain/repositories/video.repository';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';

/**
 * The batch form of `VideoCreateOneUseCase`, with the same order: the folder is checked before any
 * Stream object is created, the rows are placed under the owner's tree lock, and every Stream
 * object a failed batch created is purged — whether one `createVideo` failed or the save did.
 */
@Injectable()
export class VideoCreateManyUseCase {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly storageVideoService: StorageVideoService,
    private readonly fileMapper: FileMapper,
    private readonly filePurgeService: FilePurgeService,
    private readonly storageObjectValidationService: StorageObjectValidationService,
    private readonly storageObjectPlacementService: StorageObjectPlacementService,
  ) {}

  async execute(
    createData: NestStorage.VideoCreateMany,
  ): Promise<Either<Error, NestStorage.VideoCreated[]>> {
    const fileNames = new Set(_.map(createData.items, 'file.originalName'));

    if (fileNames.size !== createData.items.length) {
      return left(new BadRequestException('Names of created files should be unique'));
    }

    if (createData.storage) {
      const placement = await this.storageObjectValidationService.validatePlacement(
        createData.storage.parent,
        createData.userId,
      );

      if (placement.isLeft()) {
        return left(placement.value);
      }
    }

    const providerIds = await Promise.all(
      _.map(createData.items, async (item) =>
        this.storageVideoService.createVideo({ ...item.video, userId: createData.userId }),
      ),
    );
    const created = _.flatMap(providerIds, (id) => (id.isRight() ? [id.value] : []));
    const failed = _.find(providerIds, (id) => id.isLeft());

    if (failed) {
      await this.purge(created);
      return left(failed.value);
    }

    const saveData = _.map(createData.items, (item, index): VideoSaveAndPlace => ({
      video: {
        ...item.video,
        userId: createData.userId,
        uploadId: item.uploadId,
        providerId: created[index],
      },
      file: this.fileMapper.toCreateData(item.file),
    }));

    const videos = await this.storageObjectPlacementService.placeLeaves(
      createData.storage
        ? {
            userId: createData.userId,
            parent: createData.storage.parent,
            isPublic: createData.storage.isPublic,
            type: NestStorage.StorageObjectType.VIDEO,
            names: _.map(createData.items, 'file.originalName'),
          }
        : undefined,
      (leaves) =>
        this.videoRepository.saveAndPlaceMany(
          _.map(saveData, (item, index) => ({ ...item, storageObject: leaves?.[index] })),
        ),
    );

    if (videos.isLeft()) {
      await this.purge(created);
      return left(videos.value);
    }

    // Every created video carries its own TUS credentials — the caller uploads each file
    // straight to Bunny, so `uploadId` is the only link back to the source file's mime type.
    const mimeTypeByUploadId = new Map(
      _.map(createData.items, (item) => [item.uploadId, item.file.mimeType] as const),
    );

    const results: NestStorage.VideoCreated[] = [];

    for (const video of videos.value) {
      const upload = this.storageVideoService.getTusUpload(video.providerId, {
        title: video.title,
        mimeType: mimeTypeByUploadId.get(video.uploadId) ?? '',
      });

      if (upload.isLeft()) {
        return left(upload.value);
      }

      results.push({ video, upload: upload.value });
    }

    return right(results);
  }

  private purge(providerIds: string[]): Promise<void> {
    return this.filePurgeService.purge(
      _.map(providerIds, (providerId) => ({ type: FilePurgeType.VIDEO, providerId })),
    );
  }
}
