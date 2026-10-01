'use client';

import {
  getFolderItemUnavailableReason,
  getStorageItemKind,
  getUploadProgress,
} from '@/features/storage/helpers';
import { useUploadOf } from '@/features/storage/hooks';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import { Box, CircularProgress } from '@mui/material';
import { BrowserStorage } from '@packages/proto';
import React, { FC } from 'react';
import { StorageItemIcon } from './storage-item-icon';

type Props = {
  item: BrowserStorage.StorageObjectFolderItem;
};

// The square a small icon takes: whatever stands in for it keeps the name where it was.
const slotSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 20,
  height: 20,
} as const;

/**
 * The icon of a row of the list: the item's kind — or, for a file that cannot be opened yet, what
 * its upload is at, in the same square, since a row has no room for a badge beside its name: a ring
 * for the progress of this tab's upload (`getUploadProgress`), a mark for a failed one, a clock for
 * one still awaited. The words are its title.
 */
export const StorageItemRowIcon: FC<Props> = ({ item }) => {
  const upload = useUploadOf(item);
  const reason = getFolderItemUnavailableReason(item);

  if (!reason) {
    return <StorageItemIcon kind={getStorageItemKind(item)} fontSize="small" />;
  }

  const progress = getUploadProgress(upload, item.id);

  if (progress) {
    return (
      <Box component="span" title={progress.label} sx={slotSx}>
        <CircularProgress
          size={16}
          thickness={5}
          variant={progress.percent === undefined ? 'indeterminate' : 'determinate'}
          value={progress.percent}
          aria-label={`Upload progress of ${item.name}`}
        />
      </Box>
    );
  }

  // FAILED by the backend's word, or by this tab's: its own upload of the item died, though the row
  // says PENDING until its upload window closes.
  const isFailed =
    item.file?.uploadStatus === BrowserStorage.FileUploadStatus.FAILED ||
    upload?.status === 'failed';

  return (
    <Box
      component="span"
      role="img"
      title={isFailed ? 'Upload failed' : reason}
      aria-label={isFailed ? 'Upload failed' : reason}
      sx={slotSx}
    >
      {isFailed ? (
        <ErrorOutlineRounded color="error" fontSize="small" />
      ) : (
        <ScheduleRounded color="disabled" fontSize="small" />
      )}
    </Box>
  );
};
