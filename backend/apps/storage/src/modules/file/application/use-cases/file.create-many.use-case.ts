import { NestStorage } from '@backend/proto';
import {
  FileRepository,
  FileSaveAndPlace,
} from '@modules/file/domain/repositories/file.repository';
import { StorageObjectPlacementService } from '@modules/storage-object/application/services/storage-object.placement.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import { FileMapper } from '../mappers/file.mapper';

@Injectable()
export class FileCreateManyUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageFileService: StorageFileService,
    private readonly fileMapper: FileMapper,
    private readonly storageObjectPlacementService: StorageObjectPlacementService,
  ) {}

  async execute(
    createData: NestStorage.FileCreateMany,
  ): Promise<Either<Error, NestStorage.FileCreated[]>> {
    const fileNames = new Set(_.map(createData.items, 'originalName'));

    if (fileNames.size !== createData.items.length) {
      return left(new BadRequestException('Names of created files should be unique'));
    }

    try {
      const fileData = await Promise.all(
        _.map(createData.items, async (item) => {
          const providerId = await this.storageFileService.createFile({
            ...item,
            userId: createData.userId,
          });

          if (providerId.isLeft()) {
            throw providerId.value;
          }

          return this.fileMapper.toCreateData({
            ...item,
            userId: createData.userId,
            providerId: providerId.value,
          });
        }),
      );

      const files = await this.storageObjectPlacementService.placeLeaves(
        createData.storage
          ? {
              userId: createData.userId,
              parent: createData.storage.parent,
              isPublic: createData.storage.isPublic,
              type: NestStorage.StorageObjectType.FILE,
              names: _.map(createData.items, 'originalName'),
            }
          : undefined,
        (leaves) =>
          this.fileRepository.saveAndPlaceMany(
            _.map(fileData, (file, index): FileSaveAndPlace => ({
              file,
              storageObject: leaves?.[index],
            })),
          ),
      );

      if (files.isLeft()) {
        return left(files.value);
      }

      // Every created file carries its own pre-signed PUT; the row already holds the key, type
      // and size the signature binds.
      return right(
        await Promise.all(
          _.map(files.value, async (file): Promise<NestStorage.FileCreated> => {
            const upload = await this.storageFileService.getUploadUrl(file.providerId, file);

            if (upload.isLeft()) {
              throw upload.value;
            }

            return { file, upload: upload.value };
          }),
        ),
      );
    } catch (error) {
      return left(error);
    }
  }
}
