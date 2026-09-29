'use client';

import { pathProvider } from '@/common/providers';
import {
  getFolderContentPath,
  getFolderItemDownloadUrl,
  getFolderItemOpenUrl,
} from '@/features/storage/helpers';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import {
  Divider,
  IconButton,
  IconButtonProps,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import { Database, StorageDatabaseEntity } from '@packages/common';
import type { BrowserStorage } from '@packages/proto';
import NextLink from 'next/link';
import React, { FC, MouseEvent, useState } from 'react';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  item: Item;
  getFolderHref?: (id: string) => string;
  // Without it, the menu offers no Delete.
  onDelete?: (item: Item) => void;
  buttonProps?: IconButtonProps;
};

const { STORAGE } = Database;
const { STORAGE_OBJECT } = StorageDatabaseEntity;

/** An item's "⋮": what a click does not — its details, its edit form, a download, a delete. */
export const StorageItemMenu: FC<Props> = ({
  item,
  getFolderHref = getFolderContentPath,
  onDelete,
  buttonProps,
}) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const openUrl = getFolderItemOpenUrl(item);
  const downloadUrl = getFolderItemDownloadUrl(item);

  // The card behind the button opens the item: nothing here may reach it.
  const stop = (event: MouseEvent) => event.stopPropagation();
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton
        size="small"
        aria-label={`Actions for ${item.name}`}
        {...buttonProps}
        onClick={(event) => {
          stop(event);
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
        <MenuItem
          component={NextLink}
          href={pathProvider.getShowPath(STORAGE, STORAGE_OBJECT, item.id)}
          onClick={close}
        >
          <ListItemIcon>
            <InfoOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Details</ListItemText>
        </MenuItem>
        <MenuItem
          component={NextLink}
          href={pathProvider.getEditPath(STORAGE, STORAGE_OBJECT, item.id)}
          onClick={close}
        >
          <ListItemIcon>
            <EditOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        {downloadUrl && (
          <MenuItem component="a" href={downloadUrl} download onClick={close}>
            <ListItemIcon>
              <DownloadOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download</ListItemText>
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
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
};
