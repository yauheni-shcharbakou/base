'use client';

import {
  getFileUploadStatusColor,
  getStorageItemKind,
  StorageItemKind,
} from '@/features/storage/helpers';
import { getVideoDuration } from '@/features/video/helpers';
import PlayCircleFilledRounded from '@mui/icons-material/PlayCircleFilledRounded';
import { Box, Chip } from '@mui/material';
import { BrowserStorage } from '@packages/proto';
import Image from 'next/image';
import React, { FC, useState } from 'react';
import { StorageItemIcon } from './storage-item-icon';

type Props = {
  item: BrowserStorage.StorageObjectFolderItem;
  iconSize?: number | string;
  fit?: 'cover' | 'contain';
  // Leaves out the badges — duration, upload status — where the thumbnail is too small for them.
  compact?: boolean;
  onPreviewError?: () => void;
};

/**
 * An item's picture: its signed preview — never the original (ADR-0027) — or its kind's icon. A
 * preview that fails to load shows the icon and asks the listing for fresh URLs; a new URL for the
 * same item is tried again.
 */
export const StorageItemThumbnail: FC<Props> = ({
  item,
  iconSize = 64,
  fit = 'cover',
  compact = false,
  onPreviewError,
}) => {
  const [failedSrc, setFailedSrc] = useState<string>();
  const kind = getStorageItemKind(item);
  const src = item.previewUrl;
  const hasPreview = !!src && src !== failedSrc;
  const status = item.file?.uploadStatus;
  const isPending = !item.isFolder && status !== BrowserStorage.FileUploadStatus.READY;

  return (
    <Box
      sx={{
        position: 'relative',
        width: 1,
        height: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        bgcolor: 'action.hover',
      }}
    >
      {hasPreview ? (
        <Image
          src={src}
          alt={item.image?.alt || item.name}
          fill
          loading="lazy"
          style={{ objectFit: fit }}
          onError={() => {
            setFailedSrc(src);
            onPreviewError?.();
          }}
        />
      ) : (
        <StorageItemIcon kind={kind} sx={{ fontSize: iconSize }} />
      )}

      {kind === StorageItemKind.VIDEO && hasPreview && (
        <PlayCircleFilledRounded
          sx={{
            position: 'absolute',
            fontSize: compact ? 24 : 40,
            color: 'common.white',
            opacity: 0.85,
            filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5))',
          }}
        />
      )}

      {!compact && kind === StorageItemKind.VIDEO && !!item.video?.duration && (
        <Chip
          size="small"
          label={getVideoDuration(item.video.duration)}
          sx={{
            position: 'absolute',
            right: 6,
            bottom: 6,
            height: 20,
            color: 'common.white',
            bgcolor: 'rgba(0, 0, 0, 0.7)',
          }}
        />
      )}

      {!compact && isPending && (
        <Chip
          size="small"
          label={status ?? 'NO FILE'}
          color={getFileUploadStatusColor(status) ?? 'default'}
          sx={{ position: 'absolute', left: 6, top: 6, height: 20 }}
        />
      )}
    </Box>
  );
};
