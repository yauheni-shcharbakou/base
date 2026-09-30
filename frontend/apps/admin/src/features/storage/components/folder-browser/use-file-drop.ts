import { isFileDrag, readDroppedFiles, sortUploads } from '@/features/storage/helpers';
import { storageUploadQueue } from '@/features/storage/hooks';
import { useNotification } from '@refinedev/core';
import { DragEvent, useCallback, useEffect, useState } from 'react';
import type { DropFolder } from './use-folder-item-behavior';

type Options = {
  // The folder's owner, who owns what is uploaded into it. No drop until it is known.
  userId?: string;
  // The folder shown, which takes a drop anywhere on the page but on a subfolder.
  folder?: DropFolder;
};

/**
 * Drive's drop from the desktop: files dropped on the folder — or on one of its subfolders or a
 * breadcrumb, through `useFolderItemBehavior` — join the upload queue. A folder, an empty file and
 * a file over its kind's limit are left out, and the notification says which.
 */
export const useFileDrop = ({ userId, folder }: Options) => {
  const { open } = useNotification();
  const [isOver, setIsOver] = useState(false);

  const upload = useCallback(
    (files: File[], target: DropFolder, folderCount = 0) => {
      if (!userId) {
        return;
      }

      const { accepted, rejected } = sortUploads(files);

      if (accepted.length) {
        storageUploadQueue.enqueue(accepted, { userId, folder: target });
      }

      const skipped = rejected.map(({ name, reason }) => `${name} (${reason})`);

      if (folderCount) {
        skipped.push(
          `${folderCount} ${folderCount === 1 ? 'folder' : 'folders'} (no folder upload)`,
        );
      }

      if (skipped.length) {
        open?.({
          type: 'error',
          message: `${skipped.length} not uploaded`,
          description: skipped.join(', '),
          key: `storage-upload-skipped-${Date.now()}`,
        });
      }
    },
    [userId, open],
  );

  /** The drop on a subfolder or a breadcrumb. Reads the files at once: the event empties them. */
  const uploadDropped = useCallback(
    (dataTransfer: DataTransfer, target: DropFolder) => {
      const { files, folderCount } = readDroppedFiles(dataTransfer);
      upload(files, target, folderCount);
    },
    [upload],
  );

  // A file dropped beside the folder would open in the tab, leaving the page mid-upload.
  useEffect(() => {
    const guard = (event: globalThis.DragEvent) => {
      if (event.dataTransfer && isFileDrag(event.dataTransfer.types) && !event.defaultPrevented) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'none';
      }

      if (event.type === 'drop') {
        setIsOver(false);
      }
    };

    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);

    return () => {
      window.removeEventListener('dragover', guard);
      window.removeEventListener('drop', guard);
    };
  }, []);

  const zoneProps =
    userId && folder
      ? {
          onDragOver: (event: DragEvent) => {
            if (isFileDrag(event.dataTransfer.types)) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
              setIsOver(true);
            }
          },
          onDragLeave: (event: DragEvent) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsOver(false);
            }
          },
          onDrop: (event: DragEvent) => {
            setIsOver(false);

            // A subfolder or a breadcrumb has taken it.
            if (event.defaultPrevented || !isFileDrag(event.dataTransfer.types)) {
              return;
            }

            event.preventDefault();
            uploadDropped(event.dataTransfer, folder);
          },
        }
      : {};

  return { isOver, zoneProps, upload, uploadDropped };
};
