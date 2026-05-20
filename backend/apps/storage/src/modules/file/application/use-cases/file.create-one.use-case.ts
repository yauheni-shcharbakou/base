import { NestStorage } from '@backend/proto';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageObjectCreateService } from '@modules/storage-object/application/services/storage-object.create.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import { FileCreateService } from '../services/file.create.service';

@Injectable()
export class FileCreateOneUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly fileCreateService: FileCreateService,
    private readonly storageFileService: StorageFileService,
    private readonly storageObjectCreateService: StorageObjectCreateService,
  ) {}

  async execute(request: NestStorage.FileCreateOne): Promise<Either<Error, NestStorage.File>> {
    const providerId = await this.storageFileService.createFile({
      ...request.file,
      userId: request.userId,
    });

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const file = await this.fileCreateService.createOne({
      ...request.file,
      userId: request.userId,
      providerId: providerId.value,
      uploadId: providerId.value,
    });

    if (file.isLeft() || !request.storage) {
      return file;
    }

    const storage = await this.storageObjectCreateService.createOne({
      ...request.storage,
      type: NestStorage.StorageObjectType.FILE,
      file: file.value.id,
      userId: request.userId,
    });

    if (storage.isLeft()) {
      await this.fileRepository.deleteById(file.value.id);
      return left(storage.value);
    }

    return file;
  }
}
