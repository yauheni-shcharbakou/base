import { AuthDatabaseEntity } from '@packages/common';
import type { BrowserAuth } from '@packages/proto';
import { useOne } from '@refinedev/core';

/** What a user's root folder, which has no name, goes by: its owner's email. */
export const useRootFolderLabel = (userId?: string): string => {
  const { query } = useOne<BrowserAuth.User>({
    resource: AuthDatabaseEntity.USER,
    id: userId,
    queryOptions: { enabled: !!userId },
    errorNotification: false,
  });

  return query.data?.data?.email ? `${query.data.data.email}’s storage` : 'Root folder';
};
