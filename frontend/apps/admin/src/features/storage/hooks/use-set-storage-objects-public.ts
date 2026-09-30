import { useReplacingNotification } from '@/common/hooks';
import { getErrorMessage } from '@/common/helpers';
import { folderActionProvider } from '@/features/storage/providers';
import { StorageDatabaseEntity } from '@packages/common';
import type { BrowserStorage } from '@packages/proto';
import { useInvalidate } from '@refinedev/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchFolderListings } from './folder-listing-cache';
import { FOLDER_CONTENT_QUERY_KEY } from './use-folder-content';

type Item = Pick<BrowserStorage.StorageObjectFolderItem, 'id' | 'name'>;

export type PublicRequest = { items: Item[]; isPublic: boolean };

const { STORAGE_OBJECT } = StorageDatabaseEntity;

const describeItems = (items: Item[]) =>
  items.length === 1 ? `“${items[0].name}”` : `${items.length} items`;

const describeState = (isPublic: boolean) => (isPublic ? 'public' : 'private');

/**
 * Makes folder items public or private — one gateway call, all or none, each folder with its whole
 * subtree. An item in a public folder cannot be made private: the call is refused and nothing
 * changes. Every cached listing may go stale, a folder's content included.
 */
export const useSetStorageObjectsPublic = () => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const notify = useReplacingNotification();

  return useMutation({
    mutationFn: ({ items, isPublic }: PublicRequest) =>
      folderActionProvider.setPublic(
        items.map(({ id }) => id),
        isPublic,
      ),
    onSuccess: (written, { items, isPublic }) => {
      notify({
        type: 'success',
        message: `${describeItems(items)} made ${describeState(isPublic)}`,
        key: 'storage-object-public',
      });

      patchFolderListings(queryClient, written);
      queryClient.invalidateQueries({ queryKey: FOLDER_CONTENT_QUERY_KEY });
      invalidate({ resource: STORAGE_OBJECT, invalidates: ['list', 'many'] });
      items.forEach(({ id }) =>
        invalidate({ resource: STORAGE_OBJECT, id, invalidates: ['detail'] }),
      );
    },
    onError: (error, { items, isPublic }) =>
      notify({
        type: 'error',
        message: `Could not make ${describeItems(items)} ${describeState(isPublic)}`,
        description: getErrorMessage(error),
        key: 'storage-object-public',
      }),
  });
};
