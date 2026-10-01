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
 * Where opening a folder item leads: into a folder; to the file itself in a new tab, through the
 * same `open` / `player` route handlers as a show page's Open button; or nowhere, for media with no
 * bytes to show yet — the viewer says why (`getFolderItemUnavailableReason`).
 */
export type FolderItemTarget =
  { kind: 'folder'; href: string } | { kind: 'external'; href: string } | { kind: 'unavailable' };

const { READY, PENDING, UPLOADED, FAILED } = BrowserStorage.FileUploadStatus;

const isReady = (item: TargetSource) => item.file?.uploadStatus === READY;

const NO_FILE_REASON = 'No file to open';

// A Record, so a status added later has to say what it means here.
const REASON_BY_STATUS: Record<BrowserStorage.FileUploadStatus, string> = {
  [PENDING]: 'Upload not finished',
  [UPLOADED]: 'Uploaded — still being processed',
  [FAILED]: 'Upload failed',
  // READY with nothing to open: the row names no file or video.
  [READY]: NO_FILE_REASON,
};

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

  return openUrl ? { kind: 'external', href: openUrl } : { kind: 'unavailable' };
};

/**
 * Why an item cannot be opened, in words for the viewer: what its upload is at. Nothing for a
 * folder, or for an item that opens.
 */
export const getFolderItemUnavailableReason = (item: TargetSource): string | undefined => {
  if (getFolderItemTarget(item).kind !== 'unavailable') {
    return;
  }

  const status = item.file?.uploadStatus;

  return status ? REASON_BY_STATUS[status] : NO_FILE_REASON;
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
