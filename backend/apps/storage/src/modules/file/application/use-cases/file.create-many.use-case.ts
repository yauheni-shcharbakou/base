import { NestStorage } from '@backend/proto';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageObjectCreateService } from '@modules/storage-object/application/services/storage-object.create.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import { FileCreate, FileCreateService } from '../services/file.create.service';

@Injectable()
export class FileCreateManyUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly fileCreateService: FileCreateService,
    private readonly storageFileService: StorageFileService,
    private readonly storageObjectCreateService: StorageObjectCreateService,
  ) {}

  async execute(request: NestStorage.FileCreateMany): Promise<Either<Error, NestStorage.File[]>> {
    const fileNames = new Set(_.map(request.items, 'file.originalName'));

    if (fileNames.size !== request.items.length) {
      return left(new BadRequestException('Names of created files should be unique'));
    }

    try {
      const saveData: FileCreate[] = await Promise.all(
        _.map(request.items, async (item) => {
          const providerId = await this.storageFileService.createFile({
            ...item.file,
            userId: request.userId,
          });

          if (providerId.isLeft()) {
            throw providerId.value;
          }

          return {
            ...item.file,
            userId: request.userId,
            providerId: providerId.value,
            uploadId: item.uploadId,
          };
        }),
      );

      const files = await this.fileCreateService.createMany(saveData);

      if (files.isLeft()) {
        return left(files.value);
      }

      if (request.storage) {
        const storage = await this.storageObjectCreateService.createManyFiles({
          ...request.storage,
          userId: request.userId,
          files: _.map(files.value, (file) => {
            return {
              file: file.id,
              name: file.originalName,
              type: NestStorage.StorageObjectType.FILE,
            };
          }),
        });

        if (storage.isLeft()) {
          await this.fileRepository.deleteMany({ ids: _.map(files.value, 'id') });
          return left(storage.value);
        }
      }

      return right(files.value);
    } catch (error) {
      return left(error);
    }
  }
}
