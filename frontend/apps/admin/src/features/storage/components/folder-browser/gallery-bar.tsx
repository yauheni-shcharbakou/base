'use client';

import {
  getFileSize,
  getStorageItemKind,
  STORAGE_ITEM_KIND_LABELS,
} from '@/features/storage/helpers';
import CloseRounded from '@mui/icons-material/CloseRounded';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import FullscreenRounded from '@mui/icons-material/FullscreenRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import React, { FC } from 'react';
import { StorageItemMenu } from './storage-item-menu';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  item: Item;
  // "12 / 240" — the item's place in the whole folder.
  position?: string;
  isViewer?: boolean;
  isInfoShown: boolean;
  isHidden?: boolean;
  onToggleInfo: () => void;
  // Enters the viewer, or leaves it.
  onToggleViewer: () => void;
  onOpen: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onRename?: (item: Item) => void;
  onPublicChange?: (item: Item, isPublic: boolean) => void;
  // The folder shown is public: nothing in it goes private.
  isPublicLocked?: boolean;
  getFolderHref?: (id: string) => string;
};

const white = { color: 'common.white' };

/**
 * The strip over the top of a gallery's stage and its viewer: what the item is, and what can be
 * done with it. Only its controls take the pointer — a click anywhere else reaches the stage.
 */
export const GalleryBar: FC<Props> = ({
  item,
  position,
  isViewer = false,
  isInfoShown,
  isHidden = false,
  onToggleInfo,
  onToggleViewer,
  onOpen,
  onDelete,
  onRename,
  onPublicChange,
  isPublicLocked,
  getFolderHref,
}) => {
  const kind = getStorageItemKind(item);

  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1}
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 3,
        px: 2,
        pt: 1,
        pb: 3,
        color: 'common.white',
        background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0))',
        pointerEvents: 'none',
        opacity: isHidden ? 0 : 1,
        transition: 'opacity 200ms',
      }}
    >
      <Stack sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2" noWrap title={item.name}>
          {item.name}
        </Typography>
        <Typography variant="caption" noWrap sx={{ opacity: 0.8 }}>
          {position && `${position} · `}
          {STORAGE_ITEM_KIND_LABELS[kind]}
          {item.file ? ` · ${getFileSize(item.file.size)}` : ''}
        </Typography>
      </Stack>

      <Stack
        direction="row"
        alignItems="center"
        sx={{ pointerEvents: isHidden ? 'none' : 'auto' }}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <Tooltip title="Info (I)">
          <IconButton
            aria-label="Info"
            aria-pressed={isInfoShown}
            onClick={onToggleInfo}
            sx={{ ...white, bgcolor: isInfoShown ? 'rgba(255, 255, 255, 0.2)' : undefined }}
          >
            <InfoOutlined />
          </IconButton>
        </Tooltip>
        <Tooltip title={item.isFolder ? 'Open' : 'Open in new tab'}>
          <IconButton aria-label="Open" onClick={() => onOpen(item)} sx={white}>
            {item.isFolder ? <FolderOpenOutlined /> : <OpenInNewOutlined />}
          </IconButton>
        </Tooltip>
        <StorageItemMenu
          item={item}
          getFolderHref={getFolderHref}
          onDelete={onDelete}
          onRename={onRename}
          onPublicChange={onPublicChange}
          isPublicLocked={isPublicLocked}
          buttonProps={{ size: 'medium', sx: white }}
        />
        <Tooltip title={isViewer ? 'Exit full screen (Space)' : 'Full screen (Space)'}>
          <IconButton
            aria-label={isViewer ? 'Exit full screen' : 'Full screen'}
            onClick={onToggleViewer}
            sx={white}
          >
            {isViewer ? <CloseRounded /> : <FullscreenRounded />}
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
};
