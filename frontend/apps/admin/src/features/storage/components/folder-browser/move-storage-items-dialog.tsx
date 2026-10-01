'use client';

import { FolderPickerDialog } from '@/features/storage/components/folder-picker';
import { useRootFolderLabel } from '@/features/storage/hooks';
import type { BrowserStorage } from '@packages/proto';
import React, { FC, useRef } from 'react';
import type { DropFolder } from './use-folder-item-behavior';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  // The items to move — shown while there are any.
  items?: Item[];
  // The folder they are in.
  folder: Pick<BrowserStorage.StorageObject, 'id' | 'userId'>;
  isMoving: boolean;
  onCancel: () => void;
  onConfirm: (items: Item[], target: DropFolder) => void;
};

/**
 * Drive's "Move to": a folder picker that opens on the folder the items are in. That folder is no
 * target, and the moved folders cannot be entered. A name taken in the target gets a ` (n)`.
 */
export const MoveStorageItemsDialog: FC<Props> = ({
  items,
  folder,
  isMoving,
  onCancel,
  onConfirm,
}) => {
  // The items stay on screen while the dialog fades out after they are gone.
  const shown = useRef(items);
  shown.current = items?.length ? items : shown.current;
  const targets = shown.current ?? [];
  const rootLabel = useRootFolderLabel(folder.userId);

  const title = targets.length === 1 ? `Move “${targets[0].name}”` : `Move ${targets.length} items`;

  return (
    <FolderPickerDialog
      open={!!items?.length}
      title={title}
      userId={folder.userId}
      initialLocation={folder.id}
      blockedIds={targets.filter((item) => item.isFolder).map(({ id }) => id)}
      currentId={folder.id}
      confirmLabel="Move"
      isBusy={isMoving}
      onCancel={onCancel}
      onConfirm={(target) =>
        items?.length && onConfirm(items, { id: target.id, name: target.name || rootLabel })
      }
    />
  );
};
