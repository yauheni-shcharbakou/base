import { NestStorage } from '@backend/proto';
import {
  FileCreate,
  FileCreateService,
} from '@modules/file/application/services/file.create.service';
import { StorageObjectCreateService } from '@modules/storage-object/application/services/storage-object.create.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { VideoCreate, VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';

@Injectable()
export class VideoCreateManyUseCase {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly storageVideoService: StorageVideoService,
    private readonly fileCreateService: FileCreateService,
    private readonly storageObjectCreateService: StorageObjectCreateService,
  ) {}

  async execute(
    createData: NestStorage.VideoCreateMany,
  ): Promise<Either<Error, NestStorage.Video[]>> {
    const fileNames = new Set(_.map(createData.items, 'file.originalName'));

    if (fileNames.size !== createData.items.length) {
      return left(new BadRequestException('Names of created files should be unique'));
    }

    const revertHooks: (() => Promise<any>)[] = [];

    try {
      const dataByUploadId = new Map<string, NestStorage.VideoCreateManyItem>();
      const providerIdByUploadId = new Map<string, string>();

      const fileData: FileCreate[] = await Promise.all(
        _.map(createData.items, async (item) => {
          dataByUploadId.set(item.uploadId, item);

          const providerId = await this.storageVideoService.createVideo({
            ...item.video,
            userId: createData.userId,
          });

          if (providerId.isLeft()) {
            throw providerId.value;
          }

          providerIdByUploadId.set(item.uploadId, providerId.value);

          return {
            ...item.file,
            userId: createData.userId,
            uploadId: item.uploadId,
          };
        }),
      );

      const files = await this.fileCreateService.createMany(fileData);

      if (files.isLeft()) {
        return left(files.value);
      }

      const videoData: VideoCreate[] = _.map(files.value, (file) => {
        const data = dataByUploadId.get(file.uploadId);
        const providerId = providerIdByUploadId.get(file.uploadId);

        return {
          ...data.video,
          file: file.id,
          userId: createData.userId,
          providerId,
          uploadId: file.uploadId,
        };
      });

      const videos = await this.videoRepository.saveMany(videoData);

      if (videos.isLeft()) {
        return left(videos.value);
      }

      const videoByFileId = new Map(_.map(videos.value, (video) => [video.fileId, video]));

      revertHooks.push(() => this.videoRepository.deleteMany({ ids: _.map(videos.value, 'id') }));

      if (createData.storage) {
        const storage = await this.storageObjectCreateService.createManyFiles({
          ...createData.storage,
          userId: createData.userId,
          files: _.map(files.value, (file) => {
            return {
              file: file.id,
              video: videoByFileId.get(file.id)?.id,
              name: file.originalName,
              type: NestStorage.StorageObjectType.VIDEO,
            };
          }),
        });

        if (storage.isLeft()) {
          await Promise.all(_.map(revertHooks, (hook) => hook()));
          return left(storage.value);
        }
      }

      return right(videos.value);
    } catch (error) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return left(error);
    }
  }
}
