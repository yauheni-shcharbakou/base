'use client';

import {
  getFolderContentPath,
  getFolderItemDownloadUrl,
  getFolderItemOpenUrl,
} from '@/features/storage/helpers';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import DriveFileMoveOutlined from '@mui/icons-material/DriveFileMoveOutlined';
import DriveFileRenameOutlineOutlined from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import PublicOutlined from '@mui/icons-material/PublicOutlined';
import {
  Divider,
  IconButton,
  IconButtonProps,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Switch,
} from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import NextLink from 'next/link';
import React, { FC, MouseEvent, useState } from 'react';
import { MenuShortcut } from './menu-shortcut';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  item: Item;
  getFolderHref?: (id: string) => string;
  // Without it, the menu offers no Delete.
  onDelete?: (item: Item) => void;
  // Without it, the menu offers no Move.
  onMove?: (item: Item) => void;
  // Without it, the menu offers no Rename. Never offered for several items, as in Drive.
  onRename?: (item: Item) => void;
  // Without it, the menu offers no Public switch. Acts on what Move and Delete act on.
  onPublicChange?: (item: Item, isPublic: boolean) => void;
  // Whether everything the switch acts on is public; the item's own visibility by default.
  isPublic?: boolean;
  // The folder shown is public, so nothing in it can be made private.
  isPublicLocked?: boolean;
  // As the menu opens — Drive makes its item the selection unless it is part of it.
  onMenuOpen?: (item: Item) => void;
  // How many items Move, Delete and Public act on: the whole selection when the item is part of it.
  actionCount?: number;
  buttonProps?: IconButtonProps;
};

/**
 * An item's "⋮": what a click does not — a rename, its visibility, a download, a move, a delete,
 * each with its key where it has one. Move, Delete and the Public switch act on the whole selection
 * when the item is part of it, as in Drive; Rename takes one item only.
 */
export const StorageItemMenu: FC<Props> = ({
  item,
  getFolderHref = getFolderContentPath,
  onDelete,
  onMove,
  onRename,
  onPublicChange,
  isPublic = item.isPublic,
  isPublicLocked = false,
  onMenuOpen,
  actionCount = 1,
  buttonProps,
}) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const openUrl = getFolderItemOpenUrl(item);
  const downloadUrl = getFolderItemDownloadUrl(item);

  // The card behind the button opens the item: nothing here may reach it.
  const stop = (event: MouseEvent) => event.stopPropagation();
  const many = actionCount > 1 ? ` ${actionCount} items` : '';
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton
        size="small"
        aria-label={`Actions for ${item.name}`}
        {...buttonProps}
        onClick={(event) => {
          stop(event);
          onMenuOpen?.(item);
          setAnchor(event.currentTarget);
        }}
      >
        <MoreVertOutlined fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close} onClick={stop}>
        {item.isFolder && (
          <MenuItem component={NextLink} href={getFolderHref(item.id)} onClick={close}>
            <ListItemIcon>
              <FolderOpenOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Open</ListItemText>
            <MenuShortcut name="open" />
          </MenuItem>
        )}
        {openUrl && (
          <MenuItem component="a" href={openUrl} target="_blank" rel="noopener" onClick={close}>
            <ListItemIcon>
              <OpenInNewOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Open in new tab</ListItemText>
          </MenuItem>
        )}
        {onRename && actionCount === 1 && (
          <MenuItem
            onClick={() => {
              close();
              onRename(item);
            }}
          >
            <ListItemIcon>
              <DriveFileRenameOutlineOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Rename</ListItemText>
            <MenuShortcut name="rename" />
          </MenuItem>
        )}
        {onPublicChange && (
          <MenuItem
            // Nothing in a public folder goes private: on, and locked.
            disabled={isPublic && isPublicLocked}
            onClick={() => {
              close();
              onPublicChange(item, !isPublic);
            }}
          >
            <ListItemIcon>
              <PublicOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText
              secondary={
                isPublic && isPublicLocked ? 'Inherited from the public folder' : undefined
              }
            >
              Public{many}
            </ListItemText>
            <Switch
              size="small"
              edge="end"
              checked={isPublic}
              tabIndex={-1}
              inputProps={{ 'aria-label': `Public${many}` }}
              sx={{ ml: 2, pointerEvents: 'none' }}
            />
          </MenuItem>
        )}
        {downloadUrl && (
          <MenuItem component="a" href={downloadUrl} download onClick={close}>
            <ListItemIcon>
              <DownloadOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download</ListItemText>
          </MenuItem>
        )}
        {onMove && (
          <MenuItem
            onClick={() => {
              close();
              onMove(item);
            }}
          >
            <ListItemIcon>
              <DriveFileMoveOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Move{many} to…</ListItemText>
          </MenuItem>
        )}
        {onDelete && <Divider />}
        {onDelete && (
          <MenuItem
            onClick={() => {
              close();
              onDelete(item);
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>
              <DeleteOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Delete{many}</ListItemText>
            <MenuShortcut name="delete" />
          </MenuItem>
        )}
      </Menu>
    </>
  );
};
