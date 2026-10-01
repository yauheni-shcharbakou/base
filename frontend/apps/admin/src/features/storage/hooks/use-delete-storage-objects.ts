import { useReplacingNotification } from '@/common/hooks';
import { getErrorMessage } from '@/common/helpers';
import { folderActionProvider } from '@/features/storage/providers';
import { StorageDatabaseEntity } from '@packages/common';
import type { BrowserStorage } from '@packages/proto';
import { useInvalidate } from '@refinedev/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dropFromFolderListings } from './folder-listing-cache';
import { FOLDER_CONTENT_QUERY_KEY } from './use-folder-content';

type Item = Pick<BrowserStorage.StorageObjectFolderItem, 'id' | 'name'>;

const { STORAGE_OBJECT } = StorageDatabaseEntity;

const describeItems = (items: Item[]) =>
  items.length === 1 ? `“${items[0].name}”` : `${items.length} items`;

/**
 * Deletes folder items — each folder with everything under it — in one gateway call, all or none: a
 * selection holds no more than it takes (`MAX_SELECTION`). The service only marks the subtrees deleted, with no restore, so the caller
 * confirms first. Every cached listing goes stale: the items' folder lost them, and a deleted
 * folder's own pages are gone. `isQuiet` keeps a success to itself, for a delete that is a step of
 * something else — a failure is still told.
 */
export const useDeleteStorageObjects = ({ isQuiet = false }: { isQuiet?: boolean } = {}) => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const notify = useReplacingNotification();

  const refresh = (items: Item[]) => {
    // Gone from the screen at once; the refetch then brings the page's next items up.
    dropFromFolderListings(queryClient, items);
    queryClient.invalidateQueries({ queryKey: FOLDER_CONTENT_QUERY_KEY });
    invalidate({ resource: STORAGE_OBJECT, invalidates: ['list', 'many'] });
    items.forEach(({ id }) =>
      invalidate({ resource: STORAGE_OBJECT, id, invalidates: ['detail'] }),
    );
  };

  return useMutation({
    mutationFn: (items: Item[]) => folderActionProvider.deleteMany(items.map(({ id }) => id)),
    onSuccess: (_, items) => {
      if (!isQuiet) {
        notify({
          type: 'success',
          message: `${describeItems(items)} deleted`,
          key: 'storage-object-delete',
        });
      }

      refresh(items);
    },
    onError: (error, items) =>
      notify({
        type: 'error',
        message: `Could not delete ${describeItems(items)}`,
        description: getErrorMessage(error),
        key: 'storage-object-delete',
      }),
  });
};
