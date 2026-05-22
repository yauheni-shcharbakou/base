import { DeleteUseCase } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

@Injectable()
export class FileDeleteUseCase extends DeleteUseCase<NestStorage.File, NestStorage.FileQuery> {
  constructor(
    protected readonly repository: FileRepository,
    private readonly storageFileService: StorageFileService,
  ) {
    super(repository);
  }

  protected async afterSingleDeletion(
    result: Either<NotFoundException, NestStorage.File>,
  ): Promise<void> {
    if (result.isLeft()) {
      return;
    }

    const isFileReady = result.value.uploadStatus === NestStorage.FileUploadStatus.READY;
    const providerId = result.value.providerId;

    if (isFileReady && providerId) {
      await this.storageFileService.deleteFile(result.value.providerId);
    }
  }
}
