import { folderActionProvider } from '@/features/storage/providers';
import { useQuery } from '@tanstack/react-query';

export const USER_FOLDERS_QUERY_KEY = ['storage-user-folders'];

/**
 * Every folder of an owner, with its path — the tree a folder picker walks. Read afresh whenever a
 * picker mounts or opens: a folder made, moved or deleted since would be missing or misplaced.
 */
export const useUserFolders = (userId?: string, { enabled = true } = {}) =>
  useQuery({
    queryKey: [...USER_FOLDERS_QUERY_KEY, userId],
    queryFn: () => folderActionProvider.getUserFolders(userId as string),
    enabled: !!userId && enabled,
    staleTime: 0,
  });
