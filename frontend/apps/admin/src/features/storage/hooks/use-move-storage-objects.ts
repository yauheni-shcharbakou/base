import { useReplacingNotification } from '@/common/hooks';
import { getErrorMessage } from '@/common/helpers';
import { getRenamedItems } from '@/features/storage/helpers';
import { folderActionProvider } from '@/features/storage/providers';
import { StorageDatabaseEntity } from '@packages/common';
import type { BrowserStorage } from '@packages/proto';
import { useInvalidate } from '@refinedev/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dropFromFolderListings } from './folder-listing-cache';
import { FOLDER_CONTENT_QUERY_KEY } from './use-folder-content';

type Item = Pick<BrowserStorage.StorageObjectFolderItem, 'id' | 'name' | 'parentId'>;

export type MoveRequest = {
  items: Item[];
  target: { id: string; name: string };
};

const { STORAGE_OBJECT } = StorageDatabaseEntity;

const describeItems = (items: Item[]) =>
  items.length === 1 ? `“${items[0].name}”` : `${items.length} items`;

/**
 * Moves folder items into another folder of their owner — one gateway call, all or none: a
 * selection holds no more than it takes (`MAX_SELECTION`). A name taken there comes back suffixed —
 * never refused — and the notification says which.
 */
export const useMoveStorageObjects = () => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const notify = useReplacingNotification();

  const refresh = (items: Item[], target: MoveRequest['target']) => {
    // Out of the folder they left at once; the refetch fills the page and the target's listing.
    dropFromFolderListings(
      queryClient,
      items.filter((item) => item.parentId !== target.id),
    );
    queryClient.invalidateQueries({ queryKey: FOLDER_CONTENT_QUERY_KEY });
    invalidate({ resource: STORAGE_OBJECT, invalidates: ['list', 'many'] });
    items.forEach(({ id }) =>
      invalidate({ resource: STORAGE_OBJECT, id, invalidates: ['detail'] }),
    );
  };

  return useMutation({
    mutationFn: ({ items, target }: MoveRequest) =>
      folderActionProvider.moveMany(
        items.map(({ id }) => id),
        target.id,
      ),
    onSuccess: (moved, { items, target }) => {
      const renamed = getRenamedItems(items, moved);

      notify({
        type: 'success',
        message: `${describeItems(items)} moved to “${target.name}”`,
        description: renamed.length
          ? `Renamed: ${renamed.map(({ from, to }) => `“${from}” → “${to}”`).join(', ')}`
          : undefined,
        key: 'storage-object-move',
      });

      refresh(items, target);
    },
    onError: (error, { items, target }) =>
      notify({
        type: 'error',
        message: `Could not move ${describeItems(items)} to “${target.name}”`,
        description: getErrorMessage(error),
        key: 'storage-object-move',
      }),
  });
};
