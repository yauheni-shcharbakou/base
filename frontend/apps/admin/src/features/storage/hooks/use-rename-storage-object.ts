import { useReplacingNotification } from '@/common/hooks';
import { folderActionProvider } from '@/features/storage/providers';
import { StorageDatabaseEntity } from '@packages/common';
import { useInvalidate } from '@refinedev/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchFolderListings } from './folder-listing-cache';
import { FOLDER_CONTENT_QUERY_KEY } from './use-folder-content';
import { USER_FOLDERS_QUERY_KEY } from './use-user-folders';

export type RenameRequest = { id: string; name: string };

const { STORAGE_OBJECT } = StorageDatabaseEntity;

/**
 * Renames a folder item in place, as Drive's "Rename" does. A taken name is refused, not suffixed:
 * the error is left to the caller, which shows it by the name typed.
 */
export const useRenameStorageObject = () => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const notify = useReplacingNotification();

  return useMutation({
    mutationFn: ({ id, name }: RenameRequest) => folderActionProvider.rename(id, name.trim()),
    onSuccess: (renamed) => {
      notify({
        type: 'success',
        message: `Renamed to “${renamed.name}”`,
        key: 'storage-object-rename',
      });

      // In place at once; the refetch puts it where the order says. A folder's path changes too.
      patchFolderListings(queryClient, [renamed]);
      queryClient.invalidateQueries({ queryKey: FOLDER_CONTENT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: USER_FOLDERS_QUERY_KEY });
      invalidate({ resource: STORAGE_OBJECT, invalidates: ['list', 'many'] });
      invalidate({ resource: STORAGE_OBJECT, id: renamed.id, invalidates: ['detail'] });
    },
  });
};
