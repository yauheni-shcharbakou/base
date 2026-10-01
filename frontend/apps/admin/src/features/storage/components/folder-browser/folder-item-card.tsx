'use client';

import { formatFolderStats, getStorageItemKind } from '@/features/storage/helpers';
import PublicOutlined from '@mui/icons-material/PublicOutlined';
import { Box, Card, Checkbox, Stack, Typography } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import React, { FC, useEffect, useRef } from 'react';
import { StorageItemIcon } from './storage-item-icon';
import { StorageItemMenu } from './storage-item-menu';
import { StorageItemThumbnail } from './storage-item-thumbnail';
import type { FolderItemBehavior } from './use-folder-item-behavior';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  item: Item;
  behavior: FolderItemBehavior;
  onPreviewError?: () => void;
};

const cardSx = {
  position: 'relative',
  borderRadius: 3,
  cursor: 'default',
  userSelect: 'none',
  transition: 'background-color 120ms',
  '&:hover': { bgcolor: 'action.hover' },
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
  // The icon gives way to a checkbox under the pointer, and on every card once one is selected.
  '& .item-check': { display: 'none' },
  '&:hover .item-check, &[data-selecting] .item-check': { display: 'inline-flex' },
  '&:hover .item-icon, &[data-selecting] .item-icon': { display: 'none' },
} as const;

/**
 * A card of the Drive-style grid: a one-line folder, or a file with its thumbnail under its name. A
 * click selects it, a double click opens it; a folder takes a drop of other items.
 */
export const FolderItemCard: FC<Props> = ({ item, behavior, onPreviewError }) => {
  const kind = getStorageItemKind(item);
  const ref = useRef<HTMLDivElement>(null);
  const isSelected = behavior.selectedIds.has(item.id);
  const isFocused = behavior.focusedId === item.id;
  const isDropTarget = behavior.dropTargetId === item.id;
  const { menu } = behavior;

  // The card the keyboard is on comes into view with the focus, so Enter opens it.
  useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ block: 'nearest' });
      ref.current?.focus({ preventScroll: true });
    }
  }, [isFocused]);

  const sx = {
    ...cardSx,
    ...(isSelected && {
      bgcolor: 'action.selected',
      borderColor: 'primary.main',
      '&:hover': { bgcolor: 'action.selected' },
    }),
    // Marked for the keyboard but not selected — the folder just left — whatever moved the focus.
    ...(isFocused &&
      !isSelected && { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 }),
    ...(isDropTarget && {
      bgcolor: 'primary.light',
      borderColor: 'primary.main',
      '&:hover': { bgcolor: 'primary.light' },
    }),
  };

  const header = (
    <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', width: 20, justifyContent: 'center', flexShrink: 0 }}>
        <StorageItemIcon kind={kind} fontSize="small" className="item-icon" />
        <Checkbox
          className="item-check"
          size="small"
          checked={isSelected}
          onClick={(event) => event.stopPropagation()}
          onChange={() => behavior.onToggle(item)}
          inputProps={{ 'aria-label': `Select ${item.name}` }}
          sx={{ p: 0 }}
        />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={500} noWrap title={item.name}>
          {item.name}
        </Typography>
        {/* A folder's whole subtree, under its name. */}
        {item.folderStats && (
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {formatFolderStats(item.folderStats)}
          </Typography>
        )}
      </Box>
      {item.isPublic && (
        <Box component="span" title="Public" sx={{ display: 'flex', flexShrink: 0 }}>
          <PublicOutlined sx={{ fontSize: 16, color: 'text.secondary' }} />
        </Box>
      )}
      <StorageItemMenu
        item={item}
        getFolderHref={menu.getFolderHref}
        onMenuOpen={menu.onMenuOpen}
        onMove={menu.onMove}
        onDelete={menu.onDelete}
        onRename={menu.onRename}
        onUploadAgain={menu.onUploadAgain}
        onPublicChange={menu.onPublicChange}
        isPublic={menu.getActionsPublic(item)}
        isPublicLocked={menu.isPublicLocked}
        actionCount={menu.getActionCount(item)}
      />
    </Stack>
  );

  const cardProps = {
    ref,
    variant: 'outlined' as const,
    role: 'button',
    tabIndex: 0,
    'aria-selected': isSelected,
    'data-selecting': behavior.selectedIds.size ? '' : undefined,
    ...behavior.getItemProps(item),
  };

  if (item.isFolder) {
    return (
      <Card {...cardProps} sx={{ ...sx, pl: 2, pr: 0.5, py: 0.75 }}>
        {header}
      </Card>
    );
  }

  return (
    <Card {...cardProps} sx={{ ...sx, px: 1, pb: 1, pt: 0.5 }}>
      <Box sx={{ pl: 1 }}>{header}</Box>
      <Box
        sx={{
          mt: 0.5,
          aspectRatio: '4 / 3',
          borderRadius: 2,
          overflow: 'hidden',
          // A dragged thumbnail would drag the image, not the card.
          pointerEvents: 'none',
        }}
      >
        <StorageItemThumbnail item={item} onPreviewError={onPreviewError} />
      </Box>
    </Card>
  );
};
