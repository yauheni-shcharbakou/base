import { DeleteUseCase } from '@backend/common';
import { StorageFileEventBus } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

@Injectable()
export class FileDeleteUseCase extends DeleteUseCase<NestStorage.File, NestStorage.FileQuery> {
  constructor(
    protected readonly repository: FileRepository,
    private readonly eventBus: StorageFileEventBus,
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

    const hooks: Promise<any>[] = [this.eventBus.emitDelete(result.value)];
    const isFileReady = result.value.uploadStatus === NestStorage.FileUploadStatus.READY;
    const providerId = result.value.providerId;

    if (isFileReady && providerId) {
      hooks.push(this.storageFileService.deleteFile(result.value.providerId));
    }

    await Promise.allSettled(hooks);
  }
}
