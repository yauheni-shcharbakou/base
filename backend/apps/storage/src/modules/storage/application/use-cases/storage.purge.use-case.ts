import { FilePurgeEvent, FilePurgeType } from '@backend/event-bus';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';

/**
 * Deletes one object from the provider that holds it. The event names the kind of object; which
 * provider stores that kind is decided here, next to the adapters. Deleting an absent object
 * succeeds, so a redelivered purge is harmless.
 */
@Injectable()
export class StoragePurgeUseCase {
  constructor(
    private readonly storageFileService: StorageFileService,
    private readonly storageVideoService: StorageVideoService,
  ) {}

  async execute({
    type,
    providerId,
  }: FilePurgeEvent): Promise<Either<InternalServerErrorException, boolean>> {
    switch (type) {
      case FilePurgeType.VIDEO:
        return this.storageVideoService.deleteVideo(providerId);
      case FilePurgeType.FILE:
        return this.storageFileService.deleteFile(providerId);
      default:
        return left(new InternalServerErrorException(`Unknown purge type "${type as string}"`));
    }
  }
}
