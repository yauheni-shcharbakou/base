import { pathProvider } from '@/common/providers';
import { Database, StorageDatabaseEntity } from '@packages/common';
import { BrowserStorage } from '@packages/proto';

type TargetSource = Pick<
  BrowserStorage.StorageObjectFolderItem,
  'id' | 'type' | 'fileId' | 'videoId'
> & {
  file?: Pick<BrowserStorage.File, 'uploadStatus'>;
};

/**
 * Where a click on a folder item leads: into a folder; to the file itself in a new tab, through the
 * same `open` / `player` route handlers as a show page's Open button; or, for media with no bytes
 * to show yet, to its show page, which tells why.
 */
export type FolderItemTarget =
  | { kind: 'folder'; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'details'; href: string };

const isReady = (item: TargetSource) =>
  item.file?.uploadStatus === BrowserStorage.FileUploadStatus.READY;

/** The `open` / `player` route of a READY item; nothing before its upload is done. */
export const getFolderItemOpenUrl = (item: TargetSource): string | undefined => {
  if (!isReady(item)) {
    return;
  }

  if (item.type === BrowserStorage.StorageObjectType.VIDEO) {
    return item.videoId ? `/api/${StorageDatabaseEntity.VIDEO}/${item.videoId}/player` : undefined;
  }

  return item.fileId ? `/api/${StorageDatabaseEntity.FILE}/${item.fileId}/open` : undefined;
};

/** The download route of a READY item — a video downloads by its own id, the rest by the file's. */
export const getFolderItemDownloadUrl = (item: TargetSource): string | undefined => {
  if (!isReady(item)) {
    return;
  }

  if (item.type === BrowserStorage.StorageObjectType.VIDEO) {
    return item.videoId
      ? `/api/${StorageDatabaseEntity.VIDEO}/${item.videoId}/download`
      : undefined;
  }

  return item.fileId ? `/api/${StorageDatabaseEntity.FILE}/${item.fileId}/download` : undefined;
};

export const getFolderContentPath = (folderId: string) =>
  pathProvider.getContentPath(Database.STORAGE, StorageDatabaseEntity.STORAGE_OBJECT, folderId);

export const getFolderItemTarget = (item: TargetSource): FolderItemTarget => {
  if (item.type === BrowserStorage.StorageObjectType.FOLDER) {
    return { kind: 'folder', href: getFolderContentPath(item.id) };
  }

  const openUrl = getFolderItemOpenUrl(item);

  if (openUrl) {
    return { kind: 'external', href: openUrl };
  }

  return {
    kind: 'details',
    href: pathProvider.getShowPath(Database.STORAGE, StorageDatabaseEntity.STORAGE_OBJECT, item.id),
  };
};

/**
 * The item to mark on the way up to `targetId`, one of the folder's ancestors: the next folder down
 * the path — the folder itself for its parent — as Finder selects the folder just left.
 */
export const getChildOnPath = (
  ancestors: Pick<BrowserStorage.StorageObjectAncestor, 'id'>[],
  folderId: string,
  targetId: string,
): string | undefined => {
  const path = [...ancestors.map((ancestor) => ancestor.id), folderId];
  const index = path.indexOf(targetId);

  return index >= 0 ? path[index + 1] : undefined;
};
