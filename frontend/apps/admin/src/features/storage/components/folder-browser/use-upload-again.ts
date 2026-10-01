import { useReplacingNotification } from '@/common/hooks';
import { sortUploads } from '@/features/storage/helpers';
import { storageUploadQueue, useDeleteStorageObjects } from '@/features/storage/hooks';
import type { BrowserStorage } from '@packages/proto';
import { ChangeEvent, useCallback, useRef } from 'react';

type Item = BrowserStorage.StorageObjectFolderItem;

type Options = {
  // Queues the picked file into the folder shown — `useFileDrop`'s `uploadFiles`.
  onUpload: (files: File[]) => void;
};

/**
 * "Upload again" on an item whose upload failed: a file is picked, the failed item is deleted —
 * which frees its name at once — and the file joins the upload queue in its place. Nothing is
 * deleted until a file the queue takes has been picked. The failed row itself cannot take the
 * bytes: only the create call hands out upload credentials, and this page may never have held them.
 */
export const useUploadAgain = ({ onUpload }: Options) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const target = useRef<Item>(undefined);
  const notify = useReplacingNotification();
  const deletion = useDeleteStorageObjects({ isQuiet: true });

  const uploadAgain = useCallback((item: Item) => {
    target.current = item;
    inputRef.current?.click();
  }, []);

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    const item = target.current;
    // The same file picked again is a change too.
    event.target.value = '';

    if (!file || !item) {
      return;
    }

    const [refused] = sortUploads([file]).rejected;

    if (refused) {
      notify({
        type: 'error',
        message: `“${refused.name}” not uploaded`,
        description: refused.reason,
        key: 'storage-upload-again',
      });
      return;
    }

    deletion.mutate([item], {
      onSuccess: () => {
        if (item.fileId) {
          storageUploadQueue.dismissFailedOf(item.fileId);
        }

        onUpload([file]);
      },
    });
  };

  return {
    uploadAgain,
    // A hidden `<input>` the caller renders: the picker opens from a click on it.
    inputProps: { ref: inputRef, type: 'file', hidden: true, onChange: handlePick } as const,
  };
};
