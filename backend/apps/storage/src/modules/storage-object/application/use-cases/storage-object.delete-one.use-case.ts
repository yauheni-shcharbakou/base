import { NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
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
  ): Promise<Either<HttpException, NestStorage.StorageObject>> {
    const entity = await this.storageObjectRepository.getOne<NestStorage.StorageObjectPopulated>(
      query,
      { populate: ['file', 'video'] },
    );

    if (entity.isLeft()) {
      return entity;
    }

    // The root folder is the anchor of the user's tree — every placement resolves through it, so it
    // is not deletable. It is the only folder without a parent.
    if (entity.value.isFolder && !entity.value.parentId) {
      return left(new BadRequestException("You can't delete the root folder"));
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

    // No READY gate for either provider: a provider id alone means there may be something to purge.
    switch (entity.value.type) {
      case NestStorage.StorageObjectType.VIDEO: {
        // A Bunny Stream object exists from `createVideo` onward, so its guid alone is proof there
        // is something to delete — see the video delete use-case.
        const providerId = entity.value.video?.providerId;

        if (!providerId) {
          break;
        }

        await this.storageVideoService.deleteVideo(providerId);
        break;
      }
      case NestStorage.StorageObjectType.FILE:
      case NestStorage.StorageObjectType.IMAGE: {
        // Not gated on READY either: with a direct upload the bytes can land before
        // `completeUpload` runs, and deleting an absent key is a no-op (ADR-0015).
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
