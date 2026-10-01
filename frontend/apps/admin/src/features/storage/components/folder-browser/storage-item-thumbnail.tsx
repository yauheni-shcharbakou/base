'use client';

import { getStorageItemKind, StorageItemKind } from '@/features/storage/helpers';
import { getVideoDuration } from '@/features/video/helpers';
import PlayCircleFilledRounded from '@mui/icons-material/PlayCircleFilledRounded';
import { Box, Chip } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import Image from 'next/image';
import React, { FC, useState } from 'react';
import { StorageItemIcon } from './storage-item-icon';
import { StorageItemUploadBadge } from './storage-item-upload-badge';

type Props = {
  item: BrowserStorage.StorageObjectFolderItem;
  iconSize?: number | string;
  fit?: 'cover' | 'contain';
  // Leaves out the badges — duration, the upload's status or progress — where the thumbnail is too
  // small for them.
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
          // A page is read from its top, as in Drive: a crop keeps the title, not the middle.
          style={{
            objectFit: fit,
            objectPosition: kind === StorageItemKind.PDF ? 'top' : undefined,
          }}
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

      {!compact && <StorageItemUploadBadge item={item} isOverlay />}
    </Box>
  );
};
