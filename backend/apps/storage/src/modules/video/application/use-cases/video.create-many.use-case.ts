import { NestStorage } from '@backend/proto';
import { FileMapper } from '@modules/file/application/mappers/file.mapper';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import {
  VideoRepository,
  VideoSaveAndPlace,
} from '@modules/video/domain/repositories/video.repository';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import _ from 'lodash';

@Injectable()
export class VideoCreateManyUseCase {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly storageVideoService: StorageVideoService,
    private readonly fileMapper: FileMapper,
    private readonly storageObjectValidationService: StorageObjectValidationService,
  ) {}

  async execute(
    createData: NestStorage.VideoCreateMany,
  ): Promise<Either<Error, NestStorage.Video[]>> {
    const fileNames = new Set(_.map(createData.items, 'file.originalName'));

    if (fileNames.size !== createData.items.length) {
      return left(new BadRequestException('Names of created files should be unique'));
    }

    try {
      const saveData: VideoSaveAndPlace[] = await Promise.all(
        _.map(createData.items, async (item): Promise<VideoSaveAndPlace> => {
          const providerId = await this.storageVideoService.createVideo({
            ...item.video,
            userId: createData.userId,
          });

          if (providerId.isLeft()) {
            throw providerId.value;
          }

          const createItem: VideoSaveAndPlace = {
            video: {
              ...item.video,
              userId: createData.userId,
              uploadId: item.uploadId,
              providerId: providerId.value,
            },
            file: this.fileMapper.toCreateData(item.file),
          };

          if (createData.storage) {
            const name = await this.storageObjectValidationService.validateObjectName({
              name: item.file.originalName,
              type: NestStorage.StorageObjectType.VIDEO,
              parent: createData.storage.parent,
            });

            if (name.isLeft()) {
              throw name.value;
            }

            createItem.storageObject = {
              ...createData.storage,
              name: name.value,
            };
          }

          return createItem;
        }),
      );

      return this.videoRepository.saveAndPlaceMany(saveData);
    } catch (error) {
      return left(error);
    }
  }
}
