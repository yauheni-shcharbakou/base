'use client';

import { pathProvider } from '@/common/providers';
import AddRounded from '@mui/icons-material/AddRounded';
import CreateNewFolderOutlined from '@mui/icons-material/CreateNewFolderOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import VideoFileOutlined from '@mui/icons-material/VideoFileOutlined';
import { Button, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { Database, StorageDatabaseEntity } from '@packages/common';
import NextLink from 'next/link';
import React, { FC, ReactNode, useState } from 'react';

type Props = {
  folderId: string;
  userId: string;
};

const { STORAGE } = Database;
const { FILE, IMAGE, STORAGE_OBJECT, VIDEO } = StorageDatabaseEntity;

const ENTRIES: { label: string; icon: ReactNode; getPath: () => string }[] = [
  {
    label: 'Folder or object',
    icon: <CreateNewFolderOutlined fontSize="small" />,
    getPath: () => pathProvider.getCreatePath(STORAGE, STORAGE_OBJECT),
  },
  {
    label: 'Upload files',
    icon: <UploadFileOutlined fontSize="small" />,
    getPath: () => pathProvider.getCreateManyPath(STORAGE, FILE),
  },
  {
    label: 'Upload images',
    icon: <ImageOutlined fontSize="small" />,
    getPath: () => pathProvider.getCreateManyPath(STORAGE, IMAGE),
  },
  {
    label: 'Upload videos',
    icon: <VideoFileOutlined fontSize="small" />,
    getPath: () => pathProvider.getCreateManyPath(STORAGE, VIDEO),
  },
];

/**
 * Drive's "New": a form that creates or uploads into this folder, opened with its owner and the
 * folder filled in (`?userId=&parent=`, read by `usePresetPlacement`).
 */
export const FolderNewMenu: FC<Props> = ({ folderId, userId }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const query = new URLSearchParams({ userId, parent: folderId });
  const close = () => setAnchor(null);

  return (
    <>
      <Button
        size="small"
        startIcon={<AddRounded />}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        New
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close}>
        {ENTRIES.map(({ label, icon, getPath }) => (
          <MenuItem key={label} component={NextLink} href={`${getPath()}?${query}`} onClick={close}>
            <ListItemIcon>{icon}</ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
