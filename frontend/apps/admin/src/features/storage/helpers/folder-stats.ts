import type { BrowserStorage } from '@packages/proto';
import { formatFileSize } from './file-size';

const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * What a folder holds over its whole subtree, as a caption: "12 files, 3 folders", a part left out
 * when it is zero, "Empty" when both are. A file counts once its upload is READY.
 */
export const formatFolderCounts = ({
  fileCount,
  folderCount,
}: BrowserStorage.StorageObjectFolderStats): string => {
  const parts = [
    fileCount ? counted(fileCount, 'file') : '',
    folderCount ? counted(folderCount, 'folder') : '',
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : 'Empty';
};

/** The counts and, when there are files, their size: "12 files, 3 folders · 34.5 MB". */
export const formatFolderStats = (stats: BrowserStorage.StorageObjectFolderStats): string => {
  const counts = formatFolderCounts(stats);
  return stats.fileCount ? `${counts} · ${formatFileSize(stats.totalSize)}` : counts;
};
