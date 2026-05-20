import { NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';

@Injectable()
export class StorageObjectDeleteOneUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageFileService: StorageFileService,
    private readonly storageVideoService: StorageVideoService,
  ) {}

  async execute(
    query: Partial<NestStorage.StorageObjectQuery>,
  ): Promise<Either<NotFoundException, NestStorage.StorageObject>> {
    const entity = await this.storageObjectRepository.getOne<NestStorage.StorageObjectPopulated>(
      query,
      { populate: ['file', 'video'] },
    );

    if (entity.isLeft()) {
      return entity;
    }

    if (entity.value.isFolder) {
      const hasFiles = await this.storageObjectRepository.isExists({ parent: entity.value.id });

      if (hasFiles) {
        return left(new BadRequestException("You can't delete folder with files"));
      }
    }

    const deletedEntity = await this.storageObjectRepository.updateById(entity.value.id, {
      set: {
        isDeleted: true,
      },
    });

    if (deletedEntity.isLeft() || deletedEntity.value.isFolder) {
      return deletedEntity;
    }

    const isFileReady = entity.value.file?.uploadStatus === NestStorage.FileUploadStatus.READY;

    if (!isFileReady) {
      return deletedEntity;
    }

    switch (entity.value.type) {
      case NestStorage.StorageObjectType.VIDEO: {
        const providerId = entity.value.video?.providerId;

        if (!providerId) {
          break;
        }

        await this.storageVideoService.deleteVideo(providerId);
        break;
      }
      case NestStorage.StorageObjectType.FILE:
      case NestStorage.StorageObjectType.IMAGE: {
        const providerId = entity.value.file?.providerId;

        if (!providerId) {
          break;
        }

        await this.storageFileService.deleteFile(providerId);
        break;
      }
      default:
        break;
    }

    return deletedEntity;
  }
}
