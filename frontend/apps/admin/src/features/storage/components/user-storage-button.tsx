'use client';

import { RowActionButton } from '@/common/components';
import { getErrorMessage } from '@/common/helpers/error.helpers';
import { getFolderContentPath } from '@/features/storage/helpers';
import { folderActionProvider } from '@/features/storage/providers';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import { CircularProgress } from '@mui/material';
import { useNotification } from '@refinedev/core';
import { useRouter } from 'next/navigation';
import React, { FC, useState } from 'react';

type Props = {
  userId: string;
};

/** Opens a user's storage at its root folder, which is looked up on click. */
export const UserStorageButton: FC<Props> = ({ userId }) => {
  const [isLoading, setLoading] = useState(false);
  const router = useRouter();
  const { open } = useNotification();

  const handleClick = async () => {
    setLoading(true);

    try {
      const root = await folderActionProvider.getRootFolder(userId);
      router.push(getFolderContentPath(root.id));
    } catch (error) {
      open?.({
        type: 'error',
        message: 'Storage is unavailable',
        description: getErrorMessage(error),
        key: `user-storage-error-${userId}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <RowActionButton title="Storage" disabled={isLoading} onClick={handleClick}>
      {isLoading ? (
        <CircularProgress size={20} color="inherit" />
      ) : (
        <FolderOpenOutlined fontSize="small" />
      )}
    </RowActionButton>
  );
};
