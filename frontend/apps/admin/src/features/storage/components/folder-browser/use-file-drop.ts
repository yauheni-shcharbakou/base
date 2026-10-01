import { getErrorMessage } from '@/common/helpers';
import {
  DroppedTree,
  isFileDrag,
  MAX_TREE_FOLDERS,
  readDirectoryInput,
  readDroppedTree,
  sortUploads,
} from '@/features/storage/helpers';
import {
  FOLDER_CONTENT_QUERY_KEY,
  storageUploadQueue,
  USER_FOLDERS_QUERY_KEY,
} from '@/features/storage/hooks';
import { folderActionProvider } from '@/features/storage/providers';
import { useNotification } from '@refinedev/core';
import { useQueryClient } from '@tanstack/react-query';
import { DragEvent, useCallback, useEffect, useState } from 'react';
import type { DropFolder } from './use-folder-item-behavior';

type Options = {
  // The folder's owner, who owns what is uploaded into it. No drop until it is known.
  userId?: string;
  // The folder shown, which takes a drop anywhere on the page but on a subfolder.
  folder?: DropFolder;
};

/**
 * Drive's upload from the desktop: files and whole folders dropped on the folder — or on one of its
 * subfolders or a breadcrumb, through `useFolderItemBehavior` — or picked through "New". A dropped
 * folder is made with its whole tree in one call first (`createFolders`; a top-level name taken in
 * the target gets a ` (n)` suffix), then its files join the upload queue, each into its own folder.
 * An empty file and a file over its kind's limit are left out, and the notification says which.
 */
export const useFileDrop = ({ userId, folder }: Options) => {
  const { open } = useNotification();
  const queryClient = useQueryClient();
  const [isOver, setIsOver] = useState(false);
  // Where a drop is going while its folders are read and made — before any file is queued.
  const [preparing, setPreparing] = useState<DropFolder>();

  const fail = useCallback(
    (message: string, description?: string) =>
      open?.({
        type: 'error',
        message,
        description,
        key: `storage-upload-skipped-${Date.now()}`,
      }),
    [open],
  );

  // The tree's folders in `target`, by their path in the tree: '' is the target itself.
  const makeFolders = useCallback(
    async (userId: string, folders: string[], target: DropFolder) => {
      const byPath = new Map<string, DropFolder>([['', target]]);

      if (!folders.length) {
        return byPath;
      }

      const created = await folderActionProvider.createFolders(userId, target.id, folders);
      folders.forEach((path, index) => {
        const { id, name } = created[index];
        byPath.set(path, { id, name });
      });

      // The new folders show at once, before their files are in.
      queryClient.invalidateQueries({ queryKey: FOLDER_CONTENT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: USER_FOLDERS_QUERY_KEY });

      return byPath;
    },
    [queryClient],
  );

  const uploadTree = useCallback(
    async ({ entries, folders }: DroppedTree, target: DropFolder) => {
      if (!userId) {
        return;
      }

      if (folders.length > MAX_TREE_FOLDERS) {
        fail(
          'Nothing uploaded',
          `${folders.length} folders — one upload makes at most ${MAX_TREE_FOLDERS}`,
        );
        return;
      }

      let folderByPath: Map<string, DropFolder>;

      try {
        folderByPath = await makeFolders(userId, folders, target);
      } catch (error) {
        fail(`${folders.length === 1 ? 'Folder' : 'Folders'} not uploaded`, getErrorMessage(error));
        return;
      }

      const pathByFile = new Map(entries.map(({ file, path }) => [file, path]));
      const { accepted, rejected } = sortUploads(entries.map(({ file }) => file));

      if (accepted.length) {
        storageUploadQueue.enqueue(
          accepted.map(({ file, kind }) => {
            const path = pathByFile.get(file) ?? '';

            return {
              file,
              kind,
              folder: folderByPath.get(path) ?? target,
              // The top of its tree: the upload box shows each uploaded folder as one row.
              group: path ? folderByPath.get(path.split('/')[0]) : undefined,
            };
          }),
          userId,
        );
      }

      if (rejected.length) {
        fail(
          `${rejected.length} not uploaded`,
          rejected.map(({ name, reason }) => `${name} (${reason})`).join(', '),
        );
      }
    },
    [userId, fail, makeFolders],
  );

  /** Files picked through "New → File upload", into `target` itself. */
  const uploadFiles = useCallback(
    (files: File[], target: DropFolder) =>
      void uploadTree({ entries: files.map((file) => ({ file, path: '' })), folders: [] }, target),
    [uploadTree],
  );

  // Until the files are queued, nothing else shows that the upload has started.
  const prepare = useCallback(
    (target: DropFolder, work: () => Promise<void>) => {
      setPreparing(target);
      work()
        .catch((error) => fail('Nothing uploaded', getErrorMessage(error)))
        .finally(() => setPreparing(undefined));
    },
    [fail],
  );

  /** A folder picked through "New → Folder upload", with its tree. */
  const uploadDirectory = useCallback(
    (files: File[], target: DropFolder) =>
      prepare(target, () => uploadTree(readDirectoryInput(files), target)),
    [prepare, uploadTree],
  );

  /** A drop, on the folder or a subfolder. Starts reading at once: the event empties the list. */
  const uploadDropped = useCallback(
    (dataTransfer: DataTransfer, target: DropFolder) => {
      const reading = readDroppedTree(dataTransfer);
      prepare(target, async () => uploadTree(await reading, target));
    },
    [prepare, uploadTree],
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

  return { isOver, preparing, zoneProps, uploadFiles, uploadDirectory, uploadDropped };
};
