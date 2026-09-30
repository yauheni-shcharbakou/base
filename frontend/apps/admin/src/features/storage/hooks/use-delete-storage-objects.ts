import { getErrorMessage } from '@/common/helpers';
import { runInBatches, StorageBatchError } from '@/features/storage/helpers';
import { folderActionProvider } from '@/features/storage/providers';
import { StorageDatabaseEntity } from '@packages/common';
import type { BrowserStorage } from '@packages/proto';
import { useInvalidate, useNotification } from '@refinedev/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dropFromFolderListings } from './folder-listing-cache';
import { FOLDER_CONTENT_QUERY_KEY } from './use-folder-content';

type Item = Pick<BrowserStorage.StorageObjectFolderItem, 'id' | 'name'>;

const { STORAGE_OBJECT } = StorageDatabaseEntity;

const describeItems = (items: Item[]) =>
  items.length === 1 ? `“${items[0].name}”` : `${items.length} items`;

/**
 * Deletes folder items — each folder with everything under it — one gateway call, all or none, per
 * 100 items (`runInBatches`); a run stopped part way fails with a `StorageBatchError` naming the
 * items deleted. The service only marks the subtrees deleted, with no restore, so the caller
 * confirms first. Every cached listing goes stale: the items' folder lost them, and a deleted
 * folder's own pages are gone.
 */
export const useDeleteStorageObjects = () => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const { open } = useNotification();

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
    mutationFn: (items: Item[]) =>
      runInBatches(items, (batch) => folderActionProvider.deleteMany(batch.map(({ id }) => id))),
    onSuccess: (_, items) => {
      open?.({
        type: 'success',
        message: `${describeItems(items)} deleted`,
        key: 'storage-object-delete',
      });

      refresh(items);
    },
    onError: (error, items) => {
      const done = error instanceof StorageBatchError ? (error.done as Item[]) : [];

      open?.({
        type: 'error',
        message: done.length
          ? `Deleted ${done.length} of ${items.length} items`
          : `Could not delete ${describeItems(items)}`,
        description: getErrorMessage(error instanceof StorageBatchError ? error.cause : error),
        key: 'storage-object-delete',
      });

      if (done.length) {
        refresh(done);
      }
    },
  });
};
