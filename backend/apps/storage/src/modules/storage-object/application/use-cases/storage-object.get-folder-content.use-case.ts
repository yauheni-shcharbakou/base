import { NestCommon, NestStorage } from '@backend/proto';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

// Folders come first, whatever the caller sorts by.
const FOLDERS_FIRST: NestCommon.Sorter = { field: 'isFolder', order: NestCommon.Sort.desc };
const BY_NAME: NestCommon.Sorter = { field: 'name', order: NestCommon.Sort.asc };
// Names are unique among a folder's live objects, dates and types are not: the id makes every order
// total, so an offset page never repeats or skips a row that ties with its neighbour.
const BY_ID: NestCommon.Sorter = { field: 'id', order: NestCommon.Sort.asc };

const SORT_FIELDS: Record<NestStorage.StorageObjectSortField, keyof StorageObject> = {
  [NestStorage.StorageObjectSortField.NAME]: 'name',
  [NestStorage.StorageObjectSortField.CREATED_AT]: 'createdAt',
  [NestStorage.StorageObjectSortField.UPDATED_AT]: 'updatedAt',
  [NestStorage.StorageObjectSortField.TYPE]: 'type',
};

// `StorageObjectFolderItem` repeats `StorageObjectPopulated` field by field. The spread in
// `toFolderItem` skips the excess-property check, so a field added to the one and not the other
// would compile and then vanish in the encoder: this alias fails the build instead.
type Expect<T extends true> = T;
type FolderItemCoversPopulated = Expect<
  [
    Exclude<keyof NestStorage.StorageObjectPopulated, keyof NestStorage.StorageObjectFolderItem>,
  ] extends [never]
    ? true
    : false
>;

/**
 * A page of one folder of a user's tree, with what a folder view shows around it: the folder's path
 * and the folders above it. The scope — this folder, its owner's tree, live objects only — is fixed
 * here. The caller narrows it through the content query alone, never through free-form list filters,
 * which the repository would apply over it.
 *
 * A READY image or video on the page carries a signed `previewUrl`, so a folder view shows its
 * thumbnails straight from the CDN instead of asking for a URL per item. Signing happens in memory,
 * from the media the page already populates: it adds no statement.
 *
 * A read, so it takes no tree lock: a write that lands between its statements shows on the next call.
 */
@Injectable()
export class StorageObjectGetFolderContentUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageFileService: StorageFileService,
    private readonly storageVideoService: StorageVideoService,
  ) {}

  async execute(
    request: NestStorage.StorageObjectGetFolderContent,
  ): Promise<Either<Error, NestStorage.StorageObjectFolderContent>> {
    // A missing folder, a deleted one, another user's and a leaf are the same `NotFound`: a user's
    // tree is closed.
    const folder = await this.storageObjectRepository.getOne<NestStorage.StorageObjectPopulated>(
      {
        id: request.parentId,
        userId: request.userId,
        type: NestStorage.StorageObjectType.FOLDER,
        isDeleted: false,
      },
      { populate: ['folderPath', 'folderStats'] },
    );

    if (folder.isLeft()) {
      return left(folder.value);
    }

    const ancestors = await this.storageObjectRepository.getAncestors(folder.value.id);

    if (ancestors.isLeft()) {
      return left(ancestors.value);
    }

    const query = {
      parent: folder.value.id,
      userId: request.userId,
      isDeleted: false,
      types: request.query?.types,
      isPublic: request.query?.isPublic,
      nameContains: request.query?.search,
    };
    const { items, total } =
      await this.storageObjectRepository.getList<NestStorage.StorageObjectPopulated>(
        {
          query,
          sorters: this.getSorters(request.sorters),
          pagination: request.pagination,
        },
        // No path per item: a subfolder's is the folder's own followed by its name. Its stats are
        // its own, one walk of its subtree per subfolder.
        { populate: ['file', 'image', 'video', 'folderStats'] },
      );

    const folderTotal =
      this.getFolderTotal(items, total, request.pagination) ??
      (await this.storageObjectRepository.count({ ...query, isFolder: true }));

    return right({
      folder: folder.value,
      ancestors: ancestors.value,
      items: items.map((item) => this.toFolderItem(item)),
      total,
      folderTotal,
    });
  }

  // How many of `total` are folders, when the page itself tells: folders come first, so every row
  // before a page's first file is one. Unknown — `undefined`, and a count — only for a page of files
  // past the first, a full page of folders, or a page past the end.
  private getFolderTotal(
    items: NestStorage.StorageObjectPopulated[],
    total: number,
    pagination?: NestCommon.Pagination,
  ): number | undefined {
    const page = pagination?.page || 1;
    // The repository's own default limit is its business: without one, only page 1 has an offset.
    const offset = page === 1 ? 0 : pagination?.limit && (page - 1) * pagination.limit;
    const folders = items.filter((item) => item.isFolder).length;

    if (offset === undefined) {
      return;
    }

    if (folders < items.length && (folders > 0 || offset === 0)) {
      return offset + folders;
    }

    // The last page, and all folders: none of the folder's objects is a file. An empty page is that
    // only as the first, of an empty folder.
    if (
      folders === items.length &&
      (items.length ? offset + items.length === total : offset === 0)
    ) {
      return total;
    }
  }

  private toFolderItem(
    item: NestStorage.StorageObjectPopulated,
  ): NestStorage.StorageObjectFolderItem {
    const previewUrl = this.signPreview(item);
    return previewUrl?.isRight() ? { ...item, previewUrl: previewUrl.value } : item;
  }

  // The image's preview object, a plain file's (a PDF's first page, ADR-0032), or the video's
  // thumbnail — only once its upload is READY, the status of an image or a video being its backing
  // file's. Never an original: until its preview exists, or when none can be made, a grid shows no
  // picture rather than download what may be a 100 MB GIF (ADR-0027). A failed signature leaves the
  // item without one too.
  private signPreview(item: NestStorage.StorageObjectPopulated): Either<Error, string> | undefined {
    if (item.file?.uploadStatus !== NestStorage.FileUploadStatus.READY) {
      return;
    }

    if (item.type === NestStorage.StorageObjectType.IMAGE && item.image?.previewProviderId) {
      return this.storageFileService.getFileSignedUrl(item.image.previewProviderId);
    }

    if (item.type === NestStorage.StorageObjectType.FILE && item.file.previewProviderId) {
      return this.storageFileService.getFileSignedUrl(item.file.previewProviderId);
    }

    if (item.type === NestStorage.StorageObjectType.VIDEO && item.video?.providerId) {
      return this.storageVideoService.getThumbnailUrl(item.video.providerId);
    }
  }

  private getSorters(sorters: NestStorage.StorageObjectSorter[] = []): NestCommon.Sorter[] {
    const requested = sorters.map(({ field, order }) => ({ field: SORT_FIELDS[field], order }));
    return [FOLDERS_FIRST, ...(requested.length ? requested : [BY_NAME]), BY_ID];
  }
}
