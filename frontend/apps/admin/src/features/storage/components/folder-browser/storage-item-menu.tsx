'use client';

import {
  getFolderContentPath,
  getFolderItemDownloadUrl,
  getFolderItemOpenUrl,
  getFolderItemUnavailableReason,
  getItemUploadState,
  isReplacedBy,
  QueuedUpload,
} from '@/features/storage/helpers';
import { useUploadOf } from '@/features/storage/hooks';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import DriveFileMoveOutlined from '@mui/icons-material/DriveFileMoveOutlined';
import DriveFileRenameOutlineOutlined from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import PublicOutlined from '@mui/icons-material/PublicOutlined';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
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
import { MenuPosition, passRightClickOn } from './context-menu';
import { MenuShortcut } from './menu-shortcut';

type Item = BrowserStorage.StorageObjectFolderItem;

type ActionsProps = {
  item: Item;
  getFolderHref?: (id: string) => string;
  // Without it, the menu offers no Delete.
  onDelete?: (item: Item) => void;
  // Without it, the menu offers no Move.
  onMove?: (item: Item) => void;
  // Without it, the menu offers no Rename. Never offered for several items, as in Drive.
  onRename?: (item: Item) => void;
  // Without it, an item whose upload failed is offered no "Upload again". One item only, too.
  onUploadAgain?: (item: Item) => void;
  // Without it, the menu offers no Public switch. Acts on what Move and Delete act on.
  onPublicChange?: (item: Item, isPublic: boolean) => void;
  // Whether everything the switch acts on is public; the item's own visibility by default.
  isPublic?: boolean;
  // The folder shown is public, so nothing in it can be made private.
  isPublicLocked?: boolean;
  // How many items Move, Delete and Public act on: the whole selection when the item is part of it.
  actionCount?: number;
};

type ActionsMenuProps = ActionsProps & {
  // What the menu hangs from: an element — the "⋮" — or the point of a right click. Neither: shut.
  anchorEl?: HTMLElement | null;
  anchorPosition?: MenuPosition;
  onClose: () => void;
};

// The menu itself, told the upload this tab holds for the item by whoever reads it off the queue.
const ActionsMenu: FC<ActionsMenuProps & { upload?: QueuedUpload }> = ({
  item,
  upload,
  getFolderHref = getFolderContentPath,
  onDelete,
  onMove,
  onRename,
  onUploadAgain,
  onPublicChange,
  isPublic = item.isPublic,
  isPublicLocked = false,
  actionCount = 1,
  anchorEl,
  anchorPosition,
  onClose: close,
}) => {
  const openUrl = getFolderItemOpenUrl(item);
  const downloadUrl = getFolderItemDownloadUrl(item);
  // A failed upload opens nowhere: its way out stands where Open would.
  const isUploadFailed =
    getItemUploadState(item, getFolderItemUnavailableReason(item), upload)?.type === 'failed';

  // The card behind the menu opens the item: nothing here may reach it.
  const stop = (event: MouseEvent) => event.stopPropagation();
  const many = actionCount > 1 ? ` ${actionCount} items` : '';

  return (
    <Menu
      anchorEl={anchorEl}
      anchorReference={anchorPosition ? 'anchorPosition' : 'anchorEl'}
      anchorPosition={anchorPosition}
      open={!!anchorEl || !!anchorPosition}
      onClose={close}
      onClick={stop}
      onContextMenu={passRightClickOn(close)}
    >
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
      {onUploadAgain && isUploadFailed && actionCount === 1 && (
        <MenuItem
          onClick={() => {
            close();
            onUploadAgain(item);
          }}
        >
          <ListItemIcon>
            <ReplayRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Upload again</ListItemText>
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
            secondary={isPublic && isPublicLocked ? 'Inherited from the public folder' : undefined}
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
  );
};

/**
 * What can be done with an item, beyond a click: a rename, its visibility, a download, a move, a
 * delete, each with its key where it has one — and, for an item whose upload failed, "Upload again"
 * in place of an Open that leads nowhere. Move, Delete and the Public switch act on the whole
 * selection when the item is part of it, as in Drive; Rename and "Upload again" take one item only.
 * Opened from the item's "⋮" (`StorageItemMenu`), or by the pointer on a right click.
 */
export const StorageItemActionsMenu: FC<ActionsMenuProps> = (props) => (
  <ActionsMenu {...props} upload={useUploadOf(props.item)} />
);

type Props = ActionsProps & {
  // As the menu opens — Drive makes its item the selection unless it is part of it.
  onMenuOpen?: (item: Item) => void;
  buttonProps?: IconButtonProps;
};

/**
 * An item's "⋮", and the menu it opens (`StorageItemActionsMenu`). It rests for an item being
 * uploaded again, which is held on its page after its delete.
 */
export const StorageItemMenu: FC<Props> = ({ item, onMenuOpen, buttonProps, ...actions }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const upload = useUploadOf(item);
  // An item a new upload is taking the place of is deleted already, and only held on its page:
  // there is nothing left for the menu to act on.
  const isReplaced = isReplacedBy(upload, item.id);

  return (
    <>
      <IconButton
        size="small"
        aria-label={`Actions for ${item.name}`}
        {...buttonProps}
        disabled={isReplaced || buttonProps?.disabled}
        onClick={(event) => {
          // The card behind the button opens the item: nothing here may reach it.
          event.stopPropagation();
          onMenuOpen?.(item);
          setAnchor(event.currentTarget);
        }}
      >
        <MoreVertOutlined fontSize="small" />
      </IconButton>
      <ActionsMenu
        item={item}
        upload={upload}
        {...actions}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
      />
    </>
  );
};
