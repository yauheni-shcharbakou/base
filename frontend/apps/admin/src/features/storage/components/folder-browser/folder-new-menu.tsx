'use client';

import { pathProvider } from '@/common/providers';
import AddRounded from '@mui/icons-material/AddRounded';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import CreateNewFolderOutlined from '@mui/icons-material/CreateNewFolderOutlined';
import DriveFolderUploadOutlined from '@mui/icons-material/DriveFolderUploadOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import VideoFileOutlined from '@mui/icons-material/VideoFileOutlined';
import {
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
} from '@mui/material';
import { Database, StorageDatabaseEntity } from '@packages/common';
import NextLink from 'next/link';
import React, { ChangeEvent, FC, ReactNode, RefObject, useRef, useState } from 'react';

type Props = {
  folderId: string;
  userId: string;
  // Files picked for Drive's "File upload", which go straight into the upload queue.
  onUpload: (files: File[]) => void;
  // A folder picked for Drive's "Folder upload": its files, each with its `webkitRelativePath`.
  onUploadFolder: (files: File[]) => void;
};

// The directory picker has no React prop: `webkitdirectory` is set on the element itself.
const asDirectoryPicker = (input: HTMLInputElement | null) =>
  input?.setAttribute('webkitdirectory', '');

const { STORAGE } = Database;
const { FILE, IMAGE, STORAGE_OBJECT, VIDEO } = StorageDatabaseEntity;

type Entry = { label: string; icon: ReactNode; getPath: () => string };

const CREATE_ENTRY: Entry = {
  label: 'Folder or object',
  icon: <CreateNewFolderOutlined fontSize="small" />,
  getPath: () => pathProvider.getCreatePath(STORAGE, STORAGE_OBJECT),
};

const FORM_ENTRIES: Entry[] = [
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
 * Drive's "New": "File upload" picks files that upload straight into this folder, sorted into
 * files, images and videos as a drop is, and "Folder upload" a folder that comes with its whole
 * tree; the rest are forms that create or upload into it, opened
 * with its owner and the folder filled in (`?userId=&parent=`, read by `usePresetPlacement`).
 */
export const FolderNewMenu: FC<Props> = ({ folderId, userId, onUpload, onUploadFolder }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const query = new URLSearchParams({ userId, parent: folderId });
  const close = () => setAnchor(null);

  const renderLink = ({ label, icon, getPath }: Entry) => (
    <MenuItem key={label} component={NextLink} href={`${getPath()}?${query}`} onClick={close}>
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText>{label}</ListItemText>
    </MenuItem>
  );

  const pick = (upload: (files: File[]) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // The same files picked again are a change too.
    event.target.value = '';

    if (files.length) {
      upload(files);
    }
  };

  const renderPicker = (
    label: string,
    icon: ReactNode,
    input: RefObject<HTMLInputElement | null>,
  ) => (
    <MenuItem
      onClick={() => {
        close();
        input.current?.click();
      }}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText>{label}</ListItemText>
    </MenuItem>
  );

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
      <input ref={inputRef} type="file" multiple hidden onChange={pick(onUpload)} />
      <input
        ref={(input) => {
          folderInputRef.current = input;
          asDirectoryPicker(input);
        }}
        type="file"
        hidden
        onChange={pick(onUploadFolder)}
      />
      <Menu anchorEl={anchor} open={!!anchor} onClose={close}>
        {renderLink(CREATE_ENTRY)}
        {renderPicker('File upload', <CloudUploadOutlined fontSize="small" />, inputRef)}
        {renderPicker(
          'Folder upload',
          <DriveFolderUploadOutlined fontSize="small" />,
          folderInputRef,
        )}
        <Divider />
        <ListSubheader sx={{ lineHeight: '32px' }}>With a form</ListSubheader>
        {FORM_ENTRIES.map(renderLink)}
      </Menu>
    </>
  );
};
