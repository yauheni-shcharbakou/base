'use client';

import {
  getFolderItemUnavailableReason,
  getItemUploadState,
  getStorageItemKind,
} from '@/features/storage/helpers';
import { useUploadOf } from '@/features/storage/hooks';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import { Box, CircularProgress } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
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
 * its upload is at (`getItemUploadState`), in the same square, since a row has no room for a badge
 * beside its name: a ring for the progress of this tab's upload, a mark for a failed one, a clock
 * for one still awaited. The words are its title.
 */
export const StorageItemRowIcon: FC<Props> = ({ item }) => {
  const upload = useUploadOf(item);
  const reason = getFolderItemUnavailableReason(item);
  const state = getItemUploadState(item, reason, upload);

  if (!state) {
    return <StorageItemIcon kind={getStorageItemKind(item)} fontSize="small" />;
  }

  if (state.type === 'progress') {
    const { label, percent } = state.progress;

    return (
      <Box component="span" title={label} sx={slotSx}>
        <CircularProgress
          size={16}
          thickness={5}
          variant={percent === undefined ? 'indeterminate' : 'determinate'}
          value={percent}
          aria-label={`Upload progress of ${item.name}`}
        />
      </Box>
    );
  }

  const label = state.type === 'failed' ? 'Upload failed' : reason;

  return (
    <Box component="span" role="img" title={label} aria-label={label} sx={slotSx}>
      {state.type === 'failed' ? (
        <ErrorOutlineRounded color="error" fontSize="small" />
      ) : (
        <ScheduleRounded color="disabled" fontSize="small" />
      )}
    </Box>
  );
};
