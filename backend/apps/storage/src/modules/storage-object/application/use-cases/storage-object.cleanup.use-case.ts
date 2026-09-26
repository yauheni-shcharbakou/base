import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Injectable, Logger } from '@nestjs/common';

// A safety stop, not a depth limit anyone should reach: each pass removes one level of folders.
const MAX_PASSES = 100;

/**
 * Hard-deletes the folders of a deleted subtree, bottom level first, until a pass finds none. The
 * files under them are the file cleanup's to remove; a folder that still holds one is left for a
 * later run. Nothing here reaches the provider — a folder has no object there.
 */
@Injectable()
export class StorageObjectCleanupUseCase {
  private readonly logger = new Logger(StorageObjectCleanupUseCase.name);

  constructor(private readonly storageObjectRepository: StorageObjectRepository) {}

  async execute(): Promise<void> {
    let total = 0;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const deleted = await this.storageObjectRepository.deleteEmptyDeletedFolders();

      if (deleted.isLeft() || !deleted.value) {
        break;
      }

      total += deleted.value;
    }

    if (total) {
      this.logger.log(`Dropped ${total} deleted folder(s)`);
    }
  }
}
