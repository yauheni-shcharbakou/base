import { useReplacingNotification } from '@/common/hooks';
import {
  findFailedUpload,
  findReplacement,
  getReplaceStep,
  holdReplacedItem,
  REPLACED_HOLD_MS,
  ReplacedItem,
  sortUploads,
} from '@/features/storage/helpers';
import {
  storageUploadQueue,
  useDeleteStorageObjects,
  useStorageUploads,
} from '@/features/storage/hooks';
import type { BrowserStorage } from '@packages/proto';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DropFolder } from './use-folder-item-behavior';

type Item = BrowserStorage.StorageObjectFolderItem;

type Options = {
  // The folder shown and its owner: where the new upload goes. Nothing is offered before they load.
  userId?: string;
  folder?: DropFolder;
  // The page as listed, and the listing it is: folder, page, order, filters.
  items: Item[];
  scope: string;
  // The item on show — the gallery's selection, the viewer's item — and how to change it.
  currentId?: string;
  onShow: (id: string) => void;
};

/**
 * "Upload again" on an item whose upload failed: the failed item is deleted — which frees its name
 * at once — and a file joins the upload queue in its place. The file is the one this tab's queue
 * still holds for the item, when the upload failed here; otherwise it is picked, and nothing is
 * deleted until a file the queue takes has been. The failed row itself cannot take the bytes: only
 * the create call hands out upload credentials.
 *
 * The deleted item stays on the page (`items`, which the views take in place of the listing's),
 * showing the new upload's progress, until the listing brings the new item: the viewer stands
 * still, then shows the new item, and never visits a neighbour in between (`getReplaceStep`).
 * Cancelling the new upload lets the held item go, as a deleted one does.
 */
export const useUploadAgain = ({ userId, folder, items, scope, currentId, onShow }: Options) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const target = useRef<Item>(undefined);
  const notify = useReplacingNotification();
  const { mutate: deleteItems } = useDeleteStorageObjects({ isQuiet: true });
  const uploads = useStorageUploads();
  const [held, setHeld] = useState<ReplacedItem<Item>>();
  // Redraws when the wait for the listing runs out: nothing else changes then.
  const [deadline, setDeadline] = useState(0);

  useEffect(() => {
    if (!held) {
      return;
    }

    const upload = uploads.find(({ key }) => key === held.key);
    const now = Date.now();
    const step = getReplaceStep(held, { upload, items, scope, now });

    switch (step.type) {
      case 'settle':
        setHeld({ ...held, settledAt: now });
        return;
      case 'release':
        setHeld(undefined);
        return;
      case 'swap':
        // The view moves first, and the held item goes once it has: gone from under the viewer, it
        // would send it to a neighbour.
        if (currentId === held.item.id) {
          onShow(step.id);
        } else {
          setHeld(undefined);
        }
        return;
    }

    if (held.settledAt === undefined) {
      return;
    }

    const timer = setTimeout(
      () => setDeadline((passed) => passed + 1),
      held.settledAt + REPLACED_HOLD_MS - now,
    );

    return () => clearTimeout(timer);
  }, [held, uploads, items, scope, currentId, onShow, deadline]);

  const replace = useCallback(
    (item: Item, file: File) => {
      if (!userId || !folder) {
        return;
      }

      const { accepted, rejected } = sortUploads([file]);

      if (!accepted.length) {
        notify({
          type: 'error',
          message: `“${file.name}” not uploaded`,
          description: rejected[0]?.reason,
          key: 'storage-upload-again',
        });
        return;
      }

      const index = Math.max(
        items.findIndex(({ id }) => id === item.id),
        0,
      );

      deleteItems([item], {
        onSuccess: () => {
          // Its retry would send the bytes to the record just deleted.
          if (item.fileId) {
            storageUploadQueue.dismissFailedOf(item.fileId);
          }

          const [key] = storageUploadQueue.enqueue(
            accepted.map(({ file, kind }) => ({ file, kind, folder, replaces: item.id })),
            userId,
          );
          setHeld({ key, item, index, scope });
        },
      });
    },
    [userId, folder, items, scope, notify, deleteItems],
  );

  const uploadAgain = useCallback(
    (item: Item) => {
      const failedHere = item.fileId
        ? findFailedUpload(storageUploadQueue.getSnapshot(), item.fileId)
        : undefined;

      if (failedHere) {
        replace(item, failedHere.file);
        return;
      }

      target.current = item;
      inputRef.current?.click();
    },
    [replace],
  );

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    const item = target.current;
    // The same file picked again is a change too.
    event.target.value = '';

    if (file && item) {
      replace(item, file);
    }
  };

  // Once the view stands on the new item the held one is gone at once, not an effect later: for
  // that one render the page would list both, and count one item too many.
  const upload = held && uploads.find(({ key }) => key === held.key);
  const isSwapped = !!held && currentId !== held.item.id && !!findReplacement(upload, items);
  const shownItems = useMemo(
    () => (isSwapped ? items : holdReplacedItem(items, scope, held)),
    [isSwapped, items, scope, held],
  );

  // How many items the page shows beyond the listing's own: the one held, or none.
  const heldCount = shownItems.length - items.length;

  return {
    // The page with the item being replaced still on it.
    items: shownItems,
    heldCount,
    // The item held on the page. It is deleted: nothing may act on it.
    heldId: heldCount ? held?.item.id : undefined,
    uploadAgain,
    // A hidden `<input>` the caller renders: the picker opens from a click on it.
    inputProps: { ref: inputRef, type: 'file', hidden: true, onChange: handlePick } as const,
  };
};
