'use client';

import {
  getFileUploadStatusColor,
  getUploadProgress,
  isUploadActive,
} from '@/features/storage/helpers';
import { ITEM_ID_ATTRIBUTE, useCancelItemUpload, useUploadOf } from '@/features/storage/hooks';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { Box, Chip, LinearProgress } from '@mui/material';
import { BrowserStorage } from '@packages/proto';
import React, { FC } from 'react';

type Props = {
  item: BrowserStorage.StorageObjectFolderItem;
};

const badgeSx = {
  position: 'absolute',
  left: 6,
  top: 6,
  display: 'flex',
  gap: 0.5,
  '& .MuiChip-root': { height: 20 },
} as const;

const cancellableSx = {
  ...badgeSx,
  // The thumbnail lets the pointer through to its card: the cancel takes it back.
  '& .upload-cancel': { pointerEvents: 'auto' },
  // The upload box's: under the pointer — or with the keyboard on it — the progress gives way to
  // its cancel. Where nothing hovers, on a touch screen, the two stand side by side.
  '@media (hover: hover)': {
    '& .upload-cancel': {
      position: 'absolute',
      left: 0,
      top: 0,
      opacity: 0,
      pointerEvents: 'none',
    },
    [`[${ITEM_ID_ATTRIBUTE}]:hover & .upload-cancel, &:focus-within .upload-cancel`]: {
      opacity: 1,
      pointerEvents: 'auto',
    },
    [`[${ITEM_ID_ATTRIBUTE}]:hover & .upload-progress, &:focus-within .upload-progress`]: {
      visibility: 'hidden',
    },
  },
} as const;

const cancelSx = {
  color: 'common.white',
  bgcolor: 'rgba(0, 0, 0, 0.7)',
  '&:hover, &.Mui-focusVisible': { bgcolor: 'rgba(0, 0, 0, 0.85)' },
  '& .MuiChip-icon': { color: 'inherit' },
} as const;

const DOUBLE_CLICK_MS = 500;

// The rest of a double click is nobody's: the item is gone by its second click, which would select
// — and open — the card that has moved under the pointer.
const swallowDoubleClick = () => {
  const swallow = (event: MouseEvent) => {
    if (event.detail > 1) {
      event.stopPropagation();
      event.preventDefault();
    }
  };
  const types = ['click', 'dblclick'] as const;

  types.forEach((type) => window.addEventListener(type, swallow, true));
  setTimeout(
    () => types.forEach((type) => window.removeEventListener(type, swallow, true)),
    DOUBLE_CLICK_MS,
  );
};

/**
 * What a file that cannot be opened yet says of its upload, over its thumbnail: how far this tab's
 * upload of it is — its own, or the one taking its place (`getUploadProgress`) — as a badge in the
 * corner and a bar along the bottom, with a way to cancel it under the pointer; else the status of
 * its row. Nothing for a folder, or a file that is READY.
 */
export const StorageItemUploadBadge: FC<Props> = ({ item }) => {
  const upload = useUploadOf(item);
  const cancelUpload = useCancelItemUpload();
  const status = item.file?.uploadStatus;

  if (item.isFolder || status === BrowserStorage.FileUploadStatus.READY) {
    return null;
  }

  const progress = getUploadProgress(upload, item.id);

  if (!progress) {
    return (
      <Box sx={badgeSx}>
        <Chip
          size="small"
          label={status ?? 'NO FILE'}
          color={getFileUploadStatusColor(status) ?? 'default'}
        />
      </Box>
    );
  }

  // Until the upload rests: then there is nothing left to stop.
  const cancellable = upload && isUploadActive(upload) ? upload : undefined;

  return (
    <>
      <Box sx={cancellable ? cancellableSx : badgeSx}>
        <Chip className="upload-progress" size="small" label={progress.label} color="primary" />
        {cancellable && (
          <Chip
            className="upload-cancel"
            size="small"
            icon={<CloseRounded />}
            label="Cancel upload"
            aria-label={`Cancel the upload of ${item.name}`}
            // The card behind it selects on a click and opens on two: neither may reach it.
            onClick={(event) => {
              event.stopPropagation();

              if (event.detail <= 1) {
                swallowDoubleClick();
                cancelUpload(cancellable, item);
              }
            }}
            onDoubleClick={(event) => event.stopPropagation()}
            sx={cancelSx}
          />
        )}
      </Box>
      <LinearProgress
        variant={progress.percent === undefined ? 'indeterminate' : 'determinate'}
        value={progress.percent}
        aria-label={`Upload progress of ${item.name}`}
        sx={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
      />
    </>
  );
};
