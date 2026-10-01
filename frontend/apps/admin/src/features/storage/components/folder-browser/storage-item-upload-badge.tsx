'use client';

import { getFileUploadStatusColor, getUploadProgress } from '@/features/storage/helpers';
import { useUploadOf } from '@/features/storage/hooks';
import { Chip, LinearProgress } from '@mui/material';
import { BrowserStorage } from '@packages/proto';
import React, { FC } from 'react';

type Props = {
  item: BrowserStorage.StorageObjectFolderItem;
  // Laid over the item's thumbnail — the badge in its corner, a bar along its bottom — instead of
  // in the line it is written in.
  isOverlay?: boolean;
};

/**
 * What a file that cannot be opened yet says of its upload, on its tile and in its row: how far
 * this tab's upload of it is — its own, or the one taking its place (`getUploadProgress`) — else
 * the status of its row. Nothing for a folder, or a file that is READY.
 */
export const StorageItemUploadBadge: FC<Props> = ({ item, isOverlay = false }) => {
  const upload = useUploadOf(item);
  const status = item.file?.uploadStatus;

  if (item.isFolder || status === BrowserStorage.FileUploadStatus.READY) {
    return null;
  }

  const progress = getUploadProgress(upload, item.id);
  const sx = {
    height: 20,
    flexShrink: 0,
    ...(isOverlay && { position: 'absolute', left: 6, top: 6 }),
  } as const;

  if (!progress) {
    return (
      <Chip
        size="small"
        label={status ?? 'NO FILE'}
        color={getFileUploadStatusColor(status) ?? 'default'}
        sx={sx}
      />
    );
  }

  return (
    <>
      <Chip
        size="small"
        label={isOverlay ? progress.label : progress.short}
        title={progress.label}
        color="primary"
        sx={sx}
      />
      {isOverlay && (
        <LinearProgress
          variant={progress.percent === undefined ? 'indeterminate' : 'determinate'}
          value={progress.percent}
          aria-label={`Upload progress of ${item.name}`}
          sx={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        />
      )}
    </>
  );
};
