import { getErrorMessage } from '@/common/helpers';
import { deleteOne } from '@/features/grpc/actions';
import { unwrapActionResult } from '@/features/grpc/helpers/unwrap-action-result';
import { StorageDatabaseEntity } from '@packages/common';
import type { BrowserStorage } from '@packages/proto';
import { useInvalidate, useNotification } from '@refinedev/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FOLDER_CONTENT_QUERY_KEY } from './use-folder-content';

type Item = Pick<BrowserStorage.StorageObjectFolderItem, 'id' | 'name'>;

const { STORAGE_OBJECT } = StorageDatabaseEntity;

/**
 * Deletes a folder item — a folder with everything under it. The service only marks the subtree
 * deleted, with no restore, so the caller confirms first. Every cached listing goes stale: the
 * item's folder lost it, and a deleted folder's own pages are gone.
 */
export const useDeleteStorageObject = () => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const { open } = useNotification();

  return useMutation({
    mutationFn: async (item: Item) =>
      unwrapActionResult(await deleteOne({ resource: STORAGE_OBJECT, id: item.id })),
    onSuccess: (_, item) => {
      open?.({
        type: 'success',
        message: `“${item.name}” deleted`,
        key: `storage-object-delete-${item.id}`,
      });

      // Gone from the screen at once; the refetch then brings the page's next item up.
      queryClient.setQueriesData<BrowserStorage.StorageObjectFolderContent>(
        { queryKey: FOLDER_CONTENT_QUERY_KEY },
        (content) =>
          content?.items.some(({ id }) => id === item.id)
            ? {
                ...content,
                items: content.items.filter(({ id }) => id !== item.id),
                total: content.total - 1,
              }
            : content,
      );

      queryClient.invalidateQueries({ queryKey: FOLDER_CONTENT_QUERY_KEY });
      invalidate({
        resource: STORAGE_OBJECT,
        id: item.id,
        invalidates: ['list', 'many', 'detail'],
      });
    },
    onError: (error, item) => {
      open?.({
        type: 'error',
        message: `Could not delete “${item.name}”`,
        description: getErrorMessage(error),
        key: `storage-object-delete-${item.id}`,
      });
    },
  });
};
