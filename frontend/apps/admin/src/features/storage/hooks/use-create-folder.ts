import { folderActionProvider } from '@/features/storage/providers';
import { StorageDatabaseEntity } from '@packages/common';
import { useInvalidate } from '@refinedev/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FOLDER_CONTENT_QUERY_KEY } from './use-folder-content';
import { USER_FOLDERS_QUERY_KEY } from './use-user-folders';

export type CreateFolderRequest = { userId: string; parent: string; name: string };

const { STORAGE_OBJECT } = StorageDatabaseEntity;

/**
 * Makes a folder, as Drive's "Move to" does in place. Resolves once the owner's folder list has
 * been read again, so a picker can pick the new folder straight away. A taken name is refused — the
 * caller shows the error by the name typed.
 */
export const useCreateFolder = () => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ userId, parent, name }: CreateFolderRequest) =>
      folderActionProvider.createFolder(userId, parent, name.trim()),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: FOLDER_CONTENT_QUERY_KEY });
      invalidate({ resource: STORAGE_OBJECT, invalidates: ['list', 'many'] });
      await queryClient.invalidateQueries({ queryKey: USER_FOLDERS_QUERY_KEY });
    },
  });
};
