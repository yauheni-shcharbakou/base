import { unwrapActionResult } from '@/features/grpc/helpers/unwrap-action-result';
import { createFile, createManyFiles } from '@/features/storage/actions';
import { StorageData, StorageUploadItem } from '@/features/storage/types';
import type { BrowserStorage } from '@packages/proto';

// What a file the browser cannot type — no extension, an unknown one — is uploaded as. The
// pre-signed PUT signs the type, so it cannot be left empty.
const UNKNOWN_MIME_TYPE = 'application/octet-stream';

/** A created file with the pre-signed PUT for its bytes, flattened like `CreatedVideo`. */
export type CreatedFile = BrowserStorage.File & {
  upload: BrowserStorage.FilePresignedUpload;
};

const flatten = ({ file, upload }: BrowserStorage.FileCreated): CreatedFile => ({
  ...file!,
  upload: upload!,
});

export class FileActionProvider {
  async createOne(userId: string, file: File, storage?: StorageData): Promise<CreatedFile> {
    const data: BrowserStorage.FileCreateOne = {
      file: {
        originalName: file.name,
        size: file.size,
        mimeType: file.type || UNKNOWN_MIME_TYPE,
      },
      userId,
    };

    if (storage?.parent) {
      data.storage = {
        parent: storage.parent,
        name: storage.name || file.name,
        isPublic: storage.isPublic ?? false,
      };
    }

    return flatten(unwrapActionResult(await createFile(data)));
  }

  async createMany(
    userId: string,
    items: StorageUploadItem[],
    storage?: Omit<StorageData, 'name'>,
  ): Promise<CreatedFile[]> {
    const data: BrowserStorage.FileCreateMany = {
      items: items.map(({ file }) => ({
        originalName: file.name,
        size: file.size,
        mimeType: file.type || UNKNOWN_MIME_TYPE,
      })),
      userId,
    };

    if (storage?.parent) {
      data.storage = {
        parent: storage.parent,
        isPublic: storage.isPublic ?? false,
      };
    }

    return unwrapActionResult(await createManyFiles(data)).map(flatten);
  }
}
