'use client';

import { getStorageItemKind } from '@/features/storage/helpers';
import { Box, Card, Stack, Typography } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import React, { FC, KeyboardEvent, useEffect, useRef } from 'react';
import { StorageItemIcon } from './storage-item-icon';
import { StorageItemMenu } from './storage-item-menu';
import { StorageItemThumbnail } from './storage-item-thumbnail';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  item: Item;
  // Marked — the folder just left, as Finder selects it.
  isSelected?: boolean;
  onOpen: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onPreviewError?: () => void;
  getFolderHref?: (id: string) => string;
};

const cardSx = {
  borderRadius: 3,
  cursor: 'pointer',
  transition: 'background-color 120ms',
  '&:hover': { bgcolor: 'action.hover' },
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
};

/** A card of the Drive-style grid: a one-line folder, or a file with its thumbnail under its name. */
export const FolderItemCard: FC<Props> = ({
  item,
  isSelected = false,
  onOpen,
  onDelete,
  onPreviewError,
  getFolderHref,
}) => {
  const kind = getStorageItemKind(item);
  const ref = useRef<HTMLDivElement>(null);

  // The marked card comes into view with the focus, so Enter goes straight back in.
  useEffect(() => {
    if (isSelected) {
      ref.current?.scrollIntoView({ block: 'nearest' });
      ref.current?.focus({ preventScroll: true });
    }
  }, [isSelected]);

  const sx = {
    ...cardSx,
    ...(isSelected && { bgcolor: 'action.selected', borderColor: 'primary.main' }),
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && event.target === event.currentTarget) {
      onOpen(item);
    }
  };

  const header = (
    <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
      <StorageItemIcon kind={kind} fontSize="small" />
      <Typography variant="body2" fontWeight={500} noWrap title={item.name} sx={{ flex: 1 }}>
        {item.name}
      </Typography>
      <StorageItemMenu item={item} getFolderHref={getFolderHref} onDelete={onDelete} />
    </Stack>
  );

  if (item.isFolder) {
    return (
      <Card
        ref={ref}
        variant="outlined"
        role="button"
        tabIndex={0}
        aria-current={isSelected || undefined}
        onClick={() => onOpen(item)}
        onKeyDown={handleKeyDown}
        sx={{ ...sx, pl: 2, pr: 0.5, py: 0.75 }}
      >
        {header}
      </Card>
    );
  }

  return (
    <Card
      ref={ref}
      variant="outlined"
      role="button"
      tabIndex={0}
      aria-current={isSelected || undefined}
      onClick={() => onOpen(item)}
      onKeyDown={handleKeyDown}
      sx={{ ...sx, px: 1, pb: 1, pt: 0.5 }}
    >
      <Box sx={{ pl: 1 }}>{header}</Box>
      <Box sx={{ mt: 0.5, aspectRatio: '4 / 3', borderRadius: 2, overflow: 'hidden' }}>
        <StorageItemThumbnail item={item} onPreviewError={onPreviewError} />
      </Box>
    </Card>
  );
};
